import { useTranslation } from "react-i18next";
import { Card, Icon, Text } from "@gravity-ui/uikit";
import { ArrowRight } from "@gravity-ui/icons";
import { Clock, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useStore from "../state/store";
import { IProgram } from "../../api/types/program";
import { logger } from "../../util/logger";

export default function ProgramCard(program: IProgram) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { setOrderProgramId, setSelectedProgram } = useStore.getState();

  return (
    <Card type="action" className="w-80 bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col border-0"
      onClick={() => {
        logger.debug(`ProgramCard: Selected program ${program.id}`);
        setOrderProgramId(program.id);
        setSelectedProgram(program);
        navigate(`/programs/${program.id}`)
      }}
    >
      <div className="flex-shrink-0 h-96 p-4 relative flex flex-col bg-gradient-to-br from-blue-500 to-blue-600">
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-6 self-start bg-white/20 backdrop-blur-sm border border-white/10">
          <Clock className="w-4 h-4 text-white" />
          <span className="text-sm font-medium text-white">{program.duration} мин.</span>
        </div>

        <h2 className="text-3xl font-bold mb-5 text-balance leading-tight text-white whitespace-nowrap">{t(`${program.name}`)}</h2>

        <div className="flex-1">
          <ul className="space-y-2">
            {program.functions && program.functions.split(", ").map((service, index) => (
              <li key={index} className="flex items-center gap-3">
                <Check className="w-4 h-4 text-white flex-shrink-0" strokeWidth={3} />
                <span className="text-sm font-medium text-white">{t(`${service}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="absolute top-6 right-6 flex gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
        </div>
      </div>

      <div className="flex-shrink-0 p-6 bg-white">
        <div className="mb-6 text-center">
          <span className="text-6xl font-bold text-gray-900 tracking-tight">{Number(program.price)}</span>
          <span className="text-2xl text-gray-500 ml-1">{t("р.")}</span>
        </div>

        <div className="flex items-center justify-between p-3 cursor-pointer animate-pulse">
          <Text className="text-black-800">{t("Выбрать программу")}</Text>
          <Icon data={ArrowRight} size={18} className="text-gray-600" />
        </div>
      </div>
    </Card>
  )
}