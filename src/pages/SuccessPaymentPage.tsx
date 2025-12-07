import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import useStore from "../components/state/store";
import { EOrderStatus } from "../components/state/order/orderSlice";
import BoxImage from "../assets/бокс.png";
import CarImage from "../assets/car.png";
import MediaCampaign from "../components/mediaCampaign/mediaCampaign";
import { useMediaCampaign } from "../hooks/useMediaCampaign";
import { Clock } from "@gravity-ui/icons";
import { Icon } from "@gravity-ui/uikit";
import { logger } from "../util/logger";

const MEDIA_CAMPAIGN_URL = import.meta.env.VITE_MEDIA_CAMPAIGN_URL || "";

type SuccessState = 'initial' | 'washing' | 'advance';

export default function SuccessPaymentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setIsLoading, order, queuePosition } = useStore();
  const { attachemntUrl, mediaStatus } = useMediaCampaign(MEDIA_CAMPAIGN_URL);
  
  const [displayText, setDisplayText] = useState(t("Можете проезжать в бокс!"));
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes in seconds
  
  const state: SuccessState = (searchParams.get('state') as SuccessState) || 
    (queuePosition !== null && queuePosition >= 1 ? 'advance' : 'initial');

  const handleFinish = () => {
    navigate("/");
  }


  useEffect(() => {
    if (order?.status === EOrderStatus.COMPLETED) {
      handleFinish();
    }
  }, [order, navigate]);

  useEffect(() => {
      if (state === 'advance' && (queuePosition === null || queuePosition === 0)) {
        logger.info('[SuccessPaymentPage] Queue cleared, transitioning to "Проезжайте в бокс" screen');
      navigate('/success', { replace: true });
    }
  }, [queuePosition, state, navigate]);

  useEffect(() => {
    setIsLoading(false);

    if (state === 'initial') {
      setDisplayText(t("Можете проезжать в бокс!"));
      const textTimer = setTimeout(() => {
        setDisplayText(t("Идёт мойка..."));
      }, 10000);

      return () => {
        clearTimeout(textTimer);
      };
    }
  }, [state, setIsLoading, t]);

  useEffect(() => {
    if (state === 'advance' && order?.id) {
      const checkQueueStatus = async () => {
        try {
          if (!order.id) {
            return;
          }
          const { getOrderById } = await import('../api/services/payment');
          const orderDetails = await getOrderById(order.id);
          
          if (orderDetails.queue_position !== undefined) {
            const newQueuePosition = orderDetails.queue_position;
            
            const { setQueuePosition: setGlobalQueuePosition } = useStore.getState();
            setGlobalQueuePosition(newQueuePosition);
            
            if (newQueuePosition === 0 || newQueuePosition === null) {
              logger.info('[SuccessPaymentPage] Queue cleared, transitioning to "Проезжайте в бокс" screen');
              navigate('/success', { replace: true });
            }
          }
        } catch (err) {
          logger.error('[SuccessPaymentPage] Error checking queue status', err);
        }
      };

      checkQueueStatus();
      const interval = setInterval(checkQueueStatus, 2000);

      return () => clearInterval(interval);
    }
  }, [state, order?.id, navigate]);

  useEffect(() => {
    if (state === 'advance' || state === 'washing') {
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
    }
  }, [state]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} ${t("мин.")}`;
  };

  if (state === 'advance') {
    return (
      <div className="flex flex-col min-h-screen w-screen bg-gray-100">
        {attachemntUrl && (
          <div className="w-full flex-shrink-0" style={{ height: '260px', minHeight: '260px' }}>
            <MediaCampaign attachemntUrl={attachemntUrl} mediaStatus={mediaStatus} />
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center bg-[#0045FF] relative overflow-hidden">
          <div className="flex flex-col items-center justify-center max-w-4xl px-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-4 h-4 bg-green-400 rounded-full"></div>
              <p className="text-white text-3xl font-semibold">
                {t("Оплата успешна!")}
              </p>
            </div>

            <h1 className="text-white text-5xl font-bold mb-6">
              {t("Ожидайте окончания мойки...")}
            </h1>

            <p className="text-white text-xl mb-8 max-w-2xl">
              {t("После окончания мойки наступит Ваша очередь, Вы сможете проехать в бокс!")}
            </p>

            <div className="flex items-center gap-3 text-white text-xl mb-8">
              <Icon data={Clock} size={24} className="text-white" />
              <span>
                {t("Осталось времени")}: {formatTime(timeRemaining)}
              </span>
            </div>

            <div className="absolute bottom-0 left-0 z-10">
              <img
                src={CarImage}
                alt="Car"
                className="w-auto h-48 object-contain opacity-80"
                style={{
                  clipPath: 'inset(0 70% 0 0)',
                  transform: 'translateX(20%)'
                }}
              />
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-100">
      {attachemntUrl && (
        <div className="w-full flex-shrink-0" style={{ height: '260px', minHeight: '260px' }}>
          <MediaCampaign attachemntUrl={attachemntUrl} mediaStatus={mediaStatus} />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center bg-[#0045FF] relative overflow-x-visible overflow-y-hidden">
        <div className="text-center mb-8 z-10">
          <h1 className="text-white text-7xl font-bold mb-4 flex items-center justify-center gap-4">
            {t(displayText)}
            <span className="text-white text-6xl">→</span>
          </h1>
          
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="w-4 h-4 bg-green-400 rounded-full"></div>
            <p className="text-white text-3xl font-semibold">
              {t("Оплата успешна!")}
            </p>
          </div>
        </div>

        <div className="relative w-full h-[800px] flex items-end justify-end pr-0 overflow-x-visible overflow-y-hidden">
          <div className="absolute -bottom-8 left-0 z-20 car-drive-animation">
            <img
              src={CarImage}
              alt="Car"
              className="w-auto h-[700px] md:h-[750px] object-contain"
            />
          </div>

          <div className="relative z-999 h-full flex items-start justify-end">
            <img
              src={BoxImage}
              alt="Car wash box"
              className="h-full max-h-[700px] w-auto object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
