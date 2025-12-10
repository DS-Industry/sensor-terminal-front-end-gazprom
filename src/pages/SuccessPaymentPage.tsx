import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import useStore from "../components/state/store";
import { EOrderStatus } from "../components/state/order/orderSlice";
import BoxImage from "../assets/бокс.webp";
import CarImage from "../assets/car.webp";
import { logger } from "../util/logger";
import { startRobot, getOrderById } from "../api/services/payment";
import { navigationLock } from "../util/navigationLock";

import gazpromHeader from "../assets/gazprom-step-2-header.webp";

export default function SuccessPaymentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setIsLoading, order, isLoading, queuePosition } = useStore();
  
  const [displayText, setDisplayText] = useState(t("Можете проезжать в бокс!"));
  const robotStartedRef = useRef(false);
  const navigationGuardRef = useRef(false);
  const isMountedRef = useRef(true);
  const timersRef = useRef<{
    textTimer?: NodeJS.Timeout;
    navigationTimer?: NodeJS.Timeout;
    safetyTimer?: NodeJS.Timeout;
  }>({});

  // Single navigation guard function to prevent race conditions
  const navigateWithGuard = useCallback((target: string, reason: string) => {
    if (navigationGuardRef.current) {
      logger.warn(`[SuccessPaymentPage] Navigation blocked: ${reason} - navigation already in progress`);
      return false;
    }
    
    // Use global navigation lock to prevent race conditions across components
    if (!navigationLock.navigateWithLock(navigate, target, `SuccessPaymentPage: ${reason}`)) {
      return false;
    }
    
    navigationGuardRef.current = true;
    logger.info(`[SuccessPaymentPage] Navigating to ${target}: ${reason}`);
    
    // Clear all timers to prevent duplicate navigations
    if (timersRef.current.textTimer) clearTimeout(timersRef.current.textTimer);
    if (timersRef.current.navigationTimer) clearTimeout(timersRef.current.navigationTimer);
    if (timersRef.current.safetyTimer) clearTimeout(timersRef.current.safetyTimer);
    
    return true;
  }, [navigate]);

  const handleFinish = useCallback(() => {
    navigateWithGuard("/", "Order completed");
  }, [navigateWithGuard]);

  // Handle order status changes and navigation logic
  useEffect(() => {
    // Immediate navigation for completed orders
    if (order?.status === EOrderStatus.COMPLETED) {
      logger.info('[SuccessPaymentPage] User\'s order completed, redirecting to main screen');
      handleFinish();
      return;
    }

    // Handle PROCESSING status - navigate after delay if not loading
    if (order?.status === EOrderStatus.PROCESSING) {
      if (!isLoading) {
        logger.info('[SuccessPaymentPage] Order is processing, will navigate to washing page after 12 seconds');
        
        // Clear any existing navigation timer (including fallback timer from third useEffect)
        if (timersRef.current.navigationTimer) {
          clearTimeout(timersRef.current.navigationTimer);
          delete timersRef.current.navigationTimer;
        }
        
        timersRef.current.navigationTimer = setTimeout(() => {
          navigateWithGuard('/washing', 'Order status PROCESSING after 12 seconds');
        }, 12000); 

        return () => {
          if (timersRef.current.navigationTimer) {
            clearTimeout(timersRef.current.navigationTimer);
            delete timersRef.current.navigationTimer;
          }
        };
      } else {
        logger.warn('[SuccessPaymentPage] Order status is PROCESSING but payment is still loading, delaying navigation');
      }
    }
  }, [order?.status, isLoading, handleFinish, navigateWithGuard]);

  // Start robot when order is PAYED
  useEffect(() => {
    isMountedRef.current = true;
    
    if (order?.id && order?.status === EOrderStatus.PAYED && !robotStartedRef.current) {
      const orderId = order.id;
      const startRobotAsync = async () => {
        try {
          robotStartedRef.current = true;
          logger.info('[SuccessPaymentPage] Starting robot for order:', orderId);
          if (isMountedRef.current) {
            setIsLoading(true);
          }
          
          await startRobot(orderId);
          
          // Check if component is still mounted after async operation
          if (!isMountedRef.current) return;
          
          logger.info('[SuccessPaymentPage] Robot start API call successful');
          
          const orderDetails = await getOrderById(orderId);
          
          // Check again after second async operation
          if (!isMountedRef.current) return;
          
          if (orderDetails.status === EOrderStatus.PROCESSING) {
            logger.info('[SuccessPaymentPage] Order status confirmed as PROCESSING');
            setIsLoading(false);
          } else {
            logger.warn('[SuccessPaymentPage] Order status is', orderDetails.status, 'not PROCESSING yet');
            setIsLoading(false);
          }
        } catch (error) {
          logger.error('[SuccessPaymentPage] Error starting robot', error);
          if (isMountedRef.current) {
            setIsLoading(false);
            robotStartedRef.current = false;
          }
        }
      };

      startRobotAsync();
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [order?.id, order?.status, setIsLoading]);

  // Initialize display text and set up fallback timers
  useEffect(() => {
    isMountedRef.current = true;
    
    if (isMountedRef.current) {
      setIsLoading(false);
      setDisplayText(t("Можете проезжать в бокс!"));
    }

    // Fallback navigation timer (12 seconds) - only set if order is not PROCESSING
    // (PROCESSING status is handled by the first useEffect to avoid duplicate timers)
    const currentStatus = order?.status;
    if (currentStatus !== EOrderStatus.PROCESSING && currentStatus !== EOrderStatus.COMPLETED) {
      timersRef.current.navigationTimer = setTimeout(() => {
        if (!isMountedRef.current) return;
        
        const currentOrder = useStore.getState().order;
        const latestStatus = currentOrder?.status;
        
        // Only navigate if order is not completed and navigation hasn't occurred
        if (latestStatus !== EOrderStatus.COMPLETED && latestStatus !== EOrderStatus.PROCESSING) {
          navigateWithGuard('/washing', 'Fallback timer after 12 seconds');
        }
      }, 12000);
    }

    // Safety timeout (5 minutes) - last resort navigation
    timersRef.current.safetyTimer = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      const currentOrder = useStore.getState().order;
      const currentIsLoading = useStore.getState().isLoading;
      
      if (currentOrder?.status === EOrderStatus.PROCESSING && !currentIsLoading) {
        navigateWithGuard('/washing', 'Safety timeout - order is PROCESSING');
      } else if (!currentIsLoading) {
        navigateWithGuard('/washing', 'Safety timeout - fallback navigation');
      } else {
        logger.error('[SuccessPaymentPage] Safety timeout reached but payment is still loading - possible API hang');
      }
    }, 300000); 

    return () => {
      isMountedRef.current = false;
      if (timersRef.current.textTimer) clearTimeout(timersRef.current.textTimer);
      if (timersRef.current.navigationTimer) clearTimeout(timersRef.current.navigationTimer);
      if (timersRef.current.safetyTimer) clearTimeout(timersRef.current.safetyTimer);
      timersRef.current = {};
    };
  }, [setIsLoading, t, navigateWithGuard, order?.status]);

  return (
    <div className="flex flex-col h-[1024px] w-[1280px] bg-gray-100 bg-[#0045FF] overflow-hidden">
       <div className="w-full flex-shrink-0 h-64">
        <img 
          src={gazpromHeader} 
          alt="Header" 
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 flex flex-col items-start justify-center bg-[#0045FF] relative overflow-hidden" style={{ height: 'calc(1024px - 256px)' }}>
        <div className="flex flex-col items-center gap-6 z-10 p-6">
          <div className="bg-[#89BAFB4D] rounded-3xl px-12 py-8">
            <h1 className="text-white text-6xl font-bold flex items-center justify-center gap-3">
              {t(displayText)}
              <span className="text-white text-5xl"></span>
            </h1>
          </div>
          
          {queuePosition === null || queuePosition === 0 ? <div className="bg-[#89BAFB4D] rounded-2xl px-8 py-4 flex items-center gap-3">
            <div className="w-4 h-4 bg-[#15FF00] rounded-full flex-shrink-0"></div>
            <p className="text-white text-2xl font-semibold">
              {t("Оплата успешна!")}
            </p>
          </div> : null}
        </div>

        <div className="relative w-full h-[600px] flex items-end justify-end pr-0 overflow-hidden">
          <div className="absolute -bottom-45 left-0 z-20 car-drive-animation">
            <img
              src={CarImage}
              alt="Car"
              className="w-auto h-[800px] md:h-[800px] object-contain"
            />
          </div>

          <div className="relative z-99 w-full -bottom-30 flex items-end justify-end pr-0 overflow-hidden">

            <img
              src={BoxImage}
              alt="Car wash box"
              className="h-full max-h-[900px] object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
