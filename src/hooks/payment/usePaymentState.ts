import { useReducer, useCallback } from 'react';
import { PaymentState } from '../../util/paymentUtils';

export interface PaymentStateData {
  success: boolean;
  processing: boolean;
  error: string | null;
  
  queuePosition: number | null;
  queueNumber: number | null;
  queueFull: boolean;
  
  timeUntilRobotStart: number;
  timeUntilTimeout: number | null;
  showTimeoutWarning: boolean;
  
  qrCode: string | null;
  state: PaymentState;
}

type PaymentStateAction =
  | { type: 'SET_SUCCESS'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_QUEUE_POSITION'; payload: number | null }
  | { type: 'SET_QUEUE_NUMBER'; payload: number | null }
  | { type: 'SET_QUEUE_FULL'; payload: boolean }
  | { type: 'SET_TIME_UNTIL_ROBOT_START'; payload: number }
  | { type: 'SET_TIME_UNTIL_TIMEOUT'; payload: number | null }
  | { type: 'SET_SHOW_TIMEOUT_WARNING'; payload: boolean }
  | { type: 'SET_QR_CODE'; payload: string | null }
  | { type: 'SET_STATE'; payload: PaymentState }
  | { type: 'RESET' }
  | { type: 'RESET_ERROR' }
  | { type: 'RESET_TIMERS' };

const initialState: PaymentStateData = {
  success: false,
  processing: false,
  error: null,
  queuePosition: null,
  queueNumber: null,
  queueFull: false,
  timeUntilRobotStart: 0,
  timeUntilTimeout: null,
  showTimeoutWarning: false,
  qrCode: null,
  state: PaymentState.IDLE,
};

function paymentReducer(
  state: PaymentStateData,
  action: PaymentStateAction
): PaymentStateData {
  switch (action.type) {
    case 'SET_SUCCESS':
      return { ...state, success: action.payload };
    case 'SET_PROCESSING':
      return { ...state, processing: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_QUEUE_POSITION':
      return { ...state, queuePosition: action.payload };
    case 'SET_QUEUE_NUMBER':
      return { ...state, queueNumber: action.payload };
    case 'SET_QUEUE_FULL':
      return { ...state, queueFull: action.payload };
    case 'SET_TIME_UNTIL_ROBOT_START':
      return { ...state, timeUntilRobotStart: action.payload };
    case 'SET_TIME_UNTIL_TIMEOUT':
      return { ...state, timeUntilTimeout: action.payload };
    case 'SET_SHOW_TIMEOUT_WARNING':
      return { ...state, showTimeoutWarning: action.payload };
    case 'SET_QR_CODE':
      return { ...state, qrCode: action.payload };
    case 'SET_STATE':
      return { ...state, state: action.payload };
    case 'RESET':
      return initialState;
    case 'RESET_ERROR':
      return { ...state, error: null };
    case 'RESET_TIMERS':
      return {
        ...state,
        timeUntilRobotStart: 0,
        timeUntilTimeout: null,
        showTimeoutWarning: false,
      };
    default:
      return state;
  }
}

export function usePaymentState() {
  const [state, dispatch] = useReducer(paymentReducer, initialState);

  const actions = {
    setSuccess: useCallback((value: boolean) => {
      dispatch({ type: 'SET_SUCCESS', payload: value });
    }, []),
    
    setProcessing: useCallback((value: boolean) => {
      dispatch({ type: 'SET_PROCESSING', payload: value });
    }, []),
    
    setError: useCallback((error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    }, []),
    
    setQueuePosition: useCallback((position: number | null) => {
      dispatch({ type: 'SET_QUEUE_POSITION', payload: position });
    }, []),
    
    setQueueNumber: useCallback((number: number | null) => {
      dispatch({ type: 'SET_QUEUE_NUMBER', payload: number });
    }, []),
    
    setQueueFull: useCallback((full: boolean) => {
      dispatch({ type: 'SET_QUEUE_FULL', payload: full });
    }, []),
    
    setTimeUntilRobotStart: useCallback((time: number) => {
      dispatch({ type: 'SET_TIME_UNTIL_ROBOT_START', payload: time });
    }, []),
    
    setTimeUntilTimeout: useCallback((time: number | null) => {
      dispatch({ type: 'SET_TIME_UNTIL_TIMEOUT', payload: time });
    }, []),
    
    setShowTimeoutWarning: useCallback((show: boolean) => {
      dispatch({ type: 'SET_SHOW_TIMEOUT_WARNING', payload: show });
    }, []),
    
    setQrCode: useCallback((code: string | null) => {
      dispatch({ type: 'SET_QR_CODE', payload: code });
    }, []),
    
    setState: useCallback((newState: PaymentState) => {
      dispatch({ type: 'SET_STATE', payload: newState });
    }, []),
    
    reset: useCallback(() => {
      dispatch({ type: 'RESET' });
    }, []),
    
    resetError: useCallback(() => {
      dispatch({ type: 'RESET_ERROR' });
    }, []),
    
    resetTimers: useCallback(() => {
      dispatch({ type: 'RESET_TIMERS' });
    }, []),
  };

  return { state, actions };
}

