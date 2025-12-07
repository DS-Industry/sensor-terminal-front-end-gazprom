import { PAYS } from "../pays-data";
import PayCard from "../components/cards/PayCard";
import { useTranslation } from "react-i18next";
import { Clock } from "@gravity-ui/icons";
import { Check } from "lucide-react";
import HeaderWithLogo from "../components/headerWithLogo/HeaderWithLogo";
import { Icon, Text, Card } from "@gravity-ui/uikit";
import useStore from "../components/state/store";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import gazpromHeader from "../assets/gazprom-step-2-header.png";

const IDLE_TIMEOUT = 30000;

export default function SingleProgramPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedProgram } = useStore();
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFinish = () => {
    navigate("/");
  }

  const clearIdleTimeout = () => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    if (!idleTimeoutRef.current) {
      idleTimeoutRef.current = setTimeout(handleFinish, IDLE_TIMEOUT);
    }

    return () => {
      clearIdleTimeout();
    };
  }, []);


  return (
    <div className="flex flex-col min-h-screen w-screen bg-gray-200">
      {/* Header Image Section - 30% of screen */}
      <div className="w-full flex-shrink-0" style={{ height: '30vh', minHeight: '300px' }}>
        <img 
          src={gazpromHeader} 
          alt="Header" 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content Section - 70% of screen */}
      <div className="flex-1 flex flex-col bg-gray-200 overflow-hidden">
        {/* Header with Logo and Controls */}
        <HeaderWithLogo />

        {/* Main Content Area */}
        <div className="flex-1 px-7 pb-7 overflow-y-auto">
          {selectedProgram && (
            <div className="flex flex-col h-full">
              {/* Page Title */}
              <div className="mb-8 mt-2">
                <div className="text-gray-900 font-bold text-4xl text-center">
                  {t("Выберите способ оплаты")}
                </div>
              </div>

              {/* Main Content Grid - Flex layout for proper alignment */}
              <div className="flex flex-row gap-6 justify-center items-start">
                {/* Left Column - Selected Program Card */}
                <div className="w-80 flex-shrink-0">
                  <Card className="bg-white rounded-3xl shadow-xl overflow-hidden border-0 h-full">
                    {/* Gradient Header Section */}
                    <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 p-6 pb-8 relative min-h-[280px]">
                      {/* Selected Badge - Green with checkmark */}
                      {/* <div className="absolute top-4 right-4 bg-green-500 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-md">
                        <Check size={14} className="text-white stroke-[3]" />
                        <Text className="text-white font-semibold text-xs whitespace-nowrap">
                          {t("Выбранная программа")}
                        </Text>
                      </div> */}

                      {/* Duration Badge - Blue pill */}
                      <div className="inline-flex items-center gap-2 bg-blue-400 rounded-full px-3 py-1.5 mb-5 shadow-sm">
                        <Icon data={Clock} size={18} className="text-white" />
                        <Text className="text-white font-semibold text-sm">
                          {selectedProgram.duration} {t("мин.")}
                        </Text>
                      </div>

                      {/* Program Title */}
                      <h2 className="text-3xl font-bold mb-5 text-white leading-tight">
                        {t(`${selectedProgram.name}`)}
                      </h2>

                      {/* Services List */}
                      <div className="space-y-2.5 mt-4">
                        {selectedProgram.functions && selectedProgram.functions.split(", ").map((service, index) => (
                          <div key={index} className="flex items-center gap-2.5">
                            <Check size={18} className="text-green-400 flex-shrink-0 stroke-[3]" />
                            <Text className="text-white font-medium text-sm leading-relaxed">
                              {t(`${service}`)}
                            </Text>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Price Section */}
                    <div className="p-6 bg-white text-center">
                      <div>
                        <span className="text-6xl font-bold text-gray-900 tracking-tight">
                          {Number(selectedProgram.price)}
                        </span>
                        <span className="text-2xl text-gray-500 ml-1 font-semibold">
                          {t("р.")}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Column - Payment Cards Grid */}
                <div className="flex-1 max-w-4xl">
                  <div className="flex justify-center">
                    {PAYS.map((pay) => (
                      <PayCard
                        key={pay.endPoint}
                        label={pay.label}
                        imgUrl={pay.imgUrl}
                        endPoint={pay.endPoint}
                        programName={selectedProgram.name}
                        price={selectedProgram.price}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
