import { useCallback, useRef, useEffect } from 'react';
import { logger } from '../../util/logger';
import { TimerManager } from '../../util/paymentUtils';
import { PAYMENT_CONSTANTS } from '../../constants/payment';

interface UseTimeoutHandlingParams {
  paymentMethod: string;
  onTimeout: () => void;
  onTimeoutWarning: () => void;
  onCountdownUpdate: (seconds: number) => void;
}

export function useTimeoutHandling({
  paymentMethod,
  onTimeout,
  onTimeoutWarning,
  onCountdownUpdate,
}: UseTimeoutHandlingParams) {
  const timerManagerRef = useRef(new TimerManager());
  const timeoutWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const onTimeoutRef = useRef(onTimeout);
  const onTimeoutWarningRef = useRef(onTimeoutWarning);
  const onCountdownUpdateRef = useRef(onCountdownUpdate);
  
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
    onTimeoutWarningRef.current = onTimeoutWarning;
    onCountdownUpdateRef.current = onCountdownUpdate;
  }, [onTimeout, onTimeoutWarning, onCountdownUpdate]);

  const setupTimeout = useCallback(() => {
    if (timeoutWarningTimerRef.current) {
      clearTimeout(timeoutWarningTimerRef.current);
      timeoutWarningTimerRef.current = null;
    }
    if (timeoutCountdownIntervalRef.current) {
      clearInterval(timeoutCountdownIntervalRef.current);
      timeoutCountdownIntervalRef.current = null;
    }

    const warningTime = PAYMENT_CONSTANTS.DEPOSIT_TIME - PAYMENT_CONSTANTS.TIMEOUT_WARNING_TIME;
    let remainingSeconds = Math.ceil(PAYMENT_CONSTANTS.DEPOSIT_TIME / 1000);
    onCountdownUpdateRef.current(remainingSeconds);

    timeoutWarningTimerRef.current = timerManagerRef.current.setTimeout(() => {
      logger.info(`[${paymentMethod}] Payment timeout warning shown`);
      onTimeoutWarningRef.current();
    }, warningTime);

    timeoutCountdownIntervalRef.current = timerManagerRef.current.setInterval(() => {
      remainingSeconds = Math.max(0, remainingSeconds - 1);
      onCountdownUpdateRef.current(remainingSeconds);
    }, 1000);

    timerManagerRef.current.setTimeout(() => {
      logger.info(`[${paymentMethod}] Payment timeout reached`);
      onTimeoutRef.current();
    }, PAYMENT_CONSTANTS.DEPOSIT_TIME);
  }, [paymentMethod]);

  const clearAllTimeouts = useCallback(() => {
    timerManagerRef.current.clearAll();
    if (timeoutWarningTimerRef.current) {
      clearTimeout(timeoutWarningTimerRef.current);
      timeoutWarningTimerRef.current = null;
    }
    if (timeoutCountdownIntervalRef.current) {
      clearInterval(timeoutCountdownIntervalRef.current);
      timeoutCountdownIntervalRef.current = null;
    }
  }, []);

  return {
    setupTimeout,
    clearTimeout: clearAllTimeouts,
  };
}

