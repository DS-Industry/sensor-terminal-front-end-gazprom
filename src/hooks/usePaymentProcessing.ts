import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useStore from '../components/state/store';
import { cancelOrder, createOrder, getOrderById, startRobot } from '../api/services/payment';
import { EOrderStatus, EPaymentMethod } from '../components/state/order/orderSlice';
import { AxiosError } from 'axios';
import { logger } from '../util/logger';
import { PAYMENT_CONSTANTS } from '../constants/payment';

// Note: setOrder is needed for simulateCardTap test function

export const usePaymentProcessing = (paymentMethod: EPaymentMethod) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    order,
    selectedProgram,
    setIsLoading,
    setInsertedAmount,
    clearOrder,
    setOrder,
    setQueuePosition: setGlobalQueuePosition,
    setQueueNumber: setGlobalQueueNumber
  } = useStore();

  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [timeUntilRobotStart, setTimeUntilRobotStart] = useState(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueNumber, setQueueNumber] = useState<number | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [queueFull, setQueueFull] = useState(false);

  const orderCreatedRef = useRef(false);
  const depositTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkOrderAmountSumIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownStartedRef = useRef(false);

  const clearPaymentTimers = useCallback(() => {
    if (depositTimeoutRef.current) {
      clearTimeout(depositTimeoutRef.current);
      depositTimeoutRef.current = null;
    }
    if (checkOrderAmountSumIntervalRef.current) {
      clearInterval(checkOrderAmountSumIntervalRef.current);
      checkOrderAmountSumIntervalRef.current = null;
    }
  }, []);

  const clearCountdown = useCallback(() => {
    countdownStartedRef.current = false;
    if (idleTimeout.current) {
      clearTimeout(idleTimeout.current);
      idleTimeout.current = null;
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    setTimeUntilRobotStart(0);
  }, []);

  const clearAllTimers = useCallback(() => {
    clearPaymentTimers();
    clearCountdown();
  }, [clearPaymentTimers, clearCountdown]);

  const createOrderAsync = useCallback(async (ucn?: string) => {
    if (!selectedProgram || orderCreatedRef.current) {
      logger.warn(`[${paymentMethod}] Failed to create order: missing program or order already created`);
      return;
    }

    if (queuePosition !== null && queuePosition >= PAYMENT_CONSTANTS.MAX_QUEUE_POSITION) {
      logger.info(`[${paymentMethod}] Queue is full, queuePosition: ${queuePosition}`);
      setQueueFull(true);
      setPaymentError(t('Очередь заполнена. Пожалуйста, подождите.'));
      setIsLoading(false);
      return;
    }

    orderCreatedRef.current = true;
    setPaymentError(null);
    setQueueFull(false);

    try {
      setIsLoading(true);
      const response = await createOrder({
        program_id: selectedProgram.id,
        payment_type: paymentMethod,
        ucn: ucn,
      });
      logger.debug(`[${paymentMethod}] Order created ${ucn ? 'with UCN' : 'without UCN'}`);
      
      if (response.qr_code) {
        logger.debug(`[${paymentMethod}] Received QR code from createOrder response`);
        setQrCode(response.qr_code);
      }
    } catch (err) {
      logger.error(`[${paymentMethod}] Error creating order`, err);
      setIsLoading(false);
      
      let errorMessage = t('Произошла ошибка при создании заказа');
      
      if (err instanceof AxiosError) {
        const errorData = err.response?.data;
        if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (err.message) {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setPaymentError(errorMessage);
      orderCreatedRef.current = false;
    }
  }, [selectedProgram, paymentMethod, queuePosition, setIsLoading, t]);

  const checkPaymentAsync = useCallback(async () => {
    try {
      if (!order?.id) {
        return;
      }

      logger.debug(`[${paymentMethod}] Checking order status, orderId: ${order.id}`);
      const orderDetails = await getOrderById(order.id);
      logger.debug(`[${paymentMethod}] Received order details`);

      if (orderDetails.queue_position !== undefined) {
        const newQueuePosition = orderDetails.queue_position;
        const previousQueuePosition = queuePosition;
        setQueuePosition(newQueuePosition);
        setGlobalQueuePosition(newQueuePosition);
        
        if (newQueuePosition >= PAYMENT_CONSTANTS.MAX_QUEUE_POSITION) {
          logger.info(`[${paymentMethod}] Queue is full! queuePosition: ${newQueuePosition}`);
          setQueueFull(true);
          setPaymentError(t('Очередь заполнена. В очереди уже находится один автомобиль. Пожалуйста, подождите окончания мойки.'));
          
          if (order?.id && order?.status !== EOrderStatus.PAYED) {
            try {
              await cancelOrder(order.id);
              logger.info(`[${paymentMethod}] Cancelled order due to full queue`);
              orderCreatedRef.current = false;
            } catch (cancelErr) {
              logger.error(`[${paymentMethod}] Error cancelling order`, cancelErr);
            }
          }
        } else {
          setQueueFull(false);
          
          if (previousQueuePosition !== null && previousQueuePosition >= 1 && (newQueuePosition === 0 || newQueuePosition === null)) {
            logger.info(`[${paymentMethod}] Washing completed, queue cleared`);
          }
        }
      }

      if (orderDetails.queue_number !== undefined) {
        setQueueNumber(orderDetails.queue_number);
        setGlobalQueueNumber(orderDetails.queue_number);
      }

      if (orderDetails.amount_sum) {
        const amountSum = Number(orderDetails.amount_sum);
        logger.debug(`[${paymentMethod}] Amount inserted: ${amountSum}`);

        if (amountSum > 0 && depositTimeoutRef.current) {
          clearTimeout(depositTimeoutRef.current);
          depositTimeoutRef.current = null;
        }

        if (amountSum >= Number(selectedProgram?.price)) {
          logger.info(`[${paymentMethod}] Full amount received`);
          
          if (orderDetails.queue_position !== undefined && orderDetails.queue_position >= PAYMENT_CONSTANTS.MAX_QUEUE_POSITION) {
            logger.info(`[${paymentMethod}] Queue is full when receiving payment! queuePosition: ${orderDetails.queue_position}`);
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
            clearAllTimers();
            setPaymentSuccess(true);
          }
        }
      }
    } catch (e) {
      logger.error(`[${paymentMethod}] Error checking payment status`, e);
    }
  }, [order, paymentMethod, queuePosition, selectedProgram, setIsLoading, setGlobalQueuePosition, setGlobalQueueNumber, clearAllTimers, t]);

  const handleBack = useCallback(async () => {
    clearAllTimers();
    setIsLoading(false);
    setPaymentSuccess(false);
    setPaymentError(null);
    clearCountdown();
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
  }, [clearAllTimers, setIsLoading, clearCountdown, order, paymentMethod, navigate]);

  const handleRetry = useCallback(() => {
    setPaymentError(null);
    orderCreatedRef.current = false;
    createOrderAsync();
  }, [createOrderAsync]);

  const handleStartRobot = useCallback(() => {
    if (order?.id) {
      logger.info(`[${paymentMethod}] Starting robot for order: ${order.id}`);
      startRobot(order.id).catch((error) => {
        logger.error(`[${paymentMethod}] Error starting robot`, error);
      });
      clearCountdown();
      navigate('/success');
    }
  }, [order, paymentMethod, clearCountdown, navigate]);

  const handlePayInAdvance = useCallback(() => {
    logger.info(`[${paymentMethod}] Pay in advance - starting new process`);
    clearAllTimers();
    clearOrder();
    setPaymentSuccess(false);
    setQueuePosition(null);
    setQueueNumber(null);
    setInsertedAmount(0);
    setIsLoading(false);
    orderCreatedRef.current = false;
    navigate("/");
  }, [clearAllTimers, clearOrder, setIsLoading, setInsertedAmount, navigate, paymentMethod]);

  const startCountdown = useCallback(() => {
    if (countdownStartedRef.current) {
      logger.debug(`[${paymentMethod}] Countdown already started, skipping`);
      return;
    }

    logger.debug(`[${paymentMethod}] Starting automatic start countdown`);
    countdownStartedRef.current = true;
    
    const initialTime = PAYMENT_CONSTANTS.START_ROBOT_INTERVAL / 1000;
    setTimeUntilRobotStart(initialTime);

    idleTimeout.current = setTimeout(() => {
      logger.info(`[${paymentMethod}] Automatic robot start triggered`);
      handleStartRobot();
    }, PAYMENT_CONSTANTS.START_ROBOT_INTERVAL);

    countdownInterval.current = setInterval(() => {
      setTimeUntilRobotStart(prev => {
        if (prev <= 1) {
          logger.debug(`[${paymentMethod}] Countdown completed`);
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [paymentMethod, handleStartRobot]);

  useEffect(() => {
    logger.debug(`[${paymentMethod}] Creating order`);
    createOrderAsync();
    
    return () => {
      clearAllTimers();
    };
  }, [createOrderAsync, clearAllTimers, paymentMethod]);

  useEffect(() => {
    if (order?.status === EOrderStatus.WAITING_PAYMENT) {
      setIsLoading(false);

      depositTimeoutRef.current = setTimeout(async () => {
        try {
          if (order.id) {
            logger.info(`[${paymentMethod}] Order timeout, cancelling order`);
            await cancelOrder(order.id);
            navigate("/");
          }
        } catch (e) {
          logger.error(`[${paymentMethod}] Error cancelling order on timeout`, e);
        }
      }, PAYMENT_CONSTANTS.DEPOSIT_TIME);

      checkOrderAmountSumIntervalRef.current = setInterval(checkPaymentAsync, PAYMENT_CONSTANTS.PAYMENT_INTERVAL);
    }

    return () => {
      clearPaymentTimers();
    };
  }, [order, paymentMethod, navigate, checkPaymentAsync, clearPaymentTimers, setIsLoading]);

  useEffect(() => {
    if (order?.status === EOrderStatus.PAYED && !paymentSuccess && orderCreatedRef.current) {
      logger.info(`[${paymentMethod}] Order status changed to PAYED`);
      
      const checkQueueAfterPayment = async () => {
        if (!order?.id) {
          return;
        }

        // Check if this is a test order (starts with 'test-order-')
        const isTestOrder = order.id.startsWith('test-order-');
        
        if (isTestOrder) {
          // For test orders, skip API call and directly set success
          logger.debug(`[${paymentMethod}] Test order detected, skipping API call`);
          setQueueFull(false);
          setQueuePosition(0);
          setGlobalQueuePosition(0);
          clearAllTimers();
          setPaymentSuccess(true);
          setIsLoading(false);
          return;
        }

        try {
          const orderDetails = await getOrderById(order.id);
          
          if (orderDetails.queue_position !== undefined) {
            const newQueuePosition = orderDetails.queue_position;
            setQueuePosition(newQueuePosition);
            setGlobalQueuePosition(newQueuePosition);
            
            if (newQueuePosition >= PAYMENT_CONSTANTS.MAX_QUEUE_POSITION) {
              logger.info(`[${paymentMethod}] Queue is full after payment! queuePosition: ${newQueuePosition}`);
              setQueueFull(true);
              setPaymentError(t('Очередь заполнена. В очереди уже находится один автомобиль. Пожалуйста, подождите окончания мойки.'));
              setIsLoading(false);
              
              try {
                await cancelOrder(order.id);
                logger.info(`[${paymentMethod}] Cancelled order due to full queue`);
                orderCreatedRef.current = false;
                setGlobalQueuePosition(null);
                return;
              } catch (cancelErr) {
                logger.error(`[${paymentMethod}] Error cancelling order`, cancelErr);
              }
            } else {
              setQueueFull(false);
              clearAllTimers();
              setPaymentSuccess(true);
            }
          } else {
            setGlobalQueuePosition(null);
            clearAllTimers();
            setPaymentSuccess(true);
          }
          
          if (orderDetails.queue_number !== undefined) {
            setQueueNumber(orderDetails.queue_number);
            setGlobalQueueNumber(orderDetails.queue_number);
          }
        } catch (err) {
          logger.error(`[${paymentMethod}] Error checking queue after payment`, err);
          clearAllTimers();
          setPaymentSuccess(true);
        }
      };
      
      checkQueueAfterPayment();
    }
  }, [order?.status, order?.id, paymentSuccess, paymentMethod, setIsLoading, setGlobalQueuePosition, setGlobalQueueNumber, clearAllTimers, t]);

  useEffect(() => {
    if (paymentSuccess && !countdownStartedRef.current) {
      logger.debug(`[${paymentMethod}] Payment successful, starting countdown`);
      startCountdown();
    }
  }, [paymentSuccess, paymentMethod, startCountdown]);

  const isWashingInProgress = queuePosition !== null && queuePosition >= 1;

  // Test function to simulate card tap success
  const simulateCardTap = useCallback(() => {
    logger.debug('[TEST] Simulating card tap success');
    
    // Ensure order exists and has an ID, or create one
    if (!order || !order.id) {
      logger.warn('[TEST] No order found, creating test order');
      if (!selectedProgram) {
        logger.error('[TEST] Cannot create test order: no selected program');
        setPaymentError('No program selected. Please select a program first.');
        return;
      }
      
      const testOrderId = 'test-order-' + Date.now();
      const testOrder = {
        id: testOrderId,
        programId: selectedProgram.id,
        status: EOrderStatus.PAYED,
        paymentMethod: paymentMethod,
        createdAt: new Date().toISOString(),
        transactionId: 'test-transaction-' + Date.now(),
      };
      
      // Set orderCreatedRef to true so the payment success flow triggers
      orderCreatedRef.current = true;
      
      // Clear any errors and timers first
      setPaymentError(null);
      setQueueFull(false);
      setIsLoading(false);
      clearAllTimers();
      
      // Update order in store - this will trigger the useEffect
      setOrder(testOrder);
      
      logger.debug('[TEST] Test order created, useEffect should trigger payment success');
      return;
    }
    
    // If order exists, update its status to PAYED
    logger.debug('[TEST] Updating existing order to PAYED status', order.id);
    
    // Ensure orderCreatedRef is true so the useEffect triggers
    if (!orderCreatedRef.current) {
      orderCreatedRef.current = true;
      logger.debug('[TEST] Set orderCreatedRef to true');
    }
    
    // Clear any errors and timers
    setPaymentError(null);
    setQueueFull(false);
    setIsLoading(false);
    clearAllTimers();
    
    // Update order status to PAYED - this will trigger the useEffect at line 322
    setOrder({
      ...order,
      status: EOrderStatus.PAYED,
    });
    
    logger.debug('[TEST] Order status updated to PAYED, useEffect should trigger payment success');
  }, [order, selectedProgram, paymentMethod, setOrder, clearAllTimers, setIsLoading]);

  return {
    handleBack,
    selectedProgram,
    order,
    paymentSuccess,
    handleStartRobot,
    handlePayInAdvance,
    handleRetry,
    timeUntilRobotStart,
    queuePosition,
    queueNumber,
    isWashingInProgress,
    qrCode,
    paymentError,
    simulateCardTap,
    queueFull
  };
};
