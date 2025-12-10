import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import useStore from "../components/state/store";
import { EOrderStatus } from "../components/state/order/orderSlice";
import { Clock } from "@gravity-ui/icons";
import { Icon } from "@gravity-ui/uikit";
import CarImage from "../assets/car.webp";
import { logger } from "../util/logger";
import { globalWebSocketManager, type WebSocketMessage } from "../util/websocketManager";
import { getOrderById } from "../api/services/payment";
import gazpromHeader from "../assets/gazprom-step-2-header.webp";

export default function QueueWaitingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setIsLoading, order, queuePosition } = useStore();
  
  const [timeRemaining, setTimeRemaining] = useState(180);

  useEffect(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  useEffect(() => {
    const handleStatusUpdate = async (data: WebSocketMessage) => {
      if (data.type === 'status_update' && data.status === EOrderStatus.COMPLETED) {
        logger.info('[QueueWaitingPage] Received COMPLETED status update', { orderId: data.order_id });
        
        if (order?.id && data.order_id !== order.id) {
          try {
            const userOrderDetails = await getOrderById(order.id);
            
            logger.debug('[QueueWaitingPage] User order details after another order completed', {
              completedOrderId: data.order_id,
              userOrderId: order.id,
              queuePosition: userOrderDetails.queue_position,
              status: userOrderDetails.status,
              currentUserQueuePosition: queuePosition
            });

            const { setOrder: setGlobalOrder, setQueuePosition: setGlobalQueuePosition } = useStore.getState();
            setGlobalOrder({
              id: userOrderDetails.id.toString(),
              status: userOrderDetails.status,
              transactionId: userOrderDetails.transaction_id,
              paymentMethod: userOrderDetails.payment_type,
              createdAt: new Date().toISOString(),
            });
            
            if (userOrderDetails.queue_position !== undefined) {
              setGlobalQueuePosition(userOrderDetails.queue_position);
            }

            logger.info('[QueueWaitingPage] Another order completed, order state updated. Redirecting to success page');
            navigate('/success', { replace: true });
          } catch (error) {
            logger.error('[QueueWaitingPage] Error checking user order details after completion', error);
          }
        }
      }
    };

    const removeStatusListener = globalWebSocketManager.addListener('status_update', handleStatusUpdate);

    return () => {
      removeStatusListener();
    };
  }, [navigate, order?.id, queuePosition]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!order?.id) return;

    const orderId = order.id;
    let isMounted = true;
    
    const checkQueueStatus = async () => {
      if (!isMounted) return;
      
      try {
        const orderDetails = await getOrderById(orderId);
        
        if (!isMounted) return;
        
        const { setOrder: setGlobalOrder, setQueuePosition: setGlobalQueuePosition } = useStore.getState();
        setGlobalOrder({
          id: orderDetails.id.toString(),
          status: orderDetails.status,
          transactionId: orderDetails.transaction_id,
          paymentMethod: orderDetails.payment_type,
          createdAt: new Date().toISOString(),
        });
        
        if (orderDetails.queue_position !== undefined) {
          setGlobalQueuePosition(orderDetails.queue_position);
          
          if (orderDetails.queue_position === 0 || orderDetails.queue_position === null) {
            logger.info('[QueueWaitingPage] Queue position updated to 0 or null, order state updated. Redirecting to success page');
            if (isMounted) {
              navigate('/success', { replace: true });
            }
          }
        }
      } catch (error) {
        if (isMounted) {
          logger.error('[QueueWaitingPage] Error checking queue status', error);
        }
      }
    };

    checkQueueStatus();
    
    const interval = setInterval(() => {
      if (isMounted) {
        checkQueueStatus();
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [order?.id, navigate]);

  useEffect(() => {
    if (queuePosition === null || queuePosition === 0) {
      logger.info('[QueueWaitingPage] Queue position changed to 0 or null, redirecting to success page');
      navigate('/success', { replace: true });
    }
  }, [queuePosition, navigate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} ${t("мин.")}`;
  };

  return (
    <div className="flex flex-col h-[1024px] w-[1280px] bg-[#0045FF] overflow-hidden">
      <div className="w-full flex-shrink-0 h-64">
        <img 
          src={gazpromHeader} 
          alt="Header" 
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0045FF] relative overflow-hidden" style={{ height: 'calc(1024px - 256px)' }}>
        <div className="flex flex-col items-center justify-center max-w-4xl px-8 text-center z-10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-4 h-4 bg-green-400 rounded-full"></div>
            <p className="text-white text-3xl font-semibold">
              {t("Оплата успешна!")}
            </p>
          </div>

          <h1 className="text-white text-5xl font-bold mb-6">
            {t("Ожидайте окончания мойки...")}
          </h1>

          <p className="text-white text-xl mb-8 max-w-2xl">
            {t("После окончания мойки наступит Ваша очередь, Вы сможете проехать в бокс!")}
          </p>

          <div className="flex items-center gap-3 text-white text-xl mb-8">
            <Icon data={Clock} size={24} className="text-white" />
            <span>
              {t("Осталось времени")}: {formatTime(timeRemaining)}
            </span>
          </div>
        </div>

        <div className="relative w-full h-[400px] flex items-end justify-end pr-0 overflow-hidden">
          <div className="absolute -bottom-8 left-0 z-20 car-drive-animation-success">
            <img
              src={CarImage}
              alt="Car"
              className="w-auto h-[600px] md:h-[600px] object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

