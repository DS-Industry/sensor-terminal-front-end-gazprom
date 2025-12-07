/**
 * Payment-related constants
 */

export const PAYMENT_CONSTANTS = {
  /** Timeout for deposit/payment (60 seconds) */
  DEPOSIT_TIME: 60000,
  
  /** Interval for checking payment status (1 second) */
  PAYMENT_INTERVAL: 1000,
  
  /** Interval before automatic robot start (20 seconds) */
  START_ROBOT_INTERVAL: 20000,
  
  /** Maximum queue position before queue is considered full */
  MAX_QUEUE_POSITION: 2,
} as const;

