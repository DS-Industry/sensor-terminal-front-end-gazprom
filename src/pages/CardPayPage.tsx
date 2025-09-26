import Wifi from "./../assets/wifi.svg";
import Card from "./../assets/card-big.svg";
import Mir from "./../assets/mir-logo 1.svg";
import { FaApplePay, FaGooglePay } from "react-icons/fa6";
import { RiMastercardLine, RiVisaLine } from "react-icons/ri";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CreditCard } from "@gravity-ui/icons";
import MediaCampaign from "../components/mediaCampaign/mediaCampaign";
import { useMediaCampaign } from "../hooks/useMediaCampaign";
import useStore from "../components/state/store";
import PaymentTitleSection from "../components/paymentTitleSection/PaymentTitleSection";
import HeaderWithLogo from "../components/headerWithLogo/HeaderWithLogo";
import { cancelOrder, createOrder, getOrderById, openLoyaltyCardReader, ucnCheck } from "../api/services/payment";
import { EOrderStatus, EPaymentMethod } from "../components/state/order/orderSlice";
import { useNavigate } from "react-router-dom";
import { LoyaltyCardModal } from "../components/modals/LoyaltyCardModal";

const DEPOSIT_TIME = 30000;
const PAYMENT_INTERVAL = 1000;
const LOYALTY_INTERVAL = 1000;

export default function CardPayPage() {
  const { t } = useTranslation();
  const { attachemntUrl } = useMediaCampaign();
  const navigate = useNavigate();
  const orderCreatedRef = useRef(false);
  const { order, selectedProgram, isLoyalty, openLoyaltyCardModal, closeLoyaltyCardModal, setIsLoading, isLoyaltyCardModalOpen } = useStore();

  const depositTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loyalityEmptyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkOrderAmountSumIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkLoyaltyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Функция для очистки всех таймеров лояльности
  const clearLoyaltyTimers = () => {
    if (checkLoyaltyIntervalRef.current) {
      clearInterval(checkLoyaltyIntervalRef.current);
      checkLoyaltyIntervalRef.current = null;
    }
    if (loyalityEmptyTimeoutRef.current) {
      clearTimeout(loyalityEmptyTimeoutRef.current);
      loyalityEmptyTimeoutRef.current = null;
    }
    console.log("[CardPayPage] Таймеры лояльности очищены");
  };

  // Функция для очистки всех таймеров оплаты
  const clearPaymentTimers = () => {
    if (depositTimeoutRef.current) {
      clearTimeout(depositTimeoutRef.current);
      depositTimeoutRef.current = null;
    }
    if (checkOrderAmountSumIntervalRef.current) {
      clearInterval(checkOrderAmountSumIntervalRef.current);
      checkOrderAmountSumIntervalRef.current = null;
    }
    console.log("[CardPayPage] Таймеры оплаты очищены");
  };

  // Функция для очистки всех таймеров
  const clearAllTimers = () => {
    clearLoyaltyTimers();
    clearPaymentTimers();
  };

  const createOrderAsync = async (ucn?: string) => {
    if (!selectedProgram || orderCreatedRef.current) {
      console.log("[CardPayPage] !selectedProgram || orderCreatedRef.current. Ошибка создания заказа");
      return;
    }

    orderCreatedRef.current = true;

    try {
      setIsLoading(true);

      await createOrder({
        program_id: selectedProgram.id,
        payment_type: EPaymentMethod.CASH,
        ucn: ucn,
      });

      if (ucn) {
        console.log("[CardPayPage] Создали заказ с UCN: ", ucn);
      } else {
        console.log("[CardPayPage] Создали заказ БЕЗ UCN");
      }

    } catch (err) {
      console.error('[CardPayPage] Ошибка создания заказа', err);
    }
  };

  const checkLoyaltyAsync = async () => {
    try {
      const ucnResponse = await ucnCheck();
      console.log('[CardPayPage] ucnCheck: ', ucnResponse);

      const ucnCode = ucnResponse.ucn;

      if (ucnCode) {
        console.log('[CardPayPage] Получили ucn код: ', ucnCode);
        clearLoyaltyTimers();
        closeLoyaltyCardModal();

        if (Number(ucnCode) !== -1) {
          await createOrderAsync(ucnCode);
        } else {
          // Обработка ошибки карты лояльности
          console.log("[CardPayPage] Ошибка карты лояльности");
          await createOrderAsync(); // Создаем заказ без UCN
        }
      }
    } catch (e) {
      console.log("[CardPayPage] Ошибка : ucnCheck", e);
    }
  };

  const checkPaymentAsync = async () => {
    try {
      if (order?.id) {
        const orderDetails = await getOrderById(order.id);

        if (orderDetails.amount_sum) {
          console.log("[CardPayPage] Внесено amount_sum: ", orderDetails.amount_sum);

          if (Number(orderDetails.amount_sum) >= Number(selectedProgram?.price)) {
            console.log("[CardPayPage] Получена вся сумма: ", orderDetails.amount_sum);
            clearAllTimers();
            navigate("/success");
          }
        }
      }
    } catch (e) {
      console.log("[CardPayPage] Ошибка : getOrderById", e);
    }
  };

  // Обработчик для кнопки "Продолжить без карты"
  const handleSkipLoyalty = async () => {
    console.log("[CardPayPage] Пользователь отказался от карты лояльности");
    
    // Очищаем таймеры лояльности
    clearLoyaltyTimers();
    
    // Закрываем модалку
    closeLoyaltyCardModal();
    
    // Создаем заказ без UCN
    await createOrderAsync();
  };

  useEffect(() => {
    // Если есть лояльность то показываем модалку и пингуем, ожидая ucn карточки лояльности
    if (isLoyalty) {
      console.log("[CardPayPage] Сценарий с лояльностью");
      // Открыли модалку Поднесите карту лояльности
      openLoyaltyCardModal();
      // Устанавливаем интервал на проверку была ли отсканирована карта лояльности
      openLoyaltyCardReader();
      
      checkLoyaltyIntervalRef.current = setInterval(checkLoyaltyAsync, LOYALTY_INTERVAL);
      loyalityEmptyTimeoutRef.current = setTimeout(async () => {
        console.log("[CardPayPage] Таймаут ожидания карты лояльности истек");
        clearLoyaltyTimers();
        closeLoyaltyCardModal();
        await createOrderAsync();
      }, DEPOSIT_TIME);
    } else {
      // Если без лояльности то просто создаем заказ
      createOrderAsync();
    }

    // Очистка при размонтировании компонента
    return () => {
      console.log("[CardPayPage] Размонтирование - очистка всех таймеров");
      clearAllTimers();
    };
  }, [isLoyalty]);

  useEffect(() => {
    console.log("[CardPayPage] Статус заказа: ", order?.status);

    if (order?.status === EOrderStatus.WAITING_PAYMENT) {
      setIsLoading(false);

      // Устанавливаем таймер на бездействие пользователя
      depositTimeoutRef.current = setTimeout(async () => {
        // Отменить заказ вернуться на главную 
        try {
          if (order.id) {
            console.log("[CardPayPage] Отменяем заказ по таймауту");
            await cancelOrder(order.id);
            navigate("/");
          }
        } catch (e) {
          console.log("[CardPayPage] Ошибка отмены заказа: ", e);
        }
      }, DEPOSIT_TIME);

      // Устанавливаем интервал на проверку внесенных средств
      checkOrderAmountSumIntervalRef.current = setInterval(checkPaymentAsync, PAYMENT_INTERVAL);
    }

    return () => {
      clearPaymentTimers();
    };
  }, [order]);

  const backButtonOnClick = () => {
    clearAllTimers();
    closeLoyaltyCardModal();
    setIsLoading(false);

    if (order?.id) {
      cancelOrder(order.id);
    }

    navigate('/');
  }

  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-100">
      {/* Video Section - 40% of screen height */}
      <MediaCampaign attachemntUrl={attachemntUrl} />

      {/* Content Section - 60% of screen height */}
      <div className="flex-1 flex flex-col">
        {/* Header with Logo and Controls */}
        <HeaderWithLogo backButtonClick={backButtonOnClick} />

        {/* Main Content Area - Full Screen */}
        <div className="flex-1 flex flex-col">
          {/* Title Section */}
          <PaymentTitleSection
            title="Оплата картой"
            description="Приложите банковскую карту для оплаты"
            icon={CreditCard}
          />

          {/* Payment Interface - Full Height */}
          <div className="flex-1 flex">
            {/* Left Side - Instructions and Graphics */}
            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
              <div className="relative mb-12">
                <img src={Wifi} alt="wifi" className="w-80 h-80 object-contain" />
                <img
                  src={Card}
                  alt="card"
                  className="absolute -bottom-12 -right-12 w-96 h-60 object-contain"
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

            {/* Right Side - Payment Details */}
            <div className="w-96 bg-gradient-to-br from-blue-500 to-blue-600 text-white flex flex-col">
              <div className="p-8 h-full flex flex-col justify-between">
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
                    <div className="text-white/80 text-sm mb-3">{t("К оплате")}</div>
                    <div className="text-white font-bold text-5xl">
                      {selectedProgram?.price} {t("р.")}
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="mt-8 text-center">
                  <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                    <div className="text-white/90 text-sm font-medium">
                      {t("Ожидание карты...")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoyaltyCardModalOpen && (
        <LoyaltyCardModal onSkipLoyalty={handleSkipLoyalty} />
      )}
    </div>
  );
}
