import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import useStore from "../components/state/store";
import CarImage from "../assets/car.png";
import MediaCampaign from "../components/mediaCampaign/mediaCampaign";
import { useMediaCampaign } from "../hooks/useMediaCampaign";
import { Clock } from "@gravity-ui/icons";
import { Icon } from "@gravity-ui/uikit";

const MEDIA_CAMPAIGN_URL = import.meta.env.VITE_MEDIA_CAMPAIGN_URL || "";

export default function WashingInProgressPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setIsLoading, selectedProgram } = useStore();
  const { attachemntUrl, mediaStatus } = useMediaCampaign(MEDIA_CAMPAIGN_URL);
  
  const [timeRemaining, setTimeRemaining] = useState(180);

  useEffect(() => {
    setIsLoading(false);

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
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} ${t("мин.")}`;
  };

  const handlePayInAdvance = () => {
    const { clearOrder, setIsLoading, setInsertedAmount } = useStore.getState();
    clearOrder();
    setIsLoading(false);
    setInsertedAmount(0);
    
    if (selectedProgram) {
      navigate(`/programs/${selectedProgram.id}/bankCard`);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-100">
      {attachemntUrl && (
        <div className="w-full flex-shrink-0" style={{ height: '260px', minHeight: '260px' }}>
          <MediaCampaign attachemntUrl={attachemntUrl} mediaStatus={mediaStatus} />
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center bg-[#0045FF] relative overflow-hidden">
        <div className="flex flex-col items-center justify-center max-w-4xl px-8 text-center">
          <h1 className="text-white text-6xl font-bold mb-6">
            {t("Идёт мойка...")}
          </h1>

          <p className="text-white text-2xl mb-8 max-w-2xl">
            {t("Вы можете оплатить мойку заранее, пока моется другой автомобиль")}
          </p>

          <button
            onClick={handlePayInAdvance}
            className="px-16 py-6 rounded-3xl text-[#0B68E1] bg-white font-semibold text-2xl transition-all duration-300 hover:opacity-90 hover:scale-105 shadow-lg mb-8"
          >
            {t("Оплатить заранее")}
          </button>

          <div className="flex items-center gap-3 text-white text-xl">
            <Icon data={Clock} size={24} className="text-white" />
            <span>
              {t("Осталось времени")}: {formatTime(timeRemaining)}
            </span>
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={() => navigate('/success?state=advance')}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm opacity-70 hover:opacity-100"
            >
              🧪 Test Advance Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

