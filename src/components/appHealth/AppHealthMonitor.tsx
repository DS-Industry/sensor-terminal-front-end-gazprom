import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logger } from '../../util/logger';
import { getRefreshInterval } from '../../config/env';
import useStore from '../state/store';
import { navigateToMain } from '../../utils/navigation';
import { EOrderStatus } from '../state/order/orderSlice';

export function AppHealthMonitor() {
  const navigate = useNavigate();
  const location = useLocation();
  const resetIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const memoryCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStartTimeRef = useRef<number>(Date.now());
  const lastResetTimeRef = useRef<number>(Date.now());
  const skippedResetsRef = useRef<number>(0);
  const { order, clearOrder, setSelectedProgram, setBankCheck, setInsertedAmount, setQueuePosition, setQueueNumber } = useStore();

  const refreshInterval = getRefreshInterval();

  const checkMemoryUsage = () => {
    if ('memory' in performance) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
      const totalMB = Math.round(memory.totalJSHeapSize / 1048576);
      const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576);
      const usagePercent = Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);

      logger.debug(`[AppHealth] Memory usage: ${usedMB}MB / ${totalMB}MB (limit: ${limitMB}MB, ${usagePercent}%)`);

      if (usagePercent > 80) {
        logger.warn(`[AppHealth] High memory usage detected: ${usagePercent}%`);
      }

      return { usedMB, totalMB, limitMB, usagePercent };
    }
    return null;
  };

  const performSoftReset = () => {
    const activePaymentStatuses = [
      EOrderStatus.WAITING_PAYMENT,
      EOrderStatus.PAYED,
      EOrderStatus.PROCESSING,
    ];
    
    if (order && activePaymentStatuses.includes(order.status)) {
      skippedResetsRef.current++;
      logger.debug(`[AppHealth] Skipping soft reset - active payment flow detected`, {
        orderId: order.id,
        status: order.status,
        skippedCount: skippedResetsRef.current,
      });
      return;
    }

    const uptime = Date.now() - appStartTimeRef.current;
    const timeSinceLastReset = Date.now() - lastResetTimeRef.current;
    const uptimeHours = Math.round(uptime / 3600000 * 10) / 10;
    const timeSinceResetHours = Math.round(timeSinceLastReset / 3600000 * 10) / 10;

    logger.info(`[AppHealth] Performing periodic soft reset`, {
      uptimeHours,
      timeSinceResetHours,
      currentPath: location.pathname,
      skippedResets: skippedResetsRef.current,
    });

    skippedResetsRef.current = 0;

    const memoryInfo = checkMemoryUsage();
    if (memoryInfo) {
      logger.info(`[AppHealth] Memory before reset: ${memoryInfo.usedMB}MB (${memoryInfo.usagePercent}%)`);
    }

    clearOrder();
    setSelectedProgram(null);
    setBankCheck("");
    setInsertedAmount(0);
    setQueuePosition(null);
    setQueueNumber(null);

    if (location.pathname !== '/') {
      logger.info(`[AppHealth] Navigating to home page for soft reset`);
      navigateToMain(navigate);
    } else {
      logger.debug(`[AppHealth] Already on home page, skipping navigation`);
    }

    lastResetTimeRef.current = Date.now();
  };

  useEffect(() => {
    logger.info(`[AppHealth] AppHealthMonitor initialized`, {
      refreshIntervalMs: refreshInterval,
      refreshIntervalHours: Math.round(refreshInterval / 3600000 * 10) / 10,
    });

    resetIntervalRef.current = setInterval(() => {
      performSoftReset();
    }, refreshInterval);

    if ('memory' in performance) {
      memoryCheckIntervalRef.current = setInterval(() => {
        checkMemoryUsage();
      }, 5 * 60 * 1000);

      checkMemoryUsage();
    } else {
      logger.debug(`[AppHealth] Performance Memory API not available, skipping memory monitoring`);
    }

    appStartTimeRef.current = Date.now();
    lastResetTimeRef.current = Date.now();

    return () => {
      if (resetIntervalRef.current) {
        clearInterval(resetIntervalRef.current);
        resetIntervalRef.current = null;
      }
      if (memoryCheckIntervalRef.current) {
        clearInterval(memoryCheckIntervalRef.current);
        memoryCheckIntervalRef.current = null;
      }
      logger.info(`[AppHealth] AppHealthMonitor cleaned up`);
    };
  }, []);

  useEffect(() => {
    const uptimeLogger = setInterval(() => {
      const uptime = Date.now() - appStartTimeRef.current;
      const uptimeHours = Math.round(uptime / 3600000 * 10) / 10;
      const timeSinceReset = Date.now() - lastResetTimeRef.current;
      const timeSinceResetHours = Math.round(timeSinceReset / 3600000 * 10) / 10;
      
      logger.info(`[AppHealth] App uptime: ${uptimeHours}h, time since last reset: ${timeSinceResetHours}h`);
      
    
      checkMemoryUsage();
    }, 3600000);

    return () => clearInterval(uptimeLogger);
  }, []);

  return null;
}

