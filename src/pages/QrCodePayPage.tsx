import { useTranslation } from "react-i18next";
import { CreditCard } from "@gravity-ui/icons";
import HeaderWithLogo from "../components/headerWithLogo/HeaderWithLogo";
import PaymentTitleSection from "../components/paymentTitleSection/PaymentTitleSection";
import { EPaymentMethod } from "../components/state/order/orderSlice";
import { usePaymentProcessing } from "../hooks/usePaymentProcessing";
import SuccessPayment from "../components/successPayment/SuccessPayment";
import QRCode from "react-qr-code";

export default function QrCodePayPage() {
  const { t } = useTranslation();
  
  const {
    selectedProgram, 
    handleBack, 
    paymentSuccess,
    handleStartRobot,
    handlePayInAdvance,
    timeUntilRobotStart,
    queuePosition,
    queueNumber,
    isWashingInProgress,
    qrCode
  } = usePaymentProcessing(EPaymentMethod.MOBILE_PAYMENT);

  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-200">
      <div className="flex-1 flex flex-col">
        <HeaderWithLogo backButtonClick={handleBack} />

        <div className="flex-1 flex flex-col">
          <PaymentTitleSection
            title="Оплата ОПТИ-24"
            description="Отсканируйте QR-код для оплаты мойки"
            icon={CreditCard}
            iconClassName="text-blue-600"
          />

          <div className="flex-1 flex">
            {paymentSuccess
              ? <SuccessPayment />
              : (
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-200">
                  <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full mx-8">
                    <div className="flex justify-center mb-6">
                      {qrCode ? (
                        <div className="w-64 h-64 bg-white p-4 rounded-lg">
                          <QRCode
                            size={256}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            value={qrCode}
                            viewBox={`0 0 256 256`}
                          />
                        </div>
                      ) : (
                        <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                          <div className="text-gray-400 text-sm">{t("Загрузка QR-кода...")}</div>
                        </div>
                      )}
                    </div>

                    <div className="text-center space-y-2">
                      <div className="text-gray-900 font-bold text-xl">
                        {t("Отсканируйте QR-код")}
                      </div>
                      <div className="text-gray-600 text-base">
                        {t("Дождитесь подтверждения оплаты")}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            <div className="w-96 bg-gradient-to-br from-blue-500 to-blue-600 text-white flex flex-col">
              <div className="p-8 h-full flex flex-col justify-start gap-6">
                <div className="bg-blue-400 rounded-xl p-4">
                  <div className="text-white font-semibold text-lg text-center">
                    {t("Программа")} {t(selectedProgram?.name || "")}
                  </div>
                </div>

                <div className="space-y-6 flex-1">
                  <div className="bg-white/10 p-6 rounded-2xl">
                    <div className="text-white/80 text-sm mb-3">{paymentSuccess ? t("Оплачено") : t("К оплате")}</div>
                    <div className="text-white font-bold text-5xl">
                      {selectedProgram?.price} {t("р.")}
                    </div>
                  </div>

                  {paymentSuccess
                    ? (
                      <div className="flex flex-col items-center gap-4">
                        {isWashingInProgress ? (
                          <>
                            <div className="w-full bg-white/20 rounded-2xl p-6 text-center">
                              <div className="text-white font-bold text-xl mb-2">
                                {t("Идёт мойка...")}
                              </div>
                              <div className="text-white/90 text-sm mb-4">
                                {t("Вы можете оплатить мойку заранее, пока моется другой автомобиль")}
                              </div>
                              <div className="bg-white/30 rounded-xl p-4 mb-4">
                                <div className="text-white/80 text-sm mb-1">
                                  {t("Ваша позиция в очереди")}
                                </div>
                                <div className="text-white font-bold text-4xl">
                                  {queuePosition}
                                </div>
                                {queueNumber !== null && (
                                  <div className="text-white/70 text-xs mt-2">
                                    {t("Номер в очереди")}: {queueNumber}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              className="w-full px-8 py-4 rounded-3xl text-white font-semibold text-medium transition-all duration-300 hover:opacity-90 hover:scale-105 shadow-lg z-50 border-2 border-white/50"
                              onClick={handlePayInAdvance}
                              style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
                            >
                              <div className="flex items-center justify-center gap-2">
                                {t("Оплатить заранее")}
                              </div>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="w-full px-8 py-4 rounded-3xl text-blue-600 font-semibold text-medium transition-all duration-300 hover:opacity-90 hover:scale-105 shadow-lg z-50 mb-2"
                              onClick={handleStartRobot}
                              style={{ backgroundColor: "white" }}
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
                          </>
                        )}
                      </div>
                    )
                    : (
                      <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                        <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
                        <div className="text-white/90 text-sm font-medium">
                          {t("Ожидание сканирования...")}
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

