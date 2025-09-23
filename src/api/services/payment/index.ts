import { axiosInstance } from "../../axiosConfig";
import { ICreateOrderRequest } from "../../types/payment";

enum PAYMENT {
  PAY = '/pay/',
};

export async function createOrder(
  body: ICreateOrderRequest,
): Promise<void> {  
  
  axiosInstance.post(PAYMENT.PAY, body);
}