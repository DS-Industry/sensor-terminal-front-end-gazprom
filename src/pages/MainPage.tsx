import "./../App.css";
import ProgramCard from "../components/cards/ProgramCard";
import HeaderWithLogo from "../components/headerWithLogo/HeaderWithLogo";
import { usePrograms } from "../hooks/usePrograms";
import { useEffect } from "react";
import useStore from "../components/state/store";
import { EOrderStatus } from "../components/state/order/orderSlice";
import { startRobot } from "../api/services/payment";
import { useNavigate } from "react-router-dom";
import { logger } from "../util/logger";

import gazpromHeader from "../assets/gazprom-step-2-header.webp"

export default function MainPage() {
  const { programs } = usePrograms();
  const { 
    order, 
    clearOrder, 
    setInsertedAmount, 
    setIsLoading, 
    setErrorCode,
    setQueuePosition,
    setQueueNumber,
    setSelectedProgram,
    setBankCheck,
    setOptiQrCode,
    setBackConfirmationCallback,
    resetPayment,
  } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Clean all order-related states when entering main screen
    logger.info('[MainPage] Cleaning all order-related states');
    
    // Clear order
    clearOrder();
    
    // Reset payment state
    resetPayment();
    
    // Reset app state related to orders
    setInsertedAmount(0);
    setIsLoading(false);
    setErrorCode(null);
    setQueuePosition(null);
    setQueueNumber(null);
    setSelectedProgram(null);
    setBankCheck("");
    setOptiQrCode("");
    setBackConfirmationCallback(null);
  }, [
    clearOrder,
    resetPayment,
    setInsertedAmount,
    setIsLoading,
    setErrorCode,
    setQueuePosition,
    setQueueNumber,
    setSelectedProgram,
    setBankCheck,
    setOptiQrCode,
    setBackConfirmationCallback,
  ])

  useEffect(() => {
    if (order?.status === EOrderStatus.PAYED) {
      if (order.id) {
        startRobot(order.id)
          .then(() => {
            logger.info('Robot started successfully, navigating to success page');
            navigate('/success');
          })
          .catch((error) => {
            logger.error('Error starting robot from MainPage', error);
            setErrorCode(1004);
            navigate('/error');
          });
      }
    }
  }, [order, navigate, setErrorCode])

  return (
    <div className="flex flex-col min-h-[1024px] w-[1280px] bg-gray-200">
      <div className="w-full flex-shrink-0 h-64">
        <img 
          src={gazpromHeader} 
          alt="Header" 
          className="w-full h-full object-cover"
          decoding="async"
        />
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(1024px - 256px)' }}>
        <HeaderWithLogo isMainPage={true} title="Выберите программу" /> 

        <div className="flex-1 px-7 pb-7 overflow-y-auto" style={{ minHeight: 0 }}>
          <div className="flex flex-col">
            
            {programs && (
              <div className="flex-1 flex flex-col justify-center overflow-hidden">
              <div
                className={`w-full snap-x`}
              >
                <div
                  className={`flex flex-row justify-center items-stretch gap-6 w-full`}
                >
                    {programs.map((item) => (
                      <ProgramCard
                        key={`program-card-${item.id}`}
                        id={item.id}
                        name={item.name}
                        price={item.price}
                        lty_price={item.lty_price}
                        start_time_lty_price={item.start_time_lty_price}
                        end_time_lty_price={item.end_time_lty_price}
                        description={item.description}
                        duration={item.duration}
                        functions={item.functions}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
