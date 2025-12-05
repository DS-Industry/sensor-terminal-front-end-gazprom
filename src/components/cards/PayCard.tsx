import { RiMastercardLine, RiVisaLine } from "react-icons/ri";
import { FaApplePay, FaGooglePay } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, Text, Icon } from "@gravity-ui/uikit";
import { SealPercent } from '@gravity-ui/icons';
import { EPaymentMethod } from "../state/order/orderSlice";


interface IPayCard {
  payType: EPaymentMethod;
  label: string;
  imgUrl: string;
  endPoint: string;
  programName: string;
  price: string;
}

export default function PayCard({
  payType,
  label,
  imgUrl,
  endPoint,
  programName,
  price,
}: IPayCard) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (payType === EPaymentMethod.QR_CODE) {
    return (
      <div
        className="w-80 h-64 bg-gray-200 rounded-3xl relative cursor-pointer hover:scale-105 transition-all duration-300 overflow-hidden  bg-gradient-to-br from-blue-500 to-blue-600"
        onClick={() => {
          navigate(`./${endPoint}`, {
            state: {
              programName: programName,
              price: price,
            },
          });
        }}
      >
        <div className="absolute top-4 left-4 z-0">
          <Text className="text-gray-400 font-bold text-2xl">
            ОПТИ-24
          </Text>
        </div>

        <Card
          type="action"
          className="absolute inset-4 bg-white rounded-3xl shadow-xl border-0 flex flex-col"
        >
          <div className="p-6 h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center">
              <img
                src={imgUrl}
                alt="QR Code"
                className="w-40 h-40 object-contain"
              />
            </div>

            <div className="bg-blue-300 rounded-xl p-3 mt-auto">
              <div className="text-white text-xs text-center leading-relaxed">
                {t("Оплата с помощью QR-кода для юридических лиц")}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <Card
      type="action"
      className="w-80 h-64 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer hover:scale-105 border-0 overflow-hidden"
      onClick={() => {
        navigate(`./${endPoint}`, {
          state: {
            programName: programName,
            price: price,
          },
        });
      }}
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-start mb-4 relative">
          <Text className="text-white font-bold text-2xl">
            {t(`${label}`)}
          </Text>
          {(payType === EPaymentMethod.MOBILE_PAYMENT) && (
            <div className="absolute top-0 right-0 bg-yellow-400 p-2 rounded-full">
              <Icon data={SealPercent} size={20} className="text-yellow-800" />
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center">
          <img
            src={imgUrl}
            alt="logo pay way"
            className="h-24 w-auto object-contain"
          />
        </div>

        <div className="mt-4 h-20 flex items-center">
          {payType === EPaymentMethod.CARD && (
            <div className="bg-white/20 p-2 rounded-2xl text-center w-full h-full flex flex-col justify-center">
              <div className="text-white/80 text-sm mb-1">{t("Банковские карты")}</div>
              <div className="flex flex-row justify-center gap-3 items-center h-6">
                <RiMastercardLine className="text-white text-xl" />
                <RiVisaLine className="text-white text-xl" />
                <FaApplePay className="text-white text-xl" />
                <FaGooglePay className="text-white text-xl" />
              </div>
            </div>
          )}

          {payType === EPaymentMethod.CASH && (
            <div className="bg-white/20 p-2 rounded-2xl text-center w-full h-full flex flex-col justify-center">
              <div className="text-white/80 text-sm mb-1">{t("Купюры")}</div>
              <div className="text-white font-semibold text-base h-6 flex items-center justify-center">50, 100, 200</div>
            </div>
          )}

          {(payType === EPaymentMethod.LOYALTY) && (
            <div className="bg-white/20 p-2 rounded-2xl text-center w-full h-full flex flex-col justify-center">
              <div className="text-white/80 text-sm mb-1">
                {t("Карта лояльности")}
              </div>
              <div className="text-white font-bold text-base h-6 flex items-center justify-center">МОЙ-КА! DS</div>
            </div>
          )}

          {(payType === EPaymentMethod.MOBILE_PAYMENT) && (
            <div className="bg-white/20 p-2 rounded-2xl text-center w-full h-full flex flex-col justify-center">
              <div className="text-white/80 text-sm mb-1">
                {t("Ваш CashBack")}
              </div>
              <div className="text-white font-bold text-base h-6 flex items-center justify-center">+10%</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
