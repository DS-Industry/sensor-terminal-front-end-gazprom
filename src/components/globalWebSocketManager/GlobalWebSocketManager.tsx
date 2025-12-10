import { useEffect, useCallback, useRef } from 'react';
import useStore from '../state/store';
import { globalWebSocketManager, type WebSocketMessage } from '../../util/websocketManager';
import { EOrderStatus } from '../state/order/orderSlice';
import { getOrderById } from '../../api/services/payment';
import { logger } from '../../util/logger';

const MAX_ATTEMPS = 10;
const INTERVAL = 1000;

export function GlobalWebSocketManager() {
  const { setOrder, setBankCheck, setNavigationTarget, setErrorCode } = useStore();
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeCheckIdRef = useRef<string | null>(null);
  const checkAbortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Helper function to clean up all check-related resources
  const cleanupCheckLoop = useCallback(() => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
      checkTimeoutRef.current = null;
    }
    if (checkAbortControllerRef.current) {
      checkAbortControllerRef.current.abort();
      checkAbortControllerRef.current = null;
    }
    activeCheckIdRef.current = null;
  }, []);

  const setCheck = useCallback((id: string) => {
    // Cancel any existing check loop for a different order
    if (activeCheckIdRef.current && activeCheckIdRef.current !== id) {
      logger.debug(`Cancelling previous check loop for order: ${activeCheckIdRef.current}`);
      cleanupCheckLoop();
    }

    // If same order is already being checked, skip
    if (activeCheckIdRef.current === id && checkTimeoutRef.current) {
      logger.debug(`Check loop already running for order: ${id}`);
      return;
    }

    activeCheckIdRef.current = id;
    let attempts = 0;

    // Create new AbortController for this check loop
    checkAbortControllerRef.current = new AbortController();
    const abortSignal = checkAbortControllerRef.current.signal;

    const checkLoop = async () => {
      // Check if aborted (component unmounted or new check started)
      if (abortSignal.aborted) {
        logger.debug(`Check loop aborted for order: ${id}`);
        return;
      }

      if (attempts >= MAX_ATTEMPS) {
        logger.warn(`Max attempts reached for check request: ${id}`);
        cleanupCheckLoop();
        return;
      }

      attempts++;

      try {
        const response = await getOrderById(id);

        // Check again if aborted after async operation
        if (abortSignal.aborted) {
          logger.debug(`Check loop aborted after API call for order: ${id}`);
          return;
        }

        logger.debug(`Order request ${id}, attempt ${attempts}`, response);

        if (response.qr_code) {
          logger.debug(`Received QR code: ${response.qr_code}`);
          // Only update state if component is still mounted
          if (isMountedRef.current) {
            setBankCheck(response.qr_code);
          }
          cleanupCheckLoop();
          return; 
        }

        if (attempts < MAX_ATTEMPS && !abortSignal.aborted) {
          checkTimeoutRef.current = setTimeout(() => {
            checkTimeoutRef.current = null;
            checkLoop();
          }, INTERVAL);
        } else {
          logger.warn(`QR code not received after all attempts for order: ${id}`);
          cleanupCheckLoop();
        }
      } catch (error) {
        // Don't log if aborted (expected)
        if (abortSignal.aborted) {
          return;
        }
        logger.error(`Error in check loop for order ${id}`, error);
        
        // Continue retrying unless aborted
        if (attempts < MAX_ATTEMPS && !abortSignal.aborted) {
          checkTimeoutRef.current = setTimeout(() => {
            checkTimeoutRef.current = null;
            checkLoop();
          }, INTERVAL);
        } else {
          cleanupCheckLoop();
        }
      }
    };

    checkLoop();
  }, [setBankCheck, cleanupCheckLoop]);

  useEffect(() => {
    isMountedRef.current = true;
    logger.debug('Initializing global WebSocket manager...');

    const handleStatusUpdate = (data: WebSocketMessage) => {
      if (data.type === 'status_update' && data.order_id) {
        const currentOrder = useStore.getState().order;
        
        if (!currentOrder?.id || currentOrder.id === data.order_id) {
          logger.debug(`Updating order status globally: ${data.status} for order ${data.order_id}`);
          
          if (import.meta.env.DEV) {
            console.log(`Updating order status globally: ${data.status}`);
          }

          const orderStatus = data.status as EOrderStatus | undefined;

          setOrder({
            ...currentOrder,
            id: data.order_id,
            status: orderStatus,
            transactionId: data.transaction_id,
          });

          if (orderStatus === EOrderStatus.COMPLETED) {
            setNavigationTarget('/');
          }
        } else {
          logger.debug(`Ignoring status update for different order: ${data.order_id} (current order: ${currentOrder.id})`);
        }
      }

      if (data.status === EOrderStatus.PAYED && data.order_id) {
        setCheck(data.order_id);
      }
    };

    interface WebSocketError extends WebSocketMessage {
      code?: number;
    }

    const handleError = (data: WebSocketError) => {
      if (data.type === 'error') {
        logger.error('WebSocket error received', data);

        if (data.code !== undefined) {
          setErrorCode(data.code);
        }
        setNavigationTarget('/error');
      }
    };

    const removeStatusListener = globalWebSocketManager.addListener('status_update', handleStatusUpdate);
    const removeErrorListener = globalWebSocketManager.addListener('error', handleError);

    return () => {
      // Mark component as unmounted to prevent state updates
      isMountedRef.current = false;
      
      // Cleanup: cancel any active check loops
      cleanupCheckLoop();
      
      // Remove WebSocket listeners
      removeStatusListener();
      removeErrorListener();
    };
  }, [setOrder, setCheck, setErrorCode, setNavigationTarget]);

  return null;
}