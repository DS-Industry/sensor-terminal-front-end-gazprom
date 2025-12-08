import { useEffect, useCallback } from 'react';
import useStore from '../state/store';
import { globalWebSocketManager, type WebSocketMessage } from '../../util/websocketManager';
import { EOrderStatus } from '../state/order/orderSlice';
import { getOrderById } from '../../api/services/payment';
import { logger } from '../../util/logger';

const MAX_ATTEMPS = 10;
const INTERVAL = 1000;

export function GlobalWebSocketManager() {
  const { order, setOrder, setBankCheck, setNavigationTarget, setErrorCode } = useStore();

  const setCheck = useCallback((id: string) => {
    let attempts = 0;

    const checkLoop = async () => {
      if (attempts >= MAX_ATTEMPS) {
        logger.warn(`Max attempts reached for check request: ${id}`);
        return;
      }

      attempts++;
      const response = await getOrderById(id);

      logger.debug(`Order request ${id}, attempt ${attempts}`, response);

      if (response.qr_code) {
        logger.debug(`Received QR code: ${response.qr_code}`);
        setBankCheck(response.qr_code);
        return; 
      }

      if (attempts < MAX_ATTEMPS) {
        setTimeout(checkLoop, INTERVAL);
      } else {
        logger.warn(`QR code not received after all attempts for order: ${id}`);
      }
    };

    checkLoop();
  }, [setBankCheck]);

  useEffect(() => {
    logger.debug('Initializing global WebSocket manager...');

    const handleStatusUpdate = (data: WebSocketMessage) => {
      if (data.type === 'status_update' && data.order_id) {
        logger.debug(`Updating order status globally: ${data.status}`);

        const orderStatus = data.status as EOrderStatus | undefined;

        setOrder({
          ...order,
          id: data.order_id,
          status: orderStatus,
          transactionId: data.transaction_id,
        });

      }

      if (data.status === EOrderStatus.PAYED && data.order_id) {
        setCheck(data.order_id);
      }

      if (data.status === EOrderStatus.PROCESSING) {
        const currentIsLoading = useStore.getState().isLoading;
        if (!currentIsLoading) {
          logger.info('Order is processing, navigating to washing page');
          setNavigationTarget('/washing');
        } else {
          logger.warn('Order status is PROCESSING but payment is still loading, delaying navigation');
        }
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
      removeStatusListener();
      removeErrorListener();
    };
  }, [order, setOrder, setCheck, setErrorCode, setNavigationTarget]);

  return null;
}