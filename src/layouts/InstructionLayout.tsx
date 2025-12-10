import { useTranslation } from "react-i18next";
import gazpromHeader from "../assets/gazprom-step-2-header.png";
import HeaderWithLogo from "../components/headerWithLogo/HeaderWithLogo";


export default function InstructionLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const { t } = useTranslation();
  
  return (
    <main className="h-[1024px] w-[1280px] bg-white overflow-hidden">
      <div className="w-full flex-shrink-0 h-64">
        <img 
          src={gazpromHeader} 
          alt="Header" 
          className="w-full h-full object-cover"
        />
      </div>
      <HeaderWithLogo title={t("Инструкция")} isInstructionPage={true} /> 
      <div className="overflow-hidden" style={{ height: 'calc(1024px - 256px)' }}>{children}</div>
    </main>
  );
}
