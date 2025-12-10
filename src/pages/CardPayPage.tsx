import Wifi from "./../assets/wifi.svg";
import Card from "./../assets/card-big.svg";
import Mir from "./../assets/mir-logo 1.svg";
import { FaApplePay, FaGooglePay } from "react-icons/fa6";
import { RiMastercardLine, RiVisaLine } from "react-icons/ri";
import { useTranslation } from "react-i18next";
import { CreditCard } from "@gravity-ui/icons";
import { Spin } from "@gravity-ui/uikit";
import PaymentTitleSection from "../components/paymentTitleSection/PaymentTitleSection";
import HeaderWithLogo from "../components/headerWithLogo/HeaderWithLogo";
import { EPaymentMethod } from "../components/state/order/orderSlice";
import { usePaymentProcessing } from "../hooks/usePaymentProcessing";
import SuccessPayment from "../components/successPayment/SuccessPayment";
import gazpromHeader from "../assets/gazprom-step-2-header.webp"
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../components/state/store";
import { navigationLock } from "../util/navigationLock";
import { logger } from "../util/logger";

export default function CardPayPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setErrorCode } = useStore();
  const hasNavigatedToErrorRef = useRef(false);

  const { 
    selectedProgram, 
    handleBack, 
    paymentSuccess,
    isPaymentProcessing,
    handleStartRobot,
    timeUntilRobotStart,
    paymentError,
    queueFull,
    bankCheck
  } = usePaymentProcessing(EPaymentMethod.CARD);

  // Track if receipt is ready (with timeout similar to SuccessPayment)
  const [isReceiptReady, setIsReceiptReady] = useState(false);

  useEffect(() => {
    if (paymentError && !queueFull && !hasNavigatedToErrorRef.current) {
      logger.info('[CardPayPage] Payment error detected, navigating to ErrorPaymentPage');
      hasNavigatedToErrorRef.current = true;
      setErrorCode(1002);
      navigationLock.navigateWithLock(navigate, '/error-payment', 'CardPayPage: payment error');
    } else if (!paymentError) {
      hasNavigatedToErrorRef.current = false;
    }
  }, [paymentError, queueFull, navigate, setErrorCode]);

  useEffect(() => {
    // If receipt already exists, it's ready
    if (bankCheck) {
      setIsReceiptReady(true);
    } else if (paymentSuccess) {
      // If payment is successful but no receipt yet, wait up to 10 seconds
      const timeout = setTimeout(() => {
        setIsReceiptReady(true); // Allow starting even if receipt doesn't arrive
      }, 10000);

      return () => clearTimeout(timeout);
    } else {
      setIsReceiptReady(false);
    }
  }, [bankCheck, paymentSuccess]);

  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-100">
      <div className="w-full flex-shrink-0 h-48 lg:h-62">
        <img 
          src={gazpromHeader} 
          alt="Header" 
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 flex flex-col">
        <HeaderWithLogo backButtonClick={handleBack} />

        <div className="flex-1 flex flex-col">
          <PaymentTitleSection
            title={t("Оплата картой")}
            description={t("Приложите банковскую карту для оплаты")}
            icon={CreditCard}
          />

          <div className="flex-1 flex justify-end">

            {paymentSuccess && !paymentError && !queueFull
              ? <SuccessPayment />
              : isPaymentProcessing ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                  <div className="flex flex-col items-center">
                    <Spin size="xl" />
                    <p className="text-gray-800 text-3xl font-semibold mt-8 mb-4">
                      {t("Обработка оплаты...")}
                    </p>
                    <p className="text-gray-600 text-xl font-medium">
                      {t("Пожалуйста, подождите подтверждения оплаты")}
                    </p>
                  </div>
                </div>
              ) : queueFull ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-red-100 px-8">
                  <div className="text-center max-w-2xl">
                    <div className="text-red-600 text-4xl font-bold mb-6">
                      {t("Очередь заполнена")}
                    </div>
                    <div className="text-gray-800 text-xl mb-8 bg-white p-6 rounded-2xl shadow-lg">
                      {t("В очереди уже находится один автомобиль. Пожалуйста, подождите окончания мойки.")}
                    </div>
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={handleBack}
                        className="px-8 py-4 bg-gray-600 text-white rounded-2xl font-semibold text-lg hover:bg-gray-700 transition-all duration-300 hover:scale-105 shadow-lg"
                        aria-label={t("Назад")}
                      >
                        {t("Назад")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-[#EEEEEE]">
                  <div className="relative mb-12">
                    <img src={Wifi} alt="wifi" className="w-68 h-68 object-contain" />
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
                  </div>
                </div>
              )}

            <div className="w-96 bg-[#0967E1] text-white flex flex-col">
              <div className="pt-3 px-6 h-full flex flex-col justify-start">
                <div className="flex flex-col items-center">
                  <div className="text-white/80 text-[20px] font-medium">{t("Поддерживаемые карты")}</div>
                  <div className="grid grid-cols-3 gap-3 place-items-center">
                    <RiMastercardLine className="text-white text-5xl" />
                    <RiVisaLine className="text-white text-5xl" />
                    <img src={Mir} alt="mir" className="w-16 h-16 object-contain" />
                    <div className="col-span-3 flex justify-center items-center gap-3">
                      <FaGooglePay className="text-white text-5xl" />
                      <FaApplePay className="text-white text-5xl" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-white/10 p-4 rounded-2xl text-center">
                    <div className="text-white/80 text-sm mb-2 text-center">{t("Программа")}</div>
                    <div className="text-white font-semibold text-lg text-center">{t(`${selectedProgram?.name}`)}</div>
                  </div>

                  <div className="mt-3 bg-white/10 p-6 rounded-2xl">
                    <div className="flex justify-center">

                      <div className="text-white/80 text-sm mb-3 flex gap-2 items-center text-center">
                        <CreditCard />
                        {paymentSuccess && !paymentError && !queueFull 
                          ? t("Оплачено") 
                          : isPaymentProcessing 
                          ? t("Обработка...") 
                          : t("К оплате")}
                      </div>
                    </div>
                    <div className="text-white font-bold text-5xl text-center">
                      {selectedProgram?.price} {t("р.")}
                    </div>
                  </div>

                  {paymentSuccess && !paymentError && !queueFull
                    ? (
                      <div className="mt-3 flex flex-col items-center">
                        {!isReceiptReady && (
                          <div className="text-white/80 text-sm mb-2 flex items-center gap-2">
                            <Spin size="xs" />
                            {t("Формирование чека...")}
                          </div>
                        )}
                        <button
                          className="w-full px-8 py-4 rounded-3xl text-blue-600 font-semibold text-medium transition-all duration-300 hover:opacity-90 hover:scale-105 shadow-lg z-50 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={handleStartRobot}
                          disabled={!paymentSuccess || !!paymentError || queueFull || !isReceiptReady}
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
                    : isPaymentProcessing ? (
                      <div className="mt-3 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                        <div className="text-white">
                          <Spin size="s" />
                        </div>
                        <div className="text-white/90 text-sm font-medium">
                          {t("Обработка оплаты...")}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center justify-center gap-2 bg-white/20 px-4 py-2 rounded-full w-full">
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
