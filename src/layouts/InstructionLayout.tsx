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
    <main className=" w-screen min-h-screen bg-white">
      <div className="w-full flex-shrink-0" style={{ height: '260px', minHeight: '260px' }}>
        <img 
          src={gazpromHeader} 
          alt="Header" 
        />
      </div>
      <HeaderWithLogo title={t("Инструкция")} isInstructionPage={true} /> 
      <div>{children}</div>
    </main>
  );
}
