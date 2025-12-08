import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import useStore from "../components/state/store";
import { useEffect, useRef } from "react";
import gazpromHeader from "../assets/gazprom-step-2-header.png";

const IDLE_TIMEOUT = 5000;

export default function ErrorPaymentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { errorCode, setIsLoading } = useStore();
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const isVariant2 = searchParams.get('variant') === '2' || errorCode === 1005;

  const handleFinish = () => {
    navigate("/");
  }

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
  }, []);

  const getErrorDisplayText = () => {
    switch (errorCode) {
      case 1001:
        return t("Ошибка приема наличных средств. Воспользуйтесь другим способом оплаты.");
      case 1002:
        return t("Ошибка безналичной оплаты. Воспользуйтесь другим способом оплаты.");
      case 1003:
        return t("Ошибка оплаты картой лояльности. Воспользуйтесь другим способом оплаты.");
      case 1004:
      case 1005:
        return t("Ошибка запуска робота!");
      default:
        return t("Ошибка запуска робота!");
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-100 bg-[#0045FF]">
        <div className="w-full flex-shrink-0 h-48 md:h-64 lg:h-62">
        <img 
          src={gazpromHeader} 
          alt="Header" 
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0045FF] relative">
        <div className="flex flex-col items-center justify-center max-w-4xl px-8">
          <div className="mb-8">
            <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-lg">
              <span className="text-red-500 text-8xl font-bold">!</span>
            </div>
          </div>

          <h1 className="text-white text-6xl font-bold mb-6 text-center">
            {getErrorDisplayText()}
          </h1>

          {isVariant2 && (
            <p className="text-white text-2xl mb-8 text-center">
              {t("Проверьте баланс карты или обратитесь к оператору")}
            </p>
          )}

          <button
            className="px-16 py-6 rounded-3xl text-[#0B68E1] bg-white font-semibold text-2xl transition-all duration-300 hover:opacity-90 hover:scale-105 shadow-lg"
            onClick={handleFinish}
            aria-label={t("Закрыть")}
          >
            {t("Закрыть")}
          </button>

          {import.meta.env.DEV && (
            <div className="mt-8 flex gap-4">
              <button
                onClick={() => navigate('/error?variant=1')}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm opacity-70 hover:opacity-100"
              >
                🧪 Test Variant 1
              </button>
              <button
                onClick={() => navigate('/error?variant=2')}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm opacity-70 hover:opacity-100"
              >
                🧪 Test Variant 2
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
