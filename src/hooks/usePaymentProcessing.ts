import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useStore from '../components/state/store';
import { cancelOrder, createOrder, getOrderById } from '../api/services/payment';
import { EOrderStatus, EPaymentMethod } from '../components/state/order/orderSlice';
import { logger } from '../util/logger';
import { PAYMENT_CONSTANTS } from '../constants/payment';

export const usePaymentProcessing = (paymentMethod: EPaymentMethod) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    order,
    selectedProgram,
    setIsLoading,
    setOrder,
    setQueuePosition: setGlobalQueuePosition,
    setQueueNumber: setGlobalQueueNumber
  } = useStore();

  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [timeUntilRobotStart, setTimeUntilRobotStart] = useState(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueNumber, setQueueNumber] = useState<number | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [queueFull, setQueueFull] = useState(false);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const depositTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderCreatedRef = useRef(false);
  const orderCreationLockRef = useRef(false);
  const isPollingRef = useRef(false);
  const orderIdRef = useRef<string | undefined>(undefined);
  const checkPaymentStatusRef = useRef<() => Promise<void>>();
  const handleStartRobotRef = useRef<() => Promise<void>>();
  const startCountdownRef = useRef<() => void>();
  const createOrderAbortControllerRef = useRef<AbortController | null>(null);
  const createOrderDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createOrderRequestIdRef = useRef<string | null>(null);
  const isCreatingOrderRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (depositTimeoutRef.current) {
      clearTimeout(depositTimeoutRef.current);
      depositTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (countdownTimeoutRef.current) {
      clearTimeout(countdownTimeoutRef.current);
      countdownTimeoutRef.current = null;
    }
    if (createOrderAbortControllerRef.current) {
      createOrderAbortControllerRef.current.abort();
      createOrderAbortControllerRef.current = null;
    }
    if (createOrderDebounceTimeoutRef.current) {
      clearTimeout(createOrderDebounceTimeoutRef.current);
      createOrderDebounceTimeoutRef.current = null;
    }
    // Clear order creation lock and state
    orderCreationLockRef.current = false;
    isCreatingOrderRef.current = false;
    isPollingRef.current = false;
    createOrderRequestIdRef.current = null;
    setTimeUntilRobotStart(0);
  }, []);

  // Atomic lock acquisition - returns true if lock was acquired, false if already locked
  const acquireOrderCreationLock = useCallback((): boolean => {
    // Atomic check-and-set: if lock is false, set it to true and return true
    // If lock is already true, return false immediately
    if (orderCreationLockRef.current || isCreatingOrderRef.current) {
      return false;
    }
    orderCreationLockRef.current = true;
    isCreatingOrderRef.current = true;
    return true;
  }, []);

  // Release lock and reset state
  const releaseOrderCreationLock = useCallback((resetCreatedFlag = false) => {
    orderCreationLockRef.current = false;
    isCreatingOrderRef.current = false;
    if (resetCreatedFlag) {
      orderCreatedRef.current = false;
    }
  }, []);

  const createOrderAsync = useCallback(async () => {
    // Early validation checks
    if (!selectedProgram) {
      logger.warn(`[${paymentMethod}] Cannot create order: missing program`);
      return;
    }

    if (orderCreatedRef.current) {
      logger.warn(`[${paymentMethod}] Cannot create order: order already created`);
      return;
    }

    // Atomic lock acquisition - prevents race conditions
    if (!acquireOrderCreationLock()) {
      logger.warn(`[${paymentMethod}] Cannot create order: already in progress (locked)`);
      return;
    }

    // Generate unique request ID for this order creation attempt
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    createOrderRequestIdRef.current = requestId;

    // Abort any existing createOrder request
    if (createOrderAbortControllerRef.current) {
      logger.debug(`[${paymentMethod}] Aborting previous order creation request`);
      createOrderAbortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    createOrderAbortControllerRef.current = new AbortController();
    const abortSignal = createOrderAbortControllerRef.current.signal;

    // Verify this request is still valid (not superseded by another call)
    if (createOrderRequestIdRef.current !== requestId) {
      logger.debug(`[${paymentMethod}] Order creation request superseded, aborting`);
      releaseOrderCreationLock();
      return;
    }

    orderCreatedRef.current = true;
    setPaymentError(null);
    setQueueFull(false);

    try {
      setIsLoading(true);
      logger.debug(`[${paymentMethod}] Creating order for program: ${selectedProgram.id} [requestId: ${requestId}]`);
      
      await createOrder({
        program_id: selectedProgram.id,
        payment_type: paymentMethod,
      }, abortSignal);

      // Verify request is still valid after async operation
      if (createOrderRequestIdRef.current !== requestId) {
        logger.debug(`[${paymentMethod}] Order creation completed but request was superseded`);
        releaseOrderCreationLock();
        return;
      }

      // Check if aborted
      if (abortSignal.aborted) {
        logger.info(`[${paymentMethod}] Order creation aborted after API call`);
        releaseOrderCreationLock();
        return;
      }
      
      logger.info(`[${paymentMethod}] Order creation API called successfully, waiting for order ID from WebSocket [requestId: ${requestId}]`);
      setIsLoading(false);
      // Don't release lock here - keep it until order is confirmed or fails
      // Lock will be released when order status changes or on error
    } catch (err: any) {
      // Verify request is still valid
      if (createOrderRequestIdRef.current !== requestId) {
        logger.debug(`[${paymentMethod}] Order creation error but request was superseded`);
        releaseOrderCreationLock();
        return;
      }

      // Don't show error if request was aborted (order completed or superseded)
      if (err?.name === 'AbortError' || abortSignal.aborted) {
        logger.info(`[${paymentMethod}] Order creation aborted (order likely completed or superseded)`);
        setIsLoading(false);
        releaseOrderCreationLock(true);
        return;
      }

      logger.error(`[${paymentMethod}] Error creating order [requestId: ${requestId}]`, err);
      setIsLoading(false);
      releaseOrderCreationLock(true);
      
      let errorMessage = t('Произошла ошибка при создании заказа');
      if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      setPaymentError(errorMessage);
    }
  }, [selectedProgram, paymentMethod, setIsLoading, t, acquireOrderCreationLock, releaseOrderCreationLock]);

  const checkPaymentStatus = useCallback(async () => {
    const currentOrderId = orderIdRef.current || order?.id;
    if (!currentOrderId || isPollingRef.current) {
      return;
    }

    isPollingRef.current = true;

    try {
      logger.debug(`[${paymentMethod}] Polling order status, orderId: ${currentOrderId}`);
      const orderDetails = await getOrderById(currentOrderId);
      
      const currentOrder = useStore.getState().order;
      
      if (currentOrder && currentOrder.status !== orderDetails.status) {
        setOrder({
          id: currentOrderId,
          status: orderDetails.status,
          programId: selectedProgram?.id,
          paymentMethod: paymentMethod,
          createdAt: currentOrder.createdAt,
        });
      }

      // Stop polling if order is completed or processing
      if (orderDetails.status === EOrderStatus.COMPLETED || orderDetails.status === EOrderStatus.PROCESSING) {
        logger.info(`[${paymentMethod}] Order status is ${orderDetails.status}, stopping polling`);
        clearAllTimers();
        return;
      }

      if (orderDetails.queue_position !== undefined) {
        const newQueuePosition = orderDetails.queue_position;
        setQueuePosition(newQueuePosition);
        setGlobalQueuePosition(newQueuePosition);
        
        if (newQueuePosition > PAYMENT_CONSTANTS.MAX_QUEUE_POSITION) {
          logger.info(`[${paymentMethod}] Queue is full, queuePosition: ${newQueuePosition}`);
          setQueueFull(true);
          setPaymentError(t('Очередь заполнена. В очереди уже находится один автомобиль. Пожалуйста, подождите окончания мойки.'));
          clearAllTimers();
          
          try {
            await cancelOrder(currentOrderId);
            logger.info(`[${paymentMethod}] Cancelled order due to full queue`);
            orderCreatedRef.current = false;
          } catch (cancelErr) {
            logger.error(`[${paymentMethod}] Error cancelling order`, cancelErr);
          }
          return;
        } else {
          setQueueFull(false);
        }
      }

      if (orderDetails.queue_number !== undefined) {
        setQueueNumber(orderDetails.queue_number);
        setGlobalQueueNumber(orderDetails.queue_number);
      }

      const amountSum = orderDetails.amount_sum ? Number(orderDetails.amount_sum) : 0;
      const expectedAmount = selectedProgram ? Number(selectedProgram.price) : 0;

      logger.debug(`[${paymentMethod}] Payment check - amountSum: ${amountSum}, expected: ${expectedAmount}, status: ${orderDetails.status}`);

      // If status is PAYED, trust it even if amountSum is 0 (might not be set yet for instant payments)
      if (orderDetails.status === EOrderStatus.PAYED) {
        if (amountSum >= expectedAmount || amountSum === 0) {
          // amountSum === 0 means it might not be set yet, but status is PAYED so trust it
          logger.info(`[${paymentMethod}] Payment confirmed! Status: PAYED, Amount: ${amountSum} (expected: ${expectedAmount})`);
          clearAllTimers();
          setPaymentError(null);
          setPaymentSuccess(true);
          setIsPaymentProcessing(false);
          // Start countdown immediately after payment success
          if (!countdownTimeoutRef.current && startCountdownRef.current) {
            logger.info(`[${paymentMethod}] Starting countdown immediately after payment confirmation`);
            startCountdownRef.current();
          }
          return;
        } else if (amountSum > 0 && amountSum < expectedAmount) {
          // Partial payment - show processing state
          logger.warn(`[${paymentMethod}] Partial payment detected: ${amountSum} < ${expectedAmount}`);
          setIsPaymentProcessing(true);
          setIsLoading(false);
          return;
        }
      }

      if (amountSum >= expectedAmount && orderDetails.status !== EOrderStatus.PAYED) {
        logger.debug(`[${paymentMethod}] Payment amount sufficient but status not PAYED yet, processing...`);
        setIsPaymentProcessing(true);
        setIsLoading(false);
        return;
      }

      setIsPaymentProcessing(false);
      setIsLoading(false);

    } catch (err) {
      logger.error(`[${paymentMethod}] Error checking payment status`, err);
      setIsPaymentProcessing(false);
      setIsLoading(false);
    } finally {
      isPollingRef.current = false;
    }
  }, [
    order?.id,
    selectedProgram?.id,
    selectedProgram?.price,
    paymentMethod,
    setOrder,
    setGlobalQueuePosition,
    setGlobalQueueNumber,
    clearAllTimers,
    setIsLoading,
    t
  ]);

  useEffect(() => {
    checkPaymentStatusRef.current = checkPaymentStatus;
  }, [checkPaymentStatus]);

  const startPolling = useCallback(() => {
    const currentOrderId = orderIdRef.current || order?.id;
    if (!currentOrderId) {
      logger.debug(`[${paymentMethod}] Cannot start polling: order ID not available yet`);
      return;
    }

    // Prevent duplicate polling
    if (pollingIntervalRef.current) {
      logger.debug(`[${paymentMethod}] Polling already started, skipping`);
      return;
    }

    // Clear any existing timeout first
    if (depositTimeoutRef.current) {
      clearTimeout(depositTimeoutRef.current);
      depositTimeoutRef.current = null;
    }

    logger.info(`[${paymentMethod}] Starting payment polling immediately for order: ${currentOrderId}`);
    
    pollingIntervalRef.current = setInterval(() => {
      if (checkPaymentStatusRef.current) {
        checkPaymentStatusRef.current();
      }
    }, PAYMENT_CONSTANTS.PAYMENT_INTERVAL);

    depositTimeoutRef.current = setTimeout(async () => {
      logger.info(`[${paymentMethod}] Payment timeout reached, cancelling order`);
      clearAllTimers();
      try {
        const orderId = orderIdRef.current || currentOrderId;
        if (orderId) {
          await cancelOrder(orderId);
          navigate("/");
        }
      } catch (e) {
        logger.error(`[${paymentMethod}] Error cancelling order on timeout`, e);
      }
    }, PAYMENT_CONSTANTS.DEPOSIT_TIME);

    // Initial check
    if (checkPaymentStatusRef.current) {
      checkPaymentStatusRef.current();
    }
  }, [order?.id, paymentMethod, clearAllTimers, navigate]);

  const startCountdown = useCallback(() => {
    if (countdownTimeoutRef.current) {
      return;
    }

    logger.debug(`[${paymentMethod}] Starting automatic robot start countdown`);
    const initialTime = PAYMENT_CONSTANTS.START_ROBOT_INTERVAL / 1000;
    setTimeUntilRobotStart(initialTime);

    countdownTimeoutRef.current = setTimeout(() => {
      logger.info(`[${paymentMethod}] Automatic robot start triggered`);
      if (handleStartRobotRef.current) {
        handleStartRobotRef.current();
      }
    }, PAYMENT_CONSTANTS.START_ROBOT_INTERVAL);

    countdownIntervalRef.current = setInterval(() => {
      setTimeUntilRobotStart(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [paymentMethod]);

  const handleBack = useCallback(async () => {
    // Clear any pending debounce
    if (createOrderDebounceTimeoutRef.current) {
      clearTimeout(createOrderDebounceTimeoutRef.current);
      createOrderDebounceTimeoutRef.current = null;
    }

    clearAllTimers();
    setIsLoading(false);
    setPaymentSuccess(false);
    setIsPaymentProcessing(false);
    setPaymentError(null);
    orderCreatedRef.current = false;
    releaseOrderCreationLock(true);
    
    if (order?.id) {
      try {
        await cancelOrder(order.id);
        logger.info(`[${paymentMethod}] Order cancelled on back button`);
      } catch (error) {
        logger.error(`[${paymentMethod}] Error cancelling order on back`, error);
      }
    }

    navigate(-1);
  }, [clearAllTimers, setIsLoading, order, paymentMethod, navigate, releaseOrderCreationLock]);

  const handleRetry = useCallback(() => {
    // Clear debounce timeout if any
    if (createOrderDebounceTimeoutRef.current) {
      clearTimeout(createOrderDebounceTimeoutRef.current);
      createOrderDebounceTimeoutRef.current = null;
    }

    setPaymentError(null);
    setIsPaymentProcessing(false);
    orderCreatedRef.current = false;
    releaseOrderCreationLock(true);
    
    // Debounce retry to prevent rapid clicks
    createOrderDebounceTimeoutRef.current = setTimeout(() => {
      createOrderDebounceTimeoutRef.current = null;
      createOrderAsync();
    }, 300); // 300ms debounce
  }, [createOrderAsync, releaseOrderCreationLock]);

  const handleStartRobot = useCallback(async () => {
    if (!order?.id) {
      logger.warn(`[${paymentMethod}] Cannot navigate: no order ID`);
      return;
    }

    if (!paymentSuccess) {
      logger.warn(`[${paymentMethod}] Cannot navigate: payment not confirmed`);
      setPaymentError(t('Оплата не подтверждена. Пожалуйста, дождитесь подтверждения.'));
      return;
    }

    try {
      logger.info(`[${paymentMethod}] Payment confirmed, checking queue position for navigation`);
      setIsLoading(true);
      
      const orderDetails = await getOrderById(order.id);
      
      const currentQueuePosition = orderDetails.queue_position ?? queuePosition;
      const currentQueueNumber = orderDetails.queue_number ?? queueNumber;
      
      logger.info(`[${paymentMethod}] Queue position: ${currentQueuePosition}, queue number: ${currentQueueNumber}`);

      if (currentQueuePosition !== null && currentQueuePosition !== 0) {
        logger.info(`[${paymentMethod}] User is in queue (position: ${currentQueuePosition}), navigating to queue waiting page`);
        clearAllTimers();
        setIsLoading(false);
        navigate('/queue-waiting');
      } else {
        logger.info(`[${paymentMethod}] Queue position is null or 0, navigating to success page (robot will start there)`);
        clearAllTimers();
        setIsLoading(false);
        navigate('/success');
      }
    } catch (error) {
      logger.error(`[${paymentMethod}] Error checking order status`, error);
      clearAllTimers();
      setIsLoading(false);
      navigate('/success');
    }
  }, [order, paymentMethod, paymentSuccess, queuePosition, queueNumber, clearAllTimers, navigate, setIsLoading, t]);

  useEffect(() => {
    handleStartRobotRef.current = handleStartRobot;
  }, [handleStartRobot]);

  useEffect(() => {
    startCountdownRef.current = startCountdown;
  }, [startCountdown]);

  useEffect(() => {
    // Prevent multiple calls if already creating order
    if (isCreatingOrderRef.current || orderCreatedRef.current) {
      logger.debug(`[${paymentMethod}] Skipping order creation: already in progress or created`);
      return;
    }

    // Clear any existing debounce timeout
    if (createOrderDebounceTimeoutRef.current) {
      clearTimeout(createOrderDebounceTimeoutRef.current);
      createOrderDebounceTimeoutRef.current = null;
    }

    logger.debug(`[${paymentMethod}] Component mounted, creating order`);
    
    // Small debounce to prevent rapid re-renders from triggering multiple calls
    createOrderDebounceTimeoutRef.current = setTimeout(() => {
      createOrderDebounceTimeoutRef.current = null;
      // Double-check before creating (component might have unmounted)
      if (!isCreatingOrderRef.current && !orderCreatedRef.current) {
        createOrderAsync();
      }
    }, 100); // 100ms debounce for mount
    
    return () => {
      // Clear debounce timeout on unmount
      if (createOrderDebounceTimeoutRef.current) {
        clearTimeout(createOrderDebounceTimeoutRef.current);
        createOrderDebounceTimeoutRef.current = null;
      }
      clearAllTimers();
    };
  }, [createOrderAsync, clearAllTimers, paymentMethod]);

  useEffect(() => {
    if (order?.id) {
      orderIdRef.current = order.id;
    }
  }, [order?.id]);

  useEffect(() => {
    // Start polling if:
    // 1. Order status is WAITING_PAYMENT OR PAYED (PAYED in case payment happened before polling started)
    // 2. Order was created (checked via ref)
    // 3. Polling is not already running (guard against duplicates)
    // 4. Payment success hasn't been set yet (don't poll if already paid)
    const shouldStartPolling = 
      (order?.status === EOrderStatus.WAITING_PAYMENT || order?.status === EOrderStatus.PAYED) &&
      orderCreatedRef.current && 
      !pollingIntervalRef.current &&
      !paymentSuccess;
    
    if (shouldStartPolling && order?.id) {
      logger.info(`[${paymentMethod}] Order status is ${order.status}, starting order-detail polling: ${order.id}`);
      orderIdRef.current = order.id;
      startPolling();
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (depositTimeoutRef.current) {
        clearTimeout(depositTimeoutRef.current);
        depositTimeoutRef.current = null;
      }
    };
    // Removed orderCreatedRef.current from dependencies - refs don't trigger re-renders
    // The ref is still checked in the effect body, which is the correct approach
  }, [order?.status, order?.id, paymentMethod, startPolling, paymentSuccess]);

  useEffect(() => {
    // Abort createOrder request if order is completed or processing
    if (order?.status === EOrderStatus.COMPLETED || order?.status === EOrderStatus.PROCESSING) {
      if (createOrderAbortControllerRef.current) {
        logger.info(`[${paymentMethod}] Order status is ${order.status}, aborting createOrder request`);
        createOrderAbortControllerRef.current.abort();
        createOrderAbortControllerRef.current = null;
      }
      // Release lock when order is confirmed (completed or processing)
      releaseOrderCreationLock();
    }
  }, [order?.status, paymentMethod, releaseOrderCreationLock]);

  useEffect(() => {
    // Only verify payment if:
    // 1. Order status is PAYED
    // 2. Payment success hasn't been set yet (guard against duplicates)
    // 3. Order was created (checked via ref)
    if (order?.status === EOrderStatus.PAYED && !paymentSuccess && orderCreatedRef.current) {
      logger.info(`[${paymentMethod}] Order status changed to PAYED, setting payment success`);
      
      const verifyPayment = async () => {
        if (!order.id) return;
        
        try {
          const orderDetails = await getOrderById(order.id);
          const amountSum = orderDetails.amount_sum ? Number(orderDetails.amount_sum) : 0;
          const expectedAmount = selectedProgram ? Number(selectedProgram.price) : 0;
          
          if (orderDetails.queue_position !== undefined) {
            const newQueuePosition = orderDetails.queue_position;
            setQueuePosition(newQueuePosition);
            setGlobalQueuePosition(newQueuePosition);
            
            if (newQueuePosition > PAYMENT_CONSTANTS.MAX_QUEUE_POSITION) {
              logger.info(`[${paymentMethod}] Queue is full after payment! queuePosition: ${newQueuePosition}`);
              setQueueFull(true);
              setPaymentError(t('Очередь заполнена. В очереди уже находится один автомобиль. Пожалуйста, подождите окончания мойки.'));
              setIsLoading(false);
              
              try {
                await cancelOrder(order.id);
                logger.info(`[${paymentMethod}] Cancelled order due to full queue`);
                orderCreatedRef.current = false;
                return;
              } catch (cancelErr) {
                logger.error(`[${paymentMethod}] Error cancelling order`, cancelErr);
              }
            } else {
              setQueueFull(false);
            }
          }
          
          if (orderDetails.queue_number !== undefined) {
            setQueueNumber(orderDetails.queue_number);
            setGlobalQueueNumber(orderDetails.queue_number);
          }
          
          // If status is PAYED, trust it even if amountSum is not yet available
          // This handles cases where payment happens instantly and amountSum hasn't been set yet
          if (orderDetails.status === EOrderStatus.PAYED) {
            if (amountSum >= expectedAmount || amountSum === 0) {
              // amountSum === 0 means it might not be set yet, but status is PAYED so trust it
              logger.info(`[${paymentMethod}] Payment confirmed! Status: PAYED, Amount: ${amountSum} (expected: ${expectedAmount})`);
              clearAllTimers();
              setPaymentError(null);
              setPaymentSuccess(true);
              setIsPaymentProcessing(false);
              setIsLoading(false);
              // Start countdown immediately after payment success
              if (!countdownTimeoutRef.current && startCountdownRef.current) {
                logger.info(`[${paymentMethod}] Starting countdown immediately after payment verification`);
                startCountdownRef.current();
              }
            } else if (amountSum > 0 && amountSum < expectedAmount) {
              // Partial payment - show processing state
              logger.warn(`[${paymentMethod}] Partial payment detected: ${amountSum} < ${expectedAmount}`);
              setIsPaymentProcessing(true);
              setIsLoading(false);
            } else {
              // Status is PAYED but amount check failed - still trust the status
              logger.warn(`[${paymentMethod}] Payment status is PAYED but amount verification unclear. Trusting status.`);
              clearAllTimers();
              setPaymentError(null);
              setPaymentSuccess(true);
              setIsPaymentProcessing(false);
              setIsLoading(false);
              if (!countdownTimeoutRef.current && startCountdownRef.current) {
                logger.info(`[${paymentMethod}] Starting countdown after PAYED status verification`);
                startCountdownRef.current();
              }
            }
          } else {
            setIsPaymentProcessing(true);
            setIsLoading(false);
          }
        } catch (err) {
          logger.error(`[${paymentMethod}] Error verifying payment`, err);
          setIsPaymentProcessing(false);
          setIsLoading(false);
        }
      };
      
      verifyPayment();
    }
    // Removed orderCreatedRef.current from dependencies - refs don't trigger re-renders
    // The ref is still checked in the effect body, which is the correct approach
    // The !paymentSuccess guard also prevents duplicate execution
  }, [order?.status, order?.id, paymentSuccess, paymentMethod, selectedProgram, setOrder, setGlobalQueuePosition, setGlobalQueueNumber, clearAllTimers, setIsLoading, t]);

  useEffect(() => {
    if (paymentSuccess) {
      // Small delay to ensure state updates are processed
      const timeoutId = setTimeout(() => {
        if (!countdownTimeoutRef.current && startCountdownRef.current) {
          logger.info(`[${paymentMethod}] Payment success detected in useEffect, starting auto-launch countdown`);
          startCountdownRef.current();
        } else {
          logger.debug(`[${paymentMethod}] Countdown already started or ref not available, skipping`);
        }
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [paymentSuccess, paymentMethod]);

  const simulateCardTap = useCallback(() => {
    logger.debug('[TEST] Simulating card tap - updating order status');
    
    if (!order || !order.id) {
      logger.warn('[TEST] No order found, cannot simulate card tap');
      setPaymentError('No order found. Order should be created on mount.');
      return;
    }
    
    logger.info('[TEST] Simulating card tap - updating order to PAYED status');
    setPaymentError(null);
    setQueueFull(false);
    
    setOrder({
      ...order,
      status: EOrderStatus.PAYED,
    });
    
    logger.info('[TEST] Order status updated to PAYED, payment success should trigger');
  }, [order, setOrder]);

  const { bankCheck } = useStore();

  return {
    handleBack,
    selectedProgram,
    order,
    paymentSuccess,
    isPaymentProcessing,
    handleStartRobot,
    handleRetry,
    timeUntilRobotStart,
    queuePosition,
    queueNumber,
    paymentError,
    bankCheck,
    ...(import.meta.env.DEV && { simulateCardTap }),
    queueFull
  };
};
