import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import useStore from "../components/state/store";
import CarImage from "../assets/car.webp";
import { logger } from "../util/logger";
import { globalWebSocketManager, type WebSocketMessage } from "../util/websocketManager";
import { EOrderStatus } from "../components/state/order/orderSlice";
import { navigationLock } from "../util/navigationLock";

import gazpromHeader from "../assets/gazprom-step-2-header.webp";

export default function WashingInProgressPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setIsLoading, queuePosition } = useStore();
  
  const [timeRemaining, setTimeRemaining] = useState(180);
  const countdownHandledRef = useRef(false);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderCompletedRef = useRef(false);

  // Listen for COMPLETED status from WebSocket
  useEffect(() => {
    const handleStatusUpdate = (data: WebSocketMessage) => {
      if (data.type === 'status_update' && data.status === EOrderStatus.COMPLETED) {
        logger.info('[WashingInProgressPage] Received COMPLETED status update, navigating home', { orderId: data.order_id });
        orderCompletedRef.current = true;
        
        // Navigate home immediately when order is completed
        navigationLock.navigateWithLock(navigate, '/', 'WashingInProgressPage: order completed');
      }
    };

    const removeListener = globalWebSocketManager.addListener('status_update', handleStatusUpdate);

    return () => {
      removeListener();
    };
  }, [navigate]);

  // Also listen to order status from store as fallback
  useEffect(() => {
    const currentOrder = useStore.getState().order;
    if (currentOrder?.status === EOrderStatus.COMPLETED && !orderCompletedRef.current) {
      logger.info('[WashingInProgressPage] Order status is COMPLETED in store, navigating home');
      orderCompletedRef.current = true;
      navigationLock.navigateWithLock(navigate, '/', 'WashingInProgressPage: order completed from store');
    }
  }, [navigate]);

  useEffect(() => {
    setIsLoading(false);
    countdownHandledRef.current = false;
    orderCompletedRef.current = false;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [setIsLoading]);

  // When countdown finishes, check if someone is in queue
  useEffect(() => {
    if (timeRemaining === 0 && !countdownHandledRef.current) {
      countdownHandledRef.current = true;
      
      // If someone is in queue (queuePosition >= 1), show success page then redirect to washing
      if (queuePosition !== null && queuePosition >= 1) {
        logger.info('[WashingInProgressPage] Waiting finished, someone is in queue, navigating to success page');
        navigate('/success', { replace: true });
        
        // Clear any existing timeout
        if (navigationTimeoutRef.current) {
          clearTimeout(navigationTimeoutRef.current);
        }
        
        // Then redirect to washing page after showing success
        navigationTimeoutRef.current = setTimeout(() => {
          logger.info('[WashingInProgressPage] Redirecting back to washing page after success');
          navigate('/washing', { replace: true });
          navigationTimeoutRef.current = null;
        }, 12000);
      }
    }
    
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
    };
  }, [timeRemaining, queuePosition, navigate]);


  const handlePayInAdvance = () => {
    const { clearOrder, setIsLoading, setInsertedAmount } = useStore.getState();
    clearOrder();
    setIsLoading(false);
    setInsertedAmount(0);
    navigate("/");
  };

  // Show pay in advance button only if queue position or number is null
  const shouldShowPayInAdvance = true

  return (
    <div className="flex flex-col h-[1024px] w-[1280px] bg-[#0045FF] overflow-hidden">
        <div className="w-full flex-shrink-0 h-64">
            <img 
            src={gazpromHeader} 
            alt="Header" 
            className="w-full h-full object-cover"
            />
        </div>

      <div className="flex-1 flex flex-col items-center justify-center bg-[#0045FF] relative overflow-hidden" style={{ height: 'calc(1024px - 256px)' }}>
        <div className="flex flex-col items-center justify-center max-w-4xl px-8 text-center z-10">
            <div className="bg-[#89BAFB4D] rounded-2xl py-4 px-10 flex items-center gap-3 mb-6 mt-3 w-[727px] text-center justify-center">
                <h1 className="text-white text-6xl font-bold flex items-center justify-center text-center">
                    {t("Идёт мойка...")}
                </h1>
            </div>

          {shouldShowPayInAdvance && (
            <>
              <p className="text-white text-2xl mb-8 max-w-2xl">
                {t("Вы можете оплатить мойку заранее, пока моется другой автомобиль")}
              </p>

              <button
                onClick={handlePayInAdvance}
                className="px-16 py-4 text-[#0B68E1] bg-white font-semibold text-2xl transition-all duration-300 hover:opacity-90 hover:scale-105 shadow-lg mb-8"
                style={{borderRadius: "30px"}}
                aria-label={t("Оплатить заранее")}
              >
                {t("Оплатить заранее")}
              </button>
            </>
          )}
        </div>

        <div className="relative w-full h-[400px] flex items-end justify-end pr-0 overflow-hidden">
          <div className="absolute -bottom-20 left-0 z-20 car-drive-animation-success">
            <img
              src={CarImage}
              alt="Car"
              className="w-auto h-[700px] md:h-[700px] object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

