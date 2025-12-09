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
        const currentOrder = useStore.getState().order;
        
        if (!currentOrder?.id || currentOrder.id === data.order_id) {
          logger.debug(`Updating order status globally: ${data.status} for order ${data.order_id}`);
          console.log(`Updating order status globally: ${data.status}`)

          const orderStatus = data.status as EOrderStatus | undefined;

          setOrder({
            ...order,
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
      removeStatusListener();
      removeErrorListener();
    };
  }, [order, setOrder, setCheck, setErrorCode, setNavigationTarget]);

  return null;
}