import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createOrder } from '../../api/services/payment';
import { EPaymentMethod } from '../../components/state/order/orderSlice';
import { logger } from '../../util/logger';
import { retryWithBackoff, sanitizeErrorMessage, OperationLock, PaymentState } from '../../util/paymentUtils';
import { PAYMENT_CONSTANTS } from '../../constants/payment';

interface UseOrderCreationParams {
  paymentMethod: EPaymentMethod; 
  selectedProgram: { id: number; price: string } | null;
  onOrderCreated: (qrCode?: string) => void;
  onError: (error: string) => void;
  onStateChange: (state: PaymentState) => void;
  checkQueueStatus: (orderId: string) => Promise<{ queuePosition: number | null; isFull: boolean }>;
  queuePosition: number | null;
  orderId: string | null;
}

export function useOrderCreation({
  paymentMethod,
  selectedProgram,
  onOrderCreated,
  onError,
  onStateChange,
  checkQueueStatus,
  queuePosition,
  orderId,
}: UseOrderCreationParams) {
  const { t } = useTranslation();
  const orderLockRef = useRef(new OperationLock());
  const orderCreatedRef = useRef(false);

  const createOrderAsync = useCallback(
    async (ucn?: string): Promise<boolean> => {
      if (!selectedProgram) {
        logger.warn(`[${paymentMethod}] Failed to create order: missing program`);
        onError(t('Программа не выбрана. Пожалуйста, выберите программу.'));
        return false;
      }

      const currentQueuePosition =
        queuePosition ??
        (orderId ? (await checkQueueStatus(orderId)).queuePosition : null);

      if (
        currentQueuePosition !== null &&
        currentQueuePosition >= PAYMENT_CONSTANTS.MAX_QUEUE_POSITION
      ) {
        logger.info(`[${paymentMethod}] Queue is full, queuePosition: ${currentQueuePosition}`);
        onError(t('Очередь заполнена. Пожалуйста, подождите.'));
        onStateChange(PaymentState.QUEUE_FULL);
        return false;
      }

      const lockId = orderLockRef.current.acquire(`create-order-${Date.now()}`);
      if (!lockId) {
        logger.warn(`[${paymentMethod}] Order creation already in progress, skipping`);
        return false;
      }

      if (orderCreatedRef.current) {
        orderLockRef.current.release(lockId);
        logger.warn(`[${paymentMethod}] Order already created, skipping`);
        return false;
      }

      orderCreatedRef.current = true;
      onStateChange(PaymentState.CREATING_ORDER);

      try {
        const response = await retryWithBackoff(
          () =>
            createOrder({
              program_id: selectedProgram.id,
              payment_type: paymentMethod,
              ucn: ucn,
            }),
          {
            maxRetries: PAYMENT_CONSTANTS.MAX_RETRY_ATTEMPTS,
            initialDelay: PAYMENT_CONSTANTS.RETRY_INITIAL_DELAY,
            onRetry: (attempt, error) => {
              logger.warn(`[${paymentMethod}] Retrying order creation (attempt ${attempt})`, error);
            },
          }
        );

        logger.debug(`[${paymentMethod}] Order created ${ucn ? 'with UCN' : 'without UCN'}`);

        if (response.qr_code) {
          logger.debug(`[${paymentMethod}] Received QR code from createOrder response`);
          onOrderCreated(response.qr_code);
        } else {
          onOrderCreated();
        }

        onStateChange(PaymentState.WAITING_PAYMENT);
        orderLockRef.current.release(lockId);
        return true;
      } catch (err) {
        logger.error(`[${paymentMethod}] Error creating order`, err);
        orderCreatedRef.current = false;
        orderLockRef.current.release(lockId);

        const errorMessage = sanitizeErrorMessage(
          err,
          t('Произошла ошибка при создании заказа. Пожалуйста, попробуйте снова.')
        );

        onError(errorMessage);
        onStateChange(PaymentState.ERROR);
        return false;
      }
    },
    [
      selectedProgram,
      paymentMethod,
      queuePosition,
      orderId,
      checkQueueStatus,
      onOrderCreated,
      onError,
      onStateChange,
      t,
    ]
  );

  const reset = useCallback(() => {
    orderCreatedRef.current = false;
    orderLockRef.current.forceRelease();
  }, []);

  return {
    createOrderAsync,
    reset,
    isOrderCreated: orderCreatedRef.current,
  };
}

