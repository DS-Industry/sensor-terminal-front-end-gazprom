import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import useStore from "../components/state/store";
import { useEffect, useRef, useCallback } from "react";
import gazpromHeader from "../assets/gazprom-step-2-header.webp";
import errorImage from "../assets/error.webp";
import { cancelOrder } from "../api/services/payment";
import { navigationLock } from "../util/navigationLock";
import { logger } from "../util/logger";

const IDLE_TIMEOUT = 5000;

export default function ErrorPaymentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { 
    setIsLoading, 
    order, 
    clearOrder, 
    setSelectedProgram, 
    setBankCheck, 
    setInsertedAmount, 
    setQueuePosition, 
    setQueueNumber 
  } = useStore();
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFinish = useCallback(async () => {
    logger.info('[ErrorPaymentPage] Handling close - cleaning up everything');
    
    // Clear idle timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    
    // Cancel order if it exists
    if (order?.id) {
      try {
        await cancelOrder(order.id);
        logger.info('[ErrorPaymentPage] Order cancelled on close');
      } catch (error) {
        logger.error('[ErrorPaymentPage] Error cancelling order on close', error);
      }
    }

    // Clear all global store state
    clearOrder();
    setSelectedProgram(null);
    setBankCheck("");
    setInsertedAmount(0);
    setQueuePosition(null);
    setQueueNumber(null);
    setIsLoading(false);
    
    // Navigate to main page
    logger.info('[ErrorPaymentPage] Navigating to main page after cleanup');
    navigationLock.navigateWithLock(navigate, "/", 'ErrorPaymentPage: close button - full cleanup');
  }, [
    navigate, 
    order, 
    clearOrder, 
    setSelectedProgram, 
    setBankCheck, 
    setInsertedAmount, 
    setQueuePosition, 
    setQueueNumber, 
    setIsLoading
  ]);

  const clearIdleTimeout = () => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    setIsLoading(false);

    if (!idleTimeoutRef.current) {
      idleTimeoutRef.current = setTimeout(handleFinish, IDLE_TIMEOUT);
    }

    return () => {
      clearIdleTimeout();
    };
  }, [handleFinish, setIsLoading]);


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
        {/* Error message box */}
        <div className="flex flex-col items-center justify-center z-10 mb-8">
          <div className="bg-[#89BAFB4D] rounded-2xl px-12 py-8 mb-6">
            <h1 className="text-white text-6xl font-bold text-center">
              {t("Ошибка оплаты!")}
            </h1>
          </div>

          {/* Instruction text */}
          <p className="text-white text-2xl mb-8 text-center max-w-4xl px-8">
            {t("Пожалуйста обратитесь к оператору")}
          </p>

          {/* Close button - oval/rounded */}
          <button
            className="px-16 py-6 rounded-full text-[#0B68E1] bg-white font-semibold text-2xl transition-all duration-300 hover:opacity-90 hover:scale-105 shadow-lg"
            onClick={handleFinish}
            aria-label={t("Закрыть")}
            style={{ borderRadius: '50px' }}
          >
            {t("Закрыть")}
          </button>
        </div>

        {/* Error image (red stop sign) positioned in bottom right */}
        <div className="absolute bottom-0 right-0 z-20">
          <img
            src={errorImage}
            alt="Error"
            className="w-auto h-auto max-w-[300px] max-h-[300px] object-contain"
          />
        </div>
      </div>
    </div>
  );
}
