import { useEffect, useCallback, useRef } from 'react';
import { getOrderById, cancelOrder } from '../../api/services/payment';
import { EOrderStatus, EPaymentMethod } from '../../components/state/order/orderSlice';
import { PaymentState } from '../../state/paymentStateMachine';
import { PAYMENT_CONSTANTS } from '../../constants/payment';
import { logger } from '../../util/logger';
import useStore from '../../components/state/store';
import { globalWebSocketManager, type WebSocketMessage } from '../../util/websocketManager';
import { IProgram } from '../../api/types/program';

interface UsePaymentWebSocketOptions {
  orderId: string | undefined;
  selectedProgram: IProgram | null;
  paymentMethod: EPaymentMethod;
}

export function usePaymentWebSocket({ orderId, selectedProgram, paymentMethod }: UsePaymentWebSocketOptions) {
  const {
    order,
    setOrder,
    setQueuePosition,
    setQueueNumber,
    setPaymentState,
    setPaymentError,
    setIsLoading,
    setBankCheck,
    setOptiQrCode,
  } = useStore();

  const depositTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const hasFetchedPayedDetailsRef = useRef(false);
  const checkAmountIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAmountSumRef = useRef<number>(0);

  const safeSetPaymentState = useCallback((newState: PaymentState) => {
    const currentState = useStore.getState().paymentState;
    
    if (currentState === PaymentState.PAYMENT_SUCCESS) {
      const allowedTransitions = [
        PaymentState.QUEUE_WAITING,
        PaymentState.STARTING_ROBOT,
        PaymentState.ROBOT_STARTED,
        PaymentState.PAYMENT_ERROR, 
      ];
      
      if (!allowedTransitions.includes(newState)) {
        logger.debug(`[${paymentMethod}] Blocked payment state change from PAYMENT_SUCCESS to ${newState}`);
        return;
      }
    }
    
    setPaymentState(newState);
  }, [paymentMethod, setPaymentState]);

  const fetchOrderDetailsOnPayed = useCallback(async (orderId: string) => {
    if (hasFetchedPayedDetailsRef.current) {
      logger.debug(`[${paymentMethod}] Already fetched order details for PAYED status`);
      return;
    }

    try {
      logger.info(`[${paymentMethod}] Fetching order details after PAYED status received`);
      const orderDetails = await getOrderById(orderId);

      if (!isMountedRef.current) return;

      hasFetchedPayedDetailsRef.current = true;

      if (orderDetails.queue_position !== undefined) {
        const newQueuePosition = orderDetails.queue_position;
        setQueuePosition(newQueuePosition);
        logger.debug(`[${paymentMethod}] Queue position: ${newQueuePosition}`);

        if (newQueuePosition > PAYMENT_CONSTANTS.MAX_QUEUE_POSITION) {
          logger.info(`[${paymentMethod}] Queue is full, queuePosition: ${newQueuePosition}`);
          safeSetPaymentState(PaymentState.QUEUE_FULL);
          setPaymentError('Очередь заполнена. В очереди уже находится один автомобиль. Пожалуйста, подождите окончания мойки.');
          
          try {
            await cancelOrder(orderId);
            logger.info(`[${paymentMethod}] Cancelled order due to full queue`);
          } catch (cancelErr) {
            logger.error(`[${paymentMethod}] Error cancelling order`, cancelErr);
          }
          return;
        }
      }

      if (orderDetails.queue_number !== undefined) {
        setQueueNumber(orderDetails.queue_number);
      }

      if (orderDetails.qr_code) {
        logger.debug(`[${paymentMethod}] QR code received in initial fetch: ${orderDetails.qr_code}`);
        
        if (paymentMethod === EPaymentMethod.OPTI) {
          logger.debug(`[${paymentMethod}] Skipping QR code from API for OPTI - it comes only via WebSocket`);
        } else {
          setBankCheck(orderDetails.qr_code);
        }
      } else {
        if (paymentMethod === EPaymentMethod.OPTI) {
          logger.debug(`[${paymentMethod}] QR code not in API response - waiting for WebSocket order_qr_opti message`);
        } else {
          logger.debug(`[${paymentMethod}] QR code not available in initial fetch - will be polled after PAYMENT_SUCCESS`);
        }
      }

      const amountSum = orderDetails.amount_sum ? Number(orderDetails.amount_sum) : 0;
      const expectedAmount = selectedProgram ? Number(selectedProgram.price) : 0;

      logger.debug(`[${paymentMethod}] Payment verification - amountSum: ${amountSum}, expected: ${expectedAmount}`);

      if (amountSum >= expectedAmount || amountSum === 0) {
        logger.info(`[${paymentMethod}] Payment confirmed! Amount: ${amountSum} (expected: ${expectedAmount})`);
        setPaymentError(null);
        safeSetPaymentState(PaymentState.PAYMENT_SUCCESS);
        setIsLoading(false);
      } else if (amountSum > 0 && amountSum < expectedAmount) {
        logger.warn(`[${paymentMethod}] Partial payment detected: ${amountSum} < ${expectedAmount}`);
        safeSetPaymentState(PaymentState.PROCESSING_PAYMENT);
        setIsLoading(true);
      }
    } catch (err) {
      logger.error(`[${paymentMethod}] Error fetching order details on PAYED`, err);
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [paymentMethod, selectedProgram, setQueuePosition, setQueueNumber, safeSetPaymentState, setPaymentError, setIsLoading, setBankCheck, setOptiQrCode]);

  const handleOrderQrOpti = useCallback((data: WebSocketMessage) => {
    if (data.type !== 'order_qr_opti' || !data.order_id) {
      return;
    }

    const currentOrder = useStore.getState().order;
    
    if (!currentOrder || currentOrder.id !== data.order_id) {
      logger.debug(`[${paymentMethod}] Ignoring order_qr_opti for different order: ${data.order_id} (current: ${currentOrder?.id || 'none'})`);
      return;
    }

    logger.info(`[${paymentMethod}] Received order_qr_opti message for order ${data.order_id}`);

    setOrder({
      ...currentOrder,
      id: data.order_id,
      transactionId: data.transaction_id,
      status: currentOrder.status || EOrderStatus.WAITING_PAYMENT,
    });

    if (data.qr) {
      logger.info(`[${paymentMethod}] Setting OPTI QR code from WebSocket message (length: ${data.qr.length})`);
      const qrDataUrl = `data:image/png;base64,${data.qr}`;
      setOptiQrCode(qrDataUrl);

      console.log("qrDataUrl: ", qrDataUrl)
      
      const currentPaymentState = useStore.getState().paymentState;
      if (currentPaymentState === PaymentState.CREATING_ORDER || currentPaymentState === PaymentState.WAITING_PAYMENT) {
        logger.info(`[${paymentMethod}] QR code received, payment state remains WAITING_PAYMENT`);
      }
    } else {
      logger.warn(`[${paymentMethod}] order_qr_opti message received but qr field is empty`);
    }
  }, [paymentMethod, setOptiQrCode, setOrder]);

  useEffect(() => {
    isMountedRef.current = true;
    hasFetchedPayedDetailsRef.current = false;

    const handleStatusUpdate = async (data: WebSocketMessage) => {
      
      if (data.type !== 'status_update' || !data.order_id) {
        return;
      }

      const currentOrder = useStore.getState().order;
      
      if (!currentOrder || currentOrder.id !== data.order_id) {
        logger.debug(`[${paymentMethod}] Ignoring status update for order ${data.order_id} (current order: ${currentOrder?.id || 'none'})`);
        return;
      }

      const orderStatus = data.status as EOrderStatus | undefined;
      if (!orderStatus) return;

      logger.debug(`[${paymentMethod}] WebSocket status update: ${orderStatus} for order ${data.order_id}`);
      setOrder({
        ...currentOrder,
        status: orderStatus,
        transactionId: data.transaction_id,
      });

      const effectiveOrderId = data.order_id;

      if (orderStatus === EOrderStatus.PAYED) {
        await fetchOrderDetailsOnPayed(effectiveOrderId);
      } else if (orderStatus === EOrderStatus.COMPLETED) {
        if (depositTimeoutRef.current) {
          clearTimeout(depositTimeoutRef.current);
          depositTimeoutRef.current = null;
        }
        setIsLoading(false);
      } else if (orderStatus === EOrderStatus.PROCESSING) {
        if (depositTimeoutRef.current) {
          clearTimeout(depositTimeoutRef.current);
          depositTimeoutRef.current = null;
        }
        setIsLoading(false);
      } else if (orderStatus === EOrderStatus.WAITING_PAYMENT) {
        const currentPaymentState = useStore.getState().paymentState;
        if (currentPaymentState === PaymentState.PAYMENT_SUCCESS) {
          logger.debug(`[${paymentMethod}] Payment already successful, ignoring WAITING_PAYMENT status update`);
          return;
        }
        
        if (checkAmountIntervalRef.current) {
          clearInterval(checkAmountIntervalRef.current);
        }
        
        checkAmountIntervalRef.current = setInterval(async () => {
          const latestOrder = useStore.getState().order;
          if (!latestOrder || latestOrder.id !== effectiveOrderId || !isMountedRef.current) {
            if (checkAmountIntervalRef.current) {
              clearInterval(checkAmountIntervalRef.current);
              checkAmountIntervalRef.current = null;
            }
            return;
          }
          
          try {
            const orderDetails = await getOrderById(effectiveOrderId);
            const amountSum = orderDetails.amount_sum ? Number(orderDetails.amount_sum) : 0;
            
            if (amountSum > lastAmountSumRef.current && amountSum > 0) {
              logger.info(`[${paymentMethod}] Card detected! Amount: ${amountSum}, setting processing state`);
              safeSetPaymentState(PaymentState.PROCESSING_PAYMENT);
              setIsLoading(true);
              
              if (checkAmountIntervalRef.current) {
                clearInterval(checkAmountIntervalRef.current);
                checkAmountIntervalRef.current = null;
              }
            }
            
            lastAmountSumRef.current = amountSum;
          } catch (err) {
            logger.error(`[${paymentMethod}] Error checking amount for card detection`, err);
          }
        }, 500);
        
        if (depositTimeoutRef.current) {
          clearTimeout(depositTimeoutRef.current);
        }

        depositTimeoutRef.current = setTimeout(async () => {
          logger.info(`[${paymentMethod}] Payment timeout reached, cancelling order`);
          if (checkAmountIntervalRef.current) {
            clearInterval(checkAmountIntervalRef.current);
            checkAmountIntervalRef.current = null;
          }
          try {
            const latestOrder = useStore.getState().order;
            if (latestOrder?.id === effectiveOrderId && isMountedRef.current) {
              await cancelOrder(effectiveOrderId);
            }
          } catch (e) {
            logger.error(`[${paymentMethod}] Error cancelling order on timeout`, e);
          }
        }, PAYMENT_CONSTANTS.DEPOSIT_TIME);
      }
    };

    const removeStatusListener = globalWebSocketManager.addListener('status_update', handleStatusUpdate);
    const removeQrOptiListener = globalWebSocketManager.addListener('order_qr_opti', handleOrderQrOpti);

    const currentOrder = useStore.getState().order;
    if (currentOrder?.status === EOrderStatus.WAITING_PAYMENT && currentOrder?.id) {
      depositTimeoutRef.current = setTimeout(async () => {
        logger.info(`[${paymentMethod}] Payment timeout reached, cancelling order`);
        try {
          const latestOrder = useStore.getState().order;
          if (latestOrder?.id === currentOrder.id && currentOrder.id && isMountedRef.current) {
            await cancelOrder(currentOrder.id);
          }
        } catch (e) {
          logger.error(`[${paymentMethod}] Error cancelling order on timeout`, e);
        }
      }, PAYMENT_CONSTANTS.DEPOSIT_TIME);
    }

    return () => {
      isMountedRef.current = false;
      removeStatusListener();
      removeQrOptiListener();
      if (depositTimeoutRef.current) {
        clearTimeout(depositTimeoutRef.current);
        depositTimeoutRef.current = null;
      }
      if (checkAmountIntervalRef.current) {
        clearInterval(checkAmountIntervalRef.current);
        checkAmountIntervalRef.current = null;
      }
      lastAmountSumRef.current = 0;
    };
  }, [orderId, order?.status, paymentMethod, fetchOrderDetailsOnPayed, setOrder, setIsLoading, handleOrderQrOpti, safeSetPaymentState]);

  return {};
}

