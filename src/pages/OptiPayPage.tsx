import { Spin } from "@gravity-ui/uikit";
import PaymentTitleSection from "../components/paymentTitleSection/PaymentTitleSection";
import HeaderWithLogo from "../components/headerWithLogo/HeaderWithLogo";
import { usePaymentFlow } from "../hooks/payment/usePaymentFlow";
import SuccessPayment from "../components/successPayment/SuccessPayment";
import gazpromHeader from "../assets/gazprom-step-2-header.webp";
import optiHand from "../assets/opti-hand.jpg";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../components/state/store";
import { logger } from "../util/logger";
import { navigateToErrorPayment } from "../utils/navigation";
import { QrCode } from "@gravity-ui/icons";
import { PaymentState } from "../state/paymentStateMachine";
import { EPaymentMethod } from "../components/state/order/orderSlice";

export default function OptiPayPage() {
  const navigate = useNavigate();
  const { setErrorCode, selectedProgram, optiQrCode } = useStore();
  const hasNavigatedToErrorRef = useRef(false);

  const { 
    selectedProgram: flowSelectedProgram, 
    handleBack, 
    paymentSuccess,
    isPaymentProcessing,
    paymentError,
    queueFull,
    paymentState,
  } = usePaymentFlow(EPaymentMethod.OPTI);

  useEffect(() => {
    if (paymentError && !queueFull && !hasNavigatedToErrorRef.current) {
      logger.info('[OptiPayPage] Payment error detected, navigating to ErrorPaymentPage');
      hasNavigatedToErrorRef.current = true;
      setErrorCode(1002);
      navigateToErrorPayment(navigate);
    } else if (!paymentError) {
      hasNavigatedToErrorRef.current = false;
    }
  }, [paymentError, queueFull, navigate, setErrorCode]);

  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-100">
      <style>{`
        @keyframes handMoveUpDown {
          0% {
            transform: translateY(70%);
          }
          50% {
            transform: translateY(25%);
          }
          100% {
            transform: translateY(70%);
          }
        }
        
        .hand-animation {
          animation: handMoveUpDown 3s ease-in-out infinite;
        }
      `}</style>
      <div className="w-full flex-shrink-0 h-48 lg:h-62">
        <img 
          src={gazpromHeader} 
          alt="Header" 
          className="w-full h-full object-cover"
          decoding="async"
        />
      </div>
      <div className="flex-1 flex flex-col relative">
        <HeaderWithLogo backButtonClick={handleBack} paymentSuccess={paymentSuccess} />

        <div className="flex-1 flex flex-col relative">
          <PaymentTitleSection
            title="Оплата ОПТИ 24"
            description="Отсканируйте QR-код для оплаты мойки"
            icon={QrCode}
          />

          <div className="flex-1 flex relative">
            {optiQrCode && !paymentSuccess && !queueFull && (
              <div 
              className="absolute left-2/3 transform -translate-x-2/3 z-10 pointer-events-none"
              style={{
                height: '100%',       
                width: 'auto',
                maxWidth: 'none',
                overflow: 'hidden',
              }}
            >
              <img 
                src={optiHand} 
                alt="Hand holding phone" 
                className="hand-animation w-full h-full object-contain w-[1000px] h-[1000px]"
                style={{ transformOrigin: 'bottom center' }}
              />
            </div>
            )}
            {isPaymentProcessing && !paymentSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                <div className="flex flex-col items-center">
                  <Spin size="xl" />
                  <p className="text-gray-800 text-3xl font-semibold mt-8 mb-4">
                    Обработка оплаты...
                  </p>
                  <p className="text-gray-600 text-xl font-medium">
                    Пожалуйста, подождите подтверждения оплаты
                  </p>
                </div>
              </div>
            ) : queueFull ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-red-100 px-8">
                <div className="text-center max-w-2xl">
                  <div className="text-red-600 text-4xl font-bold mb-6">
                    Очередь заполнена
                  </div>
                  <div className="text-gray-800 text-xl mb-8 bg-white p-6 rounded-2xl shadow-lg">
                    В очереди уже находится один автомобиль. Пожалуйста, подождите окончания мойки.
                  </div>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={handleBack}
                      className="px-8 py-4 bg-gray-600 text-white rounded-2xl font-semibold text-lg hover:bg-gray-700 transition-all duration-300 hover:scale-105 shadow-lg"
                      aria-label="Назад"
                    >
                      Назад
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex bg-[#EEEEEE] relative">
                {/* Left side - SuccessPayment or QR Code */}
                {paymentSuccess && !paymentError && !queueFull ? (
                  <SuccessPayment />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center px-8">
                    <div className="flex flex-col items-center max-w-md">
                      {optiQrCode ? (
                        <>
                          <div className="w-[282px] h-[282px] bg-white rounded-2xl flex items-center justify-center mb-6 p-6 shadow-lg">
                            <img 
                              src={optiQrCode} 
                              alt="QR Code" 
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <p className="text-gray-800 text-2xl font-semibold mb-2 text-center">
                            Отсканируйте QR-код
                          </p>
                          <p className="text-gray-600 text-lg text-center mb-4">
                            Отсканируйте QR-код в мобильном приложении ОПТИ 24 и подтвердите оплату
                          </p>
                          {isPaymentProcessing && (
                            <div className="mt-4 flex items-center justify-center gap-2 bg-blue-100 px-4 py-2 rounded-full">
                              <Spin size="s" />
                              <p className="text-blue-800 text-sm font-medium">
                                Ожидание подтверждения оплаты...
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Spin size="xl" />
                          <p className="text-gray-800 text-2xl font-semibold mt-8 mb-4">
                            {paymentState === PaymentState.CREATING_ORDER
                              ? "Генерация QR-кода..."
                              : paymentState === PaymentState.WAITING_PAYMENT
                              ? "Ожидание QR-кода..."
                              : "Загрузка..."}
                          </p>
                          <p className="text-gray-600 text-lg">
                            Пожалуйста, подождите
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Right side - Payment panel (always visible when not error/queue) */}
                {!queueFull && (
                  <div className="w-96 bg-[#0967E1] text-white flex flex-col">
                    <div className="pt-3 px-6 h-full flex flex-col justify-start">
                      <div className="flex flex-col gap-10 py-10 justify-start h-full">
                        <div className="bg-white/10 p-4 rounded-2xl text-center">
                          <div className="text-white/80 text-sm mb-2 text-center">Программа</div>
                          <div className="text-white font-semibold text-lg text-center">{(flowSelectedProgram || selectedProgram)?.name}</div>
                        </div>

                        <div>
                          <div className="mt-3 bg-white/10 p-6 rounded-2xl">
                            <div className="flex justify-center">
                              <div className="text-white/80 text-sm mb-3 flex gap-2 items-center text-center">
                                <QrCode />
                                {paymentSuccess && !paymentError && !queueFull 
                                  ? "Оплачено" 
                                  : isPaymentProcessing 
                                  ? "Обработка..." 
                                  : "К оплате"}
                              </div>
                            </div>
                            <div className="text-white font-bold text-5xl text-center">
                              {(flowSelectedProgram || selectedProgram)?.price} ₽
                            </div>
                          </div>

                          {paymentSuccess && !paymentError && !queueFull
                            ? (
                              <div className="mt-3 flex items-center justify-center gap-2 bg-white/20 px-4 py-2 rounded-full w-full">
                                <div className="w-3 h-3 bg-[#15FF00] rounded-full animate-pulse"></div>
                                <div className="text-white/90 text-sm font-medium">
                                  Оплата успешна!
                                </div>
                              </div>
                            )
                            : isPaymentProcessing ? (
                              <div className="mt-3 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                                <div className="text-white">
                                  <Spin size="s" />
                                </div>
                                <div className="text-white/90 text-sm font-medium">
                                  Обработка оплаты...
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 flex items-center justify-center gap-2 bg-white/20 px-4 py-2 rounded-full w-full">
                                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                                <div className="text-white/90 text-sm font-medium">
                                  Ожидание оплаты...
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
