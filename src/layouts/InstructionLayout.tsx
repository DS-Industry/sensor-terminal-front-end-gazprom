import { useTranslation } from "react-i18next";
import gazpromHeader from "../assets/gazprom-step-2-header.webp";
import HeaderWithLogo from "../components/headerWithLogo/HeaderWithLogo";


export default function InstructionLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const { t } = useTranslation();
  
  return (
    <main className="h-[1024px] w-[1280px] bg-white overflow-hidden flex flex-col">
      <div className="w-full flex-shrink-0 h-64">
        <img 
          src={gazpromHeader} 
          alt="Header" 
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-shrink-0">
        <HeaderWithLogo title={t("Инструкция")} isInstructionPage={true} /> 
      </div>
      <div className="flex-1 overflow-hidden min-h-0">{children}</div>
    </main>
  );
}
