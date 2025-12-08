import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getOrderById, startRobot as startRobotAPI } from '../../api/services/payment';
import { EOrderStatus } from '../../components/state/order/orderSlice';
import { logger } from '../../util/logger';
import {
  retryWithBackoff,
  sanitizeErrorMessage,
  OperationLock,
} from '../../util/paymentUtils';
import { PAYMENT_CONSTANTS } from '../../constants/payment';

interface UseRobotStartParams {
  paymentMethod: string;
  orderId: string | null;
  paymentSuccess: boolean;
  onError: (error: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

export function useRobotStart({
  paymentMethod,
  orderId,
  paymentSuccess,
  onError,
  onLoadingChange,
}: UseRobotStartParams) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const robotStartLockRef = useRef(new OperationLock());
  const countdownStartedRef = useRef(false);

  const startRobot = useCallback(async (): Promise<boolean> => {
    if (!orderId) {
      logger.warn(`[${paymentMethod}] Cannot start robot: no order ID`);
      onError(t('Заказ не найден. Пожалуйста, создайте новый заказ.'));
      return false;
    }

    if (!paymentSuccess) {
      logger.warn(`[${paymentMethod}] Cannot start robot: payment not confirmed`);
      onError(t('Оплата не подтверждена. Пожалуйста, дождитесь подтверждения.'));
      return false;
    }

    const lockId = robotStartLockRef.current.acquire(`start-robot-${orderId}`);
    if (!lockId) {
      logger.warn(`[${paymentMethod}] Robot start already in progress for order: ${orderId}`);
      return false;
    }

    try {
      logger.info(`[${paymentMethod}] Starting robot for order: ${orderId}`);
      onLoadingChange(true);

      await retryWithBackoff(
        () => startRobotAPI(orderId),
        {
          maxRetries: PAYMENT_CONSTANTS.MAX_RETRY_ATTEMPTS,
          initialDelay: PAYMENT_CONSTANTS.RETRY_INITIAL_DELAY,
          onRetry: (attempt, error) => {
            logger.warn(`[${paymentMethod}] Retrying robot start (attempt ${attempt})`, error);
          },
        }
      );

      logger.info(`[${paymentMethod}] Robot start API call successful`);

      try {
        const orderDetails = await getOrderById(orderId);
        if (orderDetails.status === EOrderStatus.PROCESSING) {
          logger.info(
            `[${paymentMethod}] Order status confirmed as PROCESSING, navigating to success page`
          );
          onLoadingChange(false);
          robotStartLockRef.current.release(lockId);
          navigate('/success');
          return true;
        } else {
          logger.warn(
            `[${paymentMethod}] Order status is ${orderDetails.status}, not PROCESSING. Waiting for status update...`
          );
          onLoadingChange(false);
          robotStartLockRef.current.release(lockId);
          return false;
        }
      } catch (verifyError) {
        logger.error(`[${paymentMethod}] Error verifying order status after robot start`, verifyError);
        onLoadingChange(false);
        robotStartLockRef.current.release(lockId);
        navigate('/success');
        return true;
      }
    } catch (error) {
      logger.error(`[${paymentMethod}] Error starting robot`, error);
      const errorMessage = sanitizeErrorMessage(
        error,
        t('Ошибка запуска робота. Пожалуйста, попробуйте снова.')
      );
      onError(errorMessage);
      onLoadingChange(false);
      robotStartLockRef.current.release(lockId);
      return false;
    }
  }, [paymentMethod, orderId, paymentSuccess, onError, onLoadingChange, navigate, t]);

  const startCountdown = useCallback(
    (onAutoStart: () => void, onCountdownUpdate: (time: number) => void) => {
      if (countdownStartedRef.current) {
        logger.debug(`[${paymentMethod}] Countdown already started, skipping`);
        return null;
      }

      logger.debug(`[${paymentMethod}] Starting automatic start countdown`);
      countdownStartedRef.current = true;

      const { TimerManager } = require('../../util/paymentUtils');
      const timerManager = new TimerManager();
      const initialTime = PAYMENT_CONSTANTS.START_ROBOT_INTERVAL / 1000;
      onCountdownUpdate(initialTime);

      timerManager.setTimeout(() => {
        logger.info(`[${paymentMethod}] Automatic robot start triggered`);
        countdownStartedRef.current = false;
        onAutoStart();
      }, PAYMENT_CONSTANTS.START_ROBOT_INTERVAL);

      let currentTime = initialTime;
      const intervalId = timerManager.setInterval(() => {
        currentTime = Math.max(0, currentTime - 1);
        onCountdownUpdate(currentTime);
        if (currentTime <= 0) {
          timerManager.clearInterval(intervalId);
        }
      }, 1000);

      return {
        initialTime,
        clear: () => {
          timerManager.clearAll();
          countdownStartedRef.current = false;
          onCountdownUpdate(0);
        },
      };
    },
    [paymentMethod]
  );

  const reset = useCallback(() => {
    robotStartLockRef.current.forceRelease();
    countdownStartedRef.current = false;
  }, []);

  return {
    startRobot,
    startCountdown,
    reset,
  };
}

