import BankCard from "./../assets/card-image.png";
import OptiSelection from "./../assets/opti-image.svg";
import { IPaymentMethod } from "../api/types/payment";
import { EPaymentMethod } from "../components/state/order/orderSlice";

export const PAYS: IPaymentMethod[] = [
  {
    label: "Банковская карта",
    imgUrl: BankCard,
    type: EPaymentMethod.CARD,
    endPoint: "bankCard",
  },
  {
    label: "Топливная карта",
    imgUrl: OptiSelection,
    type: EPaymentMethod.OPTI,
    endPoint: "opti24",
  },
];
