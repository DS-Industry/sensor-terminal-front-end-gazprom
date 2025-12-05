import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import useStore from "../components/state/store";
import { EOrderStatus } from "../components/state/order/orderSlice";
import BoxImage from "../assets/бокс.png";
import CarImage from "../assets/машина.png";
import MediaCampaign from "../components/mediaCampaign/mediaCampaign";
import { useMediaCampaign } from "../hooks/useMediaCampaign";
import { Clock } from "@gravity-ui/icons";
import { Icon } from "@gravity-ui/uikit";

const MEDIA_CAMPAIGN_URL = import.meta.env.VITE_MEDIA_CAMPAIGN_URL || "";

type SuccessState = 'initial' | 'washing' | 'advance';

export default function SuccessPaymentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setIsLoading, order, queuePosition } = useStore();
  const { attachemntUrl, mediaStatus } = useMediaCampaign(MEDIA_CAMPAIGN_URL);
  
  const [displayText, setDisplayText] = useState("Проезжайте в бокс!");
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes in seconds
  
  // Determine state from URL param or queue position
  // Queue screens should only show when queuePosition >= 1 (2+ orders exist, someone else is washing)
  // queuePosition === null or 0 means no queue, show initial success (car drives into box)
  const state: SuccessState = (searchParams.get('state') as SuccessState) || 
    (queuePosition !== null && queuePosition >= 1 ? 'advance' : 'initial');

  const handleFinish = () => {
    navigate("/");
  }

  const handlePayInAdvance = () => {
    navigate("/");
  }

  useEffect(() => {
    if (order?.status === EOrderStatus.COMPLETED) {
      handleFinish();
    }
  }, [order]);

  // Monitor queue position changes - when queue clears (becomes 0 or null), transition to "Проезжайте в бокс"
  useEffect(() => {
    // If we're in advance state and queue clears, transition to initial state
    if (state === 'advance' && (queuePosition === null || queuePosition === 0)) {
      console.log('[SuccessPaymentPage] Очередь очищена, переход к экрану "Проезжайте в бокс"');
      // Queue cleared, show "Проезжайте в бокс" screen
      // The state will automatically update because queuePosition changed
      // Force update by removing state param from URL to show initial state
      navigate('/success', { replace: true });
    }
  }, [queuePosition, state, navigate]);

  useEffect(() => {
    setIsLoading(false);

    if (state === 'initial') {
      const textTimer = setTimeout(() => {
        setDisplayText("Идет мойка");
      }, 10000);

      return () => {
        clearTimeout(textTimer);
      };
    }
  }, [state]);

  // Continuously monitor queue position to detect when queue clears
  useEffect(() => {
    if (state === 'advance' && order?.id) {
      // Poll order status to check queue position
      const checkQueueStatus = async () => {
        try {
          const { getOrderById } = await import('../api/services/payment');
          const orderDetails = await getOrderById(order.id);
          
          if (orderDetails.queue_position !== undefined) {
            const newQueuePosition = orderDetails.queue_position;
            
            // Update global queue position
            const { setQueuePosition: setGlobalQueuePosition } = useStore.getState();
            setGlobalQueuePosition(newQueuePosition);
            
            // If queue clears (becomes 0 or null), transition to "Проезжайте в бокс"
            if (newQueuePosition === 0 || newQueuePosition === null) {
              console.log('[SuccessPaymentPage] Очередь очищена, переход к экрану "Проезжайте в бокс"');
              navigate('/success', { replace: true });
            }
          }
        } catch (err) {
          console.error('[SuccessPaymentPage] Ошибка проверки статуса очереди', err);
        }
      };

      // Check immediately, then every 2 seconds
      checkQueueStatus();
      const interval = setInterval(checkQueueStatus, 2000);

      return () => clearInterval(interval);
    }
  }, [state, order?.id, navigate]);

  useEffect(() => {
    if (state === 'advance' || state === 'washing') {
      // Countdown timer for advance payment state
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
    const secs = seconds % 60;
    return `${mins} ${t("мин.")}`;
  };

  // Render different states
  if (state === 'advance') {
    // After advance payment - waiting for wash to finish
    return (
      <div className="flex flex-col min-h-screen w-screen bg-gray-100">
        {/* Promotional Banner Section */}
        {attachemntUrl && (
          <div className="w-full flex-shrink-0" style={{ height: '30vh', minHeight: '300px' }}>
            <MediaCampaign attachemntUrl={attachemntUrl} mediaStatus={mediaStatus} />
          </div>
        )}

        {/* Main Content Section */}
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0045FF] relative overflow-hidden">
          <div className="flex flex-col items-center justify-center max-w-4xl px-8 text-center">
            {/* Success Message */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-4 h-4 bg-green-400 rounded-full"></div>
              <p className="text-white text-3xl font-semibold">
                {t("Оплата успешна!")}
              </p>
            </div>

            {/* Main Message */}
            <h1 className="text-white text-5xl font-bold mb-6">
              {t("Ожидайте окончания мойки...")}
            </h1>

            {/* Instructions */}
            <p className="text-white text-xl mb-8 max-w-2xl">
              {t("После окончания мойки наступит Ваша очередь, Вы сможете проехать в бокс!")}
            </p>

            {/* Timer */}
            <div className="flex items-center gap-3 text-white text-xl mb-8">
              <Icon data={Clock} size={24} className="text-white" />
              <span>
                {t("Осталось времени")}: {formatTime(timeRemaining)}
              </span>
            </div>

            {/* Car Image - Partial */}
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

            {/* Test Navigation - Remove in production */}
            <div className="mt-8 flex gap-4">
              <button
                onClick={() => navigate('/success')}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm opacity-70 hover:opacity-100"
              >
                🧪 Test Initial State
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Initial success state - car driving into box
  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-100">
      {/* Promotional Banner Section */}
      {attachemntUrl && (
        <div className="w-full flex-shrink-0" style={{ height: '30vh', minHeight: '300px' }}>
          <MediaCampaign attachemntUrl={attachemntUrl} mediaStatus={mediaStatus} />
        </div>
      )}

      {/* Car Wash Bay Section */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0045FF] relative overflow-x-visible overflow-y-hidden">
        {/* Main Text */}
        <div className="text-center mb-8 z-10">
          <h1 className="text-white text-7xl font-bold mb-4 flex items-center justify-center gap-4">
            {t(displayText)}
            <span className="text-white text-6xl">→</span>
          </h1>
          
          {/* Success Message */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="w-4 h-4 bg-green-400 rounded-full"></div>
            <p className="text-white text-3xl font-semibold">
              {t("Оплата успешна!")}
            </p>
          </div>
        </div>

        {/* Car Wash Bay with Car Animation */}
        <div className="relative w-full h-[500px] flex items-end justify-end pr-0 overflow-x-visible overflow-y-hidden">
          {/* Car - Animated - Starts from left, drives to box */}
          <div className="absolute bottom-8 left-0 z-20 car-drive-animation">
            <img
              src={CarImage}
              alt="Car"
              className="w-auto h-64 md:h-80 object-contain"
            />
          </div>

          {/* Box/Car Wash Bay - Positioned at right edge */}
          <div className="relative z-10 h-full flex items-end justify-end">
            <img
              src={BoxImage}
              alt="Car wash box"
              className="h-full max-h-[500px] w-auto object-contain"
            />
          </div>
        </div>

        {/* Test Navigation - Remove in production */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => navigate('/success?state=advance')}
            className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-xs opacity-70 hover:opacity-100"
          >
            🧪 Test Advance
          </button>
          <button
            onClick={() => navigate('/washing')}
            className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-xs opacity-70 hover:opacity-100"
          >
            🧪 Test Washing
          </button>
        </div>
      </div>
    </div>
  );
}
