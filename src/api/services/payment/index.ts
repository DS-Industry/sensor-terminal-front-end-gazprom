import { axiosInstance } from "../../axiosConfig";
import { ICreateOrderRequest, ICreateOrderResponse, IGetOrderByIdResponse } from "../../types/payment";
import { logger } from "../../../util/logger";

enum PAYMENT {
  PAY = 'pay/',
  LOYALTY_CHECK = 'lty-check/',
  CANCELLATION = 'cancellation',
  ORDER_DETAIL = 'order-detail',
  UCN_CHECK = 'ucn-check',
  OPEN_READER = 'open-reader/',
  MOBILE_QR = 'mobile-qr',
  START = 'start',
};

export async function createOrder(
  body: ICreateOrderRequest,
): Promise<ICreateOrderResponse> {  
  logger.debug('Creating order', body);
  const response = await axiosInstance.post<ICreateOrderResponse>(PAYMENT.PAY, body);
  return response.data;
}

export async function getOrderById(
  order_id: string,
): Promise<IGetOrderByIdResponse> {
  const response = await axiosInstance.get<IGetOrderByIdResponse>(PAYMENT.ORDER_DETAIL + `/${order_id}/`);

  return response.data;
}

export async function cancelOrder(    
  order_id: string,
): Promise<void> {  
  logger.info(`Cancelling order: ${order_id}`);
  await axiosInstance.post(PAYMENT.CANCELLATION + `/${order_id}/`);
}

// Unused API functions - kept for potential future use
// These functions are not currently used but may be needed in the future
// export async function loyaltyCheck(): Promise<ILoyaltyCheckResponse> {
//   const response = await axiosInstance.get<ILoyaltyCheckResponse>(PAYMENT.LOYALTY_CHECK);
//   return response.data;
// }

// export async function ucnCheck(): Promise<IUcnCheckResponse> {
//   const response = await axiosInstance.get<IUcnCheckResponse>(PAYMENT.UCN_CHECK);
//   return response.data;
// }

// export async function openLoyaltyCardReader(signal?: AbortSignal): Promise<any> {  
//   const response = await axiosInstance.post(PAYMENT.OPEN_READER, {}, { 
//     signal 
//   });
//   return response.data;
// }

// export async function getMobileQr(): Promise<IGetMobileQr> {
//   const response = await axiosInstance.get<IGetMobileQr>(PAYMENT.MOBILE_QR);
//   return response.data;
// }

export async function startRobot(order_id: string): Promise<void> {  
  
  await axiosInstance.post(PAYMENT.START + `/${order_id}/`);
}