import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import useStore from "../components/state/store";
import { EOrderStatus } from "../components/state/order/orderSlice";
import BoxImage from "../assets/бокс.png";
import CarImage from "../assets/car.png";
import { logger } from "../util/logger";
import { startRobot, getOrderById } from "../api/services/payment";

import gazpromHeader from "../assets/gazprom-step-2-header.png";

export default function SuccessPaymentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setIsLoading, order, isLoading } = useStore();
  
  const [displayText, setDisplayText] = useState(t("Можете проезжать в бокс!"));
  const robotStartedRef = useRef(false);

  const handleFinish = useCallback(() => {
    navigate("/");
  }, [navigate]);


  useEffect(() => {
    if (order?.status === EOrderStatus.COMPLETED) {
      logger.info('[SuccessPaymentPage] User\'s order completed, redirecting to main screen');
      handleFinish();
      return;
    }
    if (order?.status === EOrderStatus.PROCESSING) {
      if (!isLoading) {
        logger.info('[SuccessPaymentPage] Order is processing, will navigate to washing page after 12 seconds');
        const navigationTimer = setTimeout(() => {
          logger.info('[SuccessPaymentPage] Navigating to washing page after delay');
          navigate('/washing', { replace: true });
        }, 12000); 

        return () => clearTimeout(navigationTimer);
      } else {
        logger.warn('[SuccessPaymentPage] Order status is PROCESSING but payment is still loading, delaying navigation');
      }
    }
  }, [order?.status, navigate, handleFinish, isLoading]);

  useEffect(() => {
    if (order?.id && order?.status === EOrderStatus.PAYED && !robotStartedRef.current) {
      const orderId = order.id;
      const startRobotAsync = async () => {
        try {
          robotStartedRef.current = true;
          logger.info('[SuccessPaymentPage] Starting robot for order:', orderId);
          setIsLoading(true);
          
          await startRobot(orderId);
          logger.info('[SuccessPaymentPage] Robot start API call successful');
          
          const orderDetails = await getOrderById(orderId);
          if (orderDetails.status === EOrderStatus.PROCESSING) {
            logger.info('[SuccessPaymentPage] Order status confirmed as PROCESSING');
            setIsLoading(false);
          } else {
            logger.warn('[SuccessPaymentPage] Order status is', orderDetails.status, 'not PROCESSING yet');
            setIsLoading(false);
          }
        } catch (error) {
          logger.error('[SuccessPaymentPage] Error starting robot', error);
          setIsLoading(false);
          robotStartedRef.current = false; 
        }
      };

      startRobotAsync();
    }
  }, [order?.id, order?.status, setIsLoading]);

  useEffect(() => {
    setIsLoading(false);

    setDisplayText(t("Можете проезжать в бокс!"));
    const textTimer = setTimeout(() => {
      setDisplayText(t("Идёт мойка..."));
    }, 10000);

    const navigationTimer = setTimeout(() => {
      logger.info('[SuccessPaymentPage] Redirecting to washing page after 12 seconds');
      navigate('/washing', { replace: true });
    }, 12000);

    const safetyTimer = setTimeout(() => {
      if (order?.status === EOrderStatus.PROCESSING && !isLoading) {
        logger.warn('[SuccessPaymentPage] Safety timeout reached, order is PROCESSING, navigating to washing page');
        navigate('/washing', { replace: true });
      } else if (!isLoading) {
        logger.warn('[SuccessPaymentPage] Safety timeout reached, navigating to washing page anyway');
        navigate('/washing', { replace: true });
      } else {
        logger.error('[SuccessPaymentPage] Safety timeout reached but payment is still loading - possible API hang');
      }
    }, 300000); 

    return () => {
      clearTimeout(textTimer);
      clearTimeout(navigationTimer);
      clearTimeout(safetyTimer);
    };
  }, [setIsLoading, t, navigate, isLoading, order?.status]);

  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-100 bg-[#0045FF]">
       <div className="w-full flex-shrink-0 h-48 md:h-64 lg:h-62">
        <img 
          src={gazpromHeader} 
          alt="Header" 
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 flex flex-col items-start justify-center bg-[#0045FF] relative overflow-x-visible overflow-y-hidden">
        <div className="flex flex-col items-center gap-6 z-10 p-6">
          <div className="bg-[#89BAFB4D] rounded-3xl px-12 py-8">
            <h1 className="text-white text-6xl font-bold flex items-center justify-center gap-3">
              {t(displayText)}
              <span className="text-white text-5xl"></span>
            </h1>
          </div>
          
          <div className="bg-[#89BAFB4D] rounded-2xl px-8 py-4 flex items-center gap-3">
            <div className="w-4 h-4 bg-[#15FF00] rounded-full flex-shrink-0"></div>
            <p className="text-white text-2xl font-semibold">
              {t("Оплата успешна!")}
            </p>
          </div>
        </div>

        <div className="relative w-full h-[600px] flex items-end justify-end pr-0 overflow-x-visible overflow-y-hidden">
          <div className="absolute -bottom-35 left-0 z-20 car-drive-animation">
            <img
              src={CarImage}
              alt="Car"
              className="w-auto h-[800px] md:h-[800px] object-contain"
            />
          </div>

          <div className="relative z-99 w-full min-h-[900px] flex items-end justify-end pr-0 overflow-x-visible overflow-y-hidden">

            <img
              src={BoxImage}
              alt="Car wash box"
              className="h-full max-h-[900px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
