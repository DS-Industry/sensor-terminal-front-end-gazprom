import { StoreSlice } from "../types";
import { PaymentState } from "../../../state/paymentStateMachine";

export interface PaymentSlice {
  paymentState: PaymentState;
  paymentError: string | null;
  timeUntilRobotStart: number;
  setPaymentState: (state: PaymentState) => void;
  setPaymentError: (error: string | null) => void;
  setTimeUntilRobotStart: (time: number) => void;
  resetPayment: () => void;
}

export const createPaymentSlice: StoreSlice<PaymentSlice> = (set) => ({
  paymentState: PaymentState.IDLE,
  paymentError: null,
  timeUntilRobotStart: 0,

  setPaymentState: (state) => {
    set((currentState) => {
      if (currentState.paymentState === PaymentState.PAYMENT_SUCCESS) {
        const allowedTransitions = [
          PaymentState.QUEUE_WAITING,
          PaymentState.STARTING_ROBOT,
          PaymentState.ROBOT_STARTED,
          PaymentState.PAYMENT_ERROR,
        ];
        
        if (!allowedTransitions.includes(state)) {
          if (typeof window !== 'undefined' && import.meta.env.DEV) {
            console.warn(`[PaymentSlice] Blocked state change from PAYMENT_SUCCESS to ${state}`);
          }
          return currentState;
        }
      }
      
      return { ...currentState, paymentState: state };
    });
  },

  setPaymentError: (error) => {
    set((currentState) => ({ ...currentState, paymentError: error }));
  },

  setTimeUntilRobotStart: (time) => {
    set((currentState) => ({ ...currentState, timeUntilRobotStart: time }));
  },

  resetPayment: () => {
    set((currentState) => ({
      ...currentState,
      paymentState: PaymentState.IDLE,
      paymentError: null,
      timeUntilRobotStart: 0,
    }));
  },
});
