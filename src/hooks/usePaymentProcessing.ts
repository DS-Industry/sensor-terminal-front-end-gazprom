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
  const isPollingRef = useRef(false);
  const orderIdRef = useRef<string | undefined>(undefined);
  const checkPaymentStatusRef = useRef<() => Promise<void>>();
  const handleStartRobotRef = useRef<() => Promise<void>>();
  const createOrderAbortControllerRef = useRef<AbortController | null>(null);

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
    isPollingRef.current = false;
    setTimeUntilRobotStart(0);
  }, []);

  const createOrderAsync = useCallback(async () => {
    if (!selectedProgram || orderCreatedRef.current) {
      logger.warn(`[${paymentMethod}] Cannot create order: missing program or already created`);
      return;
    }

    // Abort any existing createOrder request
    if (createOrderAbortControllerRef.current) {
      createOrderAbortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    createOrderAbortControllerRef.current = new AbortController();
    const abortSignal = createOrderAbortControllerRef.current.signal;

    orderCreatedRef.current = true;
    setPaymentError(null);
    setQueueFull(false);

    try {
      setIsLoading(true);
      logger.debug(`[${paymentMethod}] Creating order for program: ${selectedProgram.id}`);
      
      await createOrder({
        program_id: selectedProgram.id,
        payment_type: paymentMethod,
      }, abortSignal);
      
      logger.info(`[${paymentMethod}] Order creation API called successfully, waiting for order ID from WebSocket`);
      setIsLoading(false);
    } catch (err: any) {
      // Don't show error if request was aborted (order completed)
      if (err?.name === 'AbortError' || abortSignal.aborted) {
        logger.info(`[${paymentMethod}] Order creation aborted (order likely completed)`);
        setIsLoading(false);
        return;
      }

      logger.error(`[${paymentMethod}] Error creating order`, err);
      setIsLoading(false);
      orderCreatedRef.current = false;
      
      let errorMessage = t('Произошла ошибка при создании заказа');
      if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      setPaymentError(errorMessage);
    }
  }, [selectedProgram, paymentMethod, setIsLoading, t]);

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

      if (orderDetails.status === EOrderStatus.PAYED && amountSum >= expectedAmount) {
        logger.info(`[${paymentMethod}] Payment confirmed! Status: PAYED, Amount: ${amountSum}`);
        clearAllTimers();
        setPaymentError(null);
        setPaymentSuccess(true);
        setIsPaymentProcessing(false);
        return;
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

    if (pollingIntervalRef.current) {
      logger.debug(`[${paymentMethod}] Polling already started, skipping`);
      return;
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
    clearAllTimers();
    setIsLoading(false);
    setPaymentSuccess(false);
    setIsPaymentProcessing(false);
    setPaymentError(null);
    orderCreatedRef.current = false;
    
    if (order?.id) {
      try {
        await cancelOrder(order.id);
        logger.info(`[${paymentMethod}] Order cancelled on back button`);
      } catch (error) {
        logger.error(`[${paymentMethod}] Error cancelling order on back`, error);
      }
    }

    navigate(-1);
  }, [clearAllTimers, setIsLoading, order, paymentMethod, navigate]);

  const handleRetry = useCallback(() => {
    setPaymentError(null);
    setIsPaymentProcessing(false);
    orderCreatedRef.current = false;
    createOrderAsync();
  }, [createOrderAsync]);

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
    logger.debug(`[${paymentMethod}] Component mounted, creating order`);
    createOrderAsync();
    
    return () => {
      clearAllTimers();
    };
  }, [createOrderAsync, clearAllTimers, paymentMethod]);

  useEffect(() => {
    if (order?.id) {
      orderIdRef.current = order.id;
    }
  }, [order?.id]);

  useEffect(() => {
    if (order?.status === EOrderStatus.WAITING_PAYMENT && orderCreatedRef.current && !pollingIntervalRef.current) {
      logger.info(`[${paymentMethod}] Order status is WAITING_PAYMENT, starting order-detail polling: ${order.id}`);
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
  }, [order?.status, order?.id, orderCreatedRef.current, paymentMethod, startPolling]);

  useEffect(() => {
    // Abort createOrder request if order is completed or processing
    if (order?.status === EOrderStatus.COMPLETED || order?.status === EOrderStatus.PROCESSING) {
      if (createOrderAbortControllerRef.current) {
        logger.info(`[${paymentMethod}] Order status is ${order.status}, aborting createOrder request`);
        createOrderAbortControllerRef.current.abort();
        createOrderAbortControllerRef.current = null;
      }
    }
  }, [order?.status, paymentMethod]);

  useEffect(() => {
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
          
          if (orderDetails.status === EOrderStatus.PAYED && amountSum >= expectedAmount) {
            clearAllTimers();
            setPaymentError(null);
            setPaymentSuccess(true);
            setIsPaymentProcessing(false);
            setIsLoading(false);
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
  }, [order?.status, order?.id, paymentSuccess, orderCreatedRef.current, paymentMethod, selectedProgram, setOrder, setGlobalQueuePosition, setGlobalQueueNumber, clearAllTimers, setIsLoading, t]);

  useEffect(() => {
    if (paymentSuccess && !countdownTimeoutRef.current) {
      startCountdown();
    }
  }, [paymentSuccess, startCountdown]);

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
