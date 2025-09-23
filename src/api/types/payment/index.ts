import { EPaymentMethod } from "../../../components/state/order/orderSlice";

export interface IPaymentMethod  {
  label: string;
  imgUrl: string;
  type: EPaymentMethod;
  endPoint: string;
};

export interface ICreateOrderRequest {
  program_id: number,
  payment_type: EPaymentMethod,
  ucn?: string,
}