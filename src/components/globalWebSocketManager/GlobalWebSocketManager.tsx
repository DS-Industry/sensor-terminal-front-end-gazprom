import { useEffect } from 'react';
import useStore from '../state/store';
import { globalWebSocketManager } from '../../util/websocketManager';

export function GlobalWebSocketManager() {
  const { setOrder, order } = useStore();

  useEffect(() => {
    console.log('Initializing global WebSocket manager...');

    const handleStatusUpdate = (data: any) => {
      if (data.type === 'status_update' && data.order_id) {
        console.log('🔄 Updating order status globally:', data.status);
        
        setOrder({
          ...order,
          id: data.order_id,
          status: data.status,
          transactionId: data.transaction_id,
        });

      }
    };

    const removeStatusListener = globalWebSocketManager.addListener('status_update', handleStatusUpdate);

    return () => {
      removeStatusListener();
    };
  }, []);

  return null;
}