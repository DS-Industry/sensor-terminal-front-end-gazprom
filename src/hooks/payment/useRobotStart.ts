import { useCallback, useEffect } from 'react';
import { startRobot } from '../../api/services/payment';
import { EOrderStatus } from '../../components/state/order/orderSlice';
import { PaymentState } from '../../state/paymentStateMachine';
import { logger } from '../../util/logger';
import useStore from '../../components/state/store';
import { navigateToQueueWaiting, navigateToPaymentSuccess } from '../../utils/navigation';
import { NavigateFunction } from 'react-router-dom';

interface UseRobotStartOptions {
  orderId: string | undefined;
  navigate: NavigateFunction;
}

export function useRobotStart({ orderId, navigate }: UseRobotStartOptions) {
  const {
    order,
    queuePosition,
    setIsLoading,
    setPaymentState,
  } = useStore();

  const handleStartRobot = useCallback(async () => {
    if (!orderId) {
      logger.warn('[RobotStart] Cannot start robot: no order ID');
      return;
    }

    const paymentState = useStore.getState().paymentState;
    if (paymentState !== PaymentState.PAYMENT_SUCCESS) {
      logger.warn('[RobotStart] Cannot start robot: payment not confirmed');
      return;
    }

    try {
      logger.info('[RobotStart] Starting robot for order:', orderId);
      setIsLoading(true);
      setPaymentState(PaymentState.STARTING_ROBOT);
      
      await startRobot(orderId);
      
      logger.info('[RobotStart] Robot start API call successful');
    } catch (error) {
      logger.error('[RobotStart] Error starting robot', error);
      setIsLoading(false);
      setPaymentState(PaymentState.PAYMENT_ERROR);
    }
  }, [orderId, setIsLoading, setPaymentState]);

  useEffect(() => {
    if (order?.id === orderId && order?.status === EOrderStatus.PROCESSING) {
      logger.info('[RobotStart] Order status updated to PROCESSING via WebSocket');
      setPaymentState(PaymentState.ROBOT_STARTED);
      setIsLoading(false);
      
      const currentQueuePosition = queuePosition;
      if (currentQueuePosition !== null && currentQueuePosition > 0) {
        navigateToQueueWaiting(navigate);
      } else {
        navigateToPaymentSuccess(navigate);
      }
    }
  }, [order?.id, order?.status, orderId, queuePosition, navigate, setIsLoading, setPaymentState]);

  return {
    handleStartRobot,
  };
}
