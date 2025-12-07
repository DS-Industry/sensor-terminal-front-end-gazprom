import Wifi from "./../assets/wifi.svg";
import Card from "./../assets/card-big.svg";
import Mir from "./../assets/mir-logo 1.svg";
import { FaApplePay, FaGooglePay } from "react-icons/fa6";
import { RiMastercardLine, RiVisaLine } from "react-icons/ri";
import { useTranslation } from "react-i18next";
import { CreditCard } from "@gravity-ui/icons";
import PaymentTitleSection from "../components/paymentTitleSection/PaymentTitleSection";
import HeaderWithLogo from "../components/headerWithLogo/HeaderWithLogo";
import { EPaymentMethod } from "../components/state/order/orderSlice";
import { usePaymentProcessing } from "../hooks/usePaymentProcessing";
import SuccessPayment from "../components/successPayment/SuccessPayment";
import gazpromHeader from "../assets/gazprom-step-2-header.png"

export default function CardPayPage() {
  const { t } = useTranslation();

  const { 
    selectedProgram, 
    handleBack, 
    paymentSuccess,
    handleStartRobot,
    handleRetry,
    timeUntilRobotStart,
    paymentError,
    simulateCardTap,
    queueFull
  } = usePaymentProcessing(EPaymentMethod.CARD);

  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-100">
      {/* Video Section - 40% of screen height */}
      <div className="w-full flex-shrink-0" style={{ height: '30vh', minHeight: '300px' }}>
        <img 
          src={gazpromHeader} 
          alt="Header" 
          className="w-full h-full object-cover"
        />
      </div>
      {/* <MediaCampaign attachemntUrl={attachemntUrl} mediaStatus={mediaStatus}/> */}
      
      {/* Content Section - 60% of screen height */}
      <div className="flex-1 flex flex-col">
        {/* Header with Logo and Controls */}
        <HeaderWithLogo backButtonClick={handleBack} />

        {/* Main Content Area - Full Screen */}
        <div className="flex-1 flex flex-col">
          {/* Title Section */}
          <PaymentTitleSection
            title={t("Оплата картой")}
            description={t("Приложите банковскую карту для оплаты")}
            icon={CreditCard}
          />

          {/* Payment Interface - Full Height */}
          <div className="flex-1 flex justify-end">
            {/* Left Side - Instructions and Graphics */}

            {paymentSuccess
              ? <SuccessPayment />
              : paymentError || queueFull ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-red-100 px-8">
                  <div className="text-center max-w-2xl">
                    <div className="text-red-600 text-4xl font-bold mb-6">
                      {queueFull ? t("Очередь заполнена") : t("Ошибка оплаты")}
                    </div>
                    <div className="text-gray-800 text-xl mb-8 bg-white p-6 rounded-2xl shadow-lg">
                      {queueFull 
                        ? t("В очереди уже находится один автомобиль. Пожалуйста, подождите окончания мойки.")
                        : paymentError || t("Произошла неизвестная ошибка")
                      }
                    </div>
                    <div className="flex gap-4 justify-center">
                      {!queueFull && (
                        <button
                          onClick={handleRetry}
                          className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-semibold text-lg hover:bg-blue-700 transition-all duration-300 hover:scale-105 shadow-lg"
                        >
                          {t("Повторить")}
                        </button>
                      )}
                      <button
                        onClick={handleBack}
                        className="px-8 py-4 bg-gray-600 text-white rounded-2xl font-semibold text-lg hover:bg-gray-700 transition-all duration-300 hover:scale-105 shadow-lg"
                      >
                        {t("Назад")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                  <div className="relative mb-12">
                    <img src={Wifi} alt="wifi" className="w-80 h-80 object-contain" />
                    <img
                      src={Card}
                      alt="card"
                      className="absolute -bottom-12 -right-12 w-96 h-60 object-contain"
                      style={{
                        animation: 'cardEnter 5s ease-in-out infinite'
                      }}
                    />
                  </div>
                  <div className="text-center max-w-md">
                    <div className="text-gray-800 text-2xl font-semibold mb-4">
                      {t("Поднесите карту к терминалу")}
                    </div>
                    <div className="text-gray-600 text-lg">
                      {t("Дождитесь подтверждения оплаты")}
                    </div>
                    {/* Test button - remove in production */}
                    <button
                      onClick={simulateCardTap}
                      className="mt-6 px-6 py-3 bg-green-500 text-white rounded-xl font-semibold text-sm hover:bg-green-600 transition-all duration-300 shadow-lg opacity-70 hover:opacity-100"
                      title="Test: Simulate card tap"
                    >
                      🧪 TEST: Simulate Card Tap
                    </button>
                  </div>
                </div>
              )}

            {/* Right Side - Payment Details */}
            <div className="w-96 bg-gradient-to-br from-blue-500 to-blue-600 text-white flex flex-col">
              <div className="p-8 h-full flex flex-col justify-start gap-6">
                {/* Payment Methods */}
                <div className="flex flex-col items-center mb-12">
                  <div className="text-white/80 text-sm mb-6 font-medium">{t("Поддерживаемые карты")}</div>
                  <div className="flex flex-wrap justify-center gap-6">
                    <RiMastercardLine className="text-white text-5xl" />
                    <RiVisaLine className="text-white text-5xl" />
                    <img src={Mir} alt="mir" className="w-16 h-16 object-contain" />
                    <FaGooglePay className="text-white text-5xl" />
                    <FaApplePay className="text-white text-5xl" />
                  </div>
                </div>

                {/* Payment Details */}
                <div className="space-y-6">
                  <div className="bg-white/10 p-4 rounded-2xl">
                    <div className="text-white/80 text-sm mb-2">{t("Программа")}</div>
                    <div className="text-white font-semibold text-lg">{t(`${selectedProgram?.name}`)}</div>
                  </div>

                  <div className="bg-white/10 p-6 rounded-2xl">
                    <div className="text-white/80 text-sm mb-3">{paymentSuccess ? t("Оплачено") : t("К оплате")}</div>
                    <div className="text-white font-bold text-5xl">
                      {selectedProgram?.price} {t("р.")}
                    </div>
                  </div>

                  {paymentSuccess
                    ? (
                      <div className="flex flex-col items-center">
                        <button
                          className="w-full px-8 py-4 rounded-3xl text-blue-600 font-semibold text-medium transition-all duration-300 hover:opacity-90 hover:scale-105 shadow-lg z-50 mb-2"
                          onClick={handleStartRobot}
                          style={{ backgroundColor: "white" }}
                          aria-label={t("Запустить")}
                        >
                          <div className="flex items-center justify-center gap-2">
                            {t("Запустить")}
                          </div>
                        </button>
                        {timeUntilRobotStart > 0 && (
                          <div className="text-white/80 text-l">
                            {t("Автоматический запуск через")} {timeUntilRobotStart} {t("сек.")}
                          </div>
                        )}
                      </div>
                    )
                    : (
                      <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                        <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                        <div className="text-white/90 text-sm font-medium">
                          {t("Ожидание карты...")}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
