import { useCallback, useRef } from 'react';
import { getOrderById } from '../../api/services/payment';
import { EOrderStatus } from '../../components/state/order/orderSlice';
import { logger } from '../../util/logger';
import { PAYMENT_CONSTANTS } from '../../constants/payment';

interface UsePaymentPollingParams {
  paymentMethod: string;
  checkQueueStatus: (orderId: string) => Promise<{
    queuePosition: number | null;
    queueNumber: number | null;
    isFull: boolean;
  }>;
  onQueueUpdate: (position: number | null, number: number | null, full: boolean) => void;
  onPaymentUpdate: (orderDetails: {
    amount_sum?: string;
    status: EOrderStatus;
    queue_position?: number;
    queue_number?: number;
  }) => void;
}

export function usePaymentPolling({
  paymentMethod,
  checkQueueStatus,
  onQueueUpdate,
  onPaymentUpdate,
}: UsePaymentPollingParams) {
  const paymentCheckInProgressRef = useRef(false);
  const lastPaymentCheckRef = useRef<number>(0);

  const checkPaymentStatus = useCallback(
    async (orderId: string): Promise<void> => {
      const now = Date.now();
      if (now - lastPaymentCheckRef.current < PAYMENT_CONSTANTS.PAYMENT_INTERVAL) {
        return;
      }

      if (paymentCheckInProgressRef.current) {
        return;
      }

      paymentCheckInProgressRef.current = true;
      lastPaymentCheckRef.current = now;

      try {
        logger.debug(`[${paymentMethod}] Checking order status, orderId: ${orderId}`);
        const orderDetails = await getOrderById(orderId);
        logger.debug(`[${paymentMethod}] Received order details`);

        const queueStatus = await checkQueueStatus(orderId);
        onQueueUpdate(queueStatus.queuePosition, queueStatus.queueNumber, queueStatus.isFull);

        onPaymentUpdate({
          amount_sum: orderDetails.amount_sum,
          status: orderDetails.status,
          queue_position: orderDetails.queue_position,
          queue_number: orderDetails.queue_number,
        });
      } catch (e) {
        logger.error(`[${paymentMethod}] Error checking payment status`, e);
      } finally {
        paymentCheckInProgressRef.current = false;
      }
    },
    [paymentMethod, checkQueueStatus, onQueueUpdate, onPaymentUpdate]
  );

  return { checkPaymentStatus };
}

