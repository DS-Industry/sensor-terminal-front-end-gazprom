import "./../App.css";
import ProgramCard from "../components/cards/ProgramCard";
import { useTranslation } from "react-i18next";
import HeaderWithLogo from "../components/headerWithLogo/HeaderWithLogo";
import { usePrograms } from "../hooks/usePrograms";
import { useEffect } from "react";
import useStore from "../components/state/store";
import { EOrderStatus } from "../components/state/order/orderSlice";
import { startRobot } from "../api/services/payment";
import { useNavigate } from "react-router-dom";
import { logger } from "../util/logger";

import gazpromHeader from "../assets/gazprom-step-2-header.png"

export default function MainPage() {
  const { t } = useTranslation();
  const { programs } = usePrograms();
  const { order, clearOrder, setInsertedAmount, setIsLoading } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    clearOrder();
    setInsertedAmount(0);
    setIsLoading(false);
  }, [clearOrder, setInsertedAmount, setIsLoading])

  useEffect(() => {
    if (order?.status === EOrderStatus.PAYED) {
      if (order.id) {
        startRobot(order.id).catch((error) => {
          logger.error('Error starting robot from MainPage', error);
        });
        navigate('/success');
      }
    }
  }, [order, navigate])

  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-200">
      <div className="w-full flex-shrink-0 h-48 md:h-64 lg:h-62">
        <img 
          src={gazpromHeader} 
          alt="Header" 
           className="w-full h-full object-cover"
        />
      </div>
      
      <div className="flex-1 flex flex-col">
        <HeaderWithLogo isMainPage={true} title={t("Выберите программу")} /> 

        <div className="flex-1 px-7 pb-7">
          <div className="flex flex-col h-full">
            
            {programs && (
              <div className="flex-1 flex flex-col justify-center">
                <div
                  className={`w-full snap-x`}
                >
                  <div
                    className={`flex flex-row justify-center gap-6 w-full`}
                  >
                    {programs.map((item) => (
                      <ProgramCard
                        key={`program-card-${item.id}`}
                        id={item.id}
                        name={item.name}
                        price={item.price}
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
