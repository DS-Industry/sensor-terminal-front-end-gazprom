import InstructionLayout from "../layouts/InstructionLayout";
import Arrow from "./../assets/up-window.svg";
import Car from "./../assets/car.webp";
import Stop from "./../assets/red-close.svg";
import Cycle from "./../assets/cycle.svg";
import AttentionTag from "../components/tags/AttentionTag";
import Fire from "./../assets/Fire_perspective_matte.svg";
import CheckMark from "./../assets/Success_perspective_matte 1.svg";
import CarInstruction from "./../assets/car-instruction.svg";
import { Trans, useTranslation } from "react-i18next";

export default function InstructionPage() {
  const { t } = useTranslation();
  
  return (
    <InstructionLayout>
      <div className="bg-white h-full w-full overflow-hidden">
        <div className="flex flex-row gap-12 px-16 py-12 h-full">
          <div className="flex-1 overflow-scroll">
            <ul className="flex flex-col gap-10">
              <li className="flex flex-row items-center gap-5">
                <div className="flex items-center justify-center w-[38px] h-[38px] rounded-full bg-[#0B68E1] text-white text-xl font-inter-bold flex-shrink-0">
                  1
                </div>
                <img
                  src={CheckMark}
                  alt="checkmark"
                  className="w-14 h-14 flex-shrink-0"
                />
                <p className="text-xl text-left pt-2 text-black" style={{ fontSize: '20px' }}>
                  {t("instruction_new_step1")}
                </p>
              </li>

              <li className="flex flex-row items-center gap-5">
                <div className="flex items-center justify-center w-[38px] h-[38px] rounded-full bg-[#0B68E1] text-white text-xl font-inter-bold flex-shrink-0">
                  2
                </div>
                <img
                  src={Arrow}
                  alt="arrow"
                  className="w-14 h-14 flex-shrink-0"
                />
                <p className="text-xl text-left pt-2" style={{ fontSize: '20px', color: '#000000' }}>
                  <Trans 
                    i18nKey="instruction_new_step2"
                    components={{
                      highlight: <span className="font-bold" style={{ color: '#00B600', fontSize: '24px', display: 'inline' }} />
                    }}
                  />
                </p>
              </li>

              <li className="flex flex-row items-center gap-5">
                <div className="flex items-center justify-center w-[38px] h-[38px] rounded-full bg-[#0B68E1] text-white text-xl font-inter-bold flex-shrink-0">
                  3
                </div>
                <img
                  src={Car}
                  alt="car"
                  className="w-14 h-14 flex-shrink-0"
                />
                <p className="text-xl text-left pt-2" style={{ fontSize: '20px', color: '#000000' }}>
                  <Trans 
                    i18nKey="instruction_new_step3"
                    components={{
                      highlight: <span className="font-bold" style={{ color: '#0967E1', fontSize: '24px', display: 'inline' }} />
                    }}
                  />
                </p>
              </li>

              <li className="flex flex-row items-center gap-5">
                <div className="flex items-center justify-center w-[38px] h-[38px] rounded-full bg-[#0B68E1] text-white text-xl font-inter-bold flex-shrink-0">
                  4
                </div>
                <img
                  src={Stop}
                  alt="stop"
                  className="w-14 h-14 flex-shrink-0"
                />
                <p className="text-xl text-left pt-2 text-black" style={{ fontSize: '20px' }}>
                  {t("instruction_new_step4")}
                </p>
              </li>

              <li className="flex flex-row items-center gap-5">
                <div className="flex items-center justify-center w-[38px] h-[38px] rounded-full bg-[#0B68E1] text-white text-xl font-inter-bold flex-shrink-0">
                  5
                </div>
                <img
                  src={Cycle}
                  alt="cycle"
                  className="w-14 h-14 flex-shrink-0"
                />
                <p className="text-xl text-left pt-2 text-black" style={{ fontSize: '20px' }}>
                  {t("instruction_new_step5")}
                </p>
              </li>

              <li className="flex flex-row items-center gap-5">
                <div className="flex items-center justify-center w-[38px] h-[38px] rounded-full bg-[#0B68E1] text-white text-xl font-inter-bold flex-shrink-0">
                  6
                </div>
                <img
                  src={Arrow}
                  alt="arrow"
                  className="w-14 h-14 flex-shrink-0"
                />
                <p className="text-xl text-left pt-2 text-black" style={{ fontSize: '20px' }}>
                  {t("instruction_new_step6")}
                </p>
              </li>
            </ul>
          </div>

          <div className="w-80 flex-shrink-0 flex flex-col items-center">
            <img
              src={CarInstruction}
              alt="car diagram"
              className="w-full h-auto mb-6"
              style={{
                filter: "grayscale(100%)"
              }}
            />
            <div className="flex flex-col gap-3 w-full">
              <div>
                <p className="text-start font-bold mb-2 text-[22px]">
                  {t("Ширина")}: {t("до")} 2,6 м
                </p>
              </div>
              <div>
                <p className="text-start font-bold mb-2 text-[22px]">
                  {t("Длина")}: {t("до")} 6,25 м
                </p>
              </div>
              <div>
                <p className="text-start font-bold mb-2 text-[22px]">
                  {t("Высота")}: {t("до")} 2 м
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Warning Boxes - Fixed Bottom Right */}
        <div className="fixed right-0 bottom-0 z-40 flex flex-col gap-4 items-end">
          <AttentionTag
            label={t("Не рекомендуется мыть автомобили с панорамной крышей!")}
            additionalStyles="text-red-400 w-[367px]"
            icon={Fire}
          />
          <AttentionTag
            label={t("Не перемещайте автомобиль во время мойки!")}
            additionalStyles="text-red-400 w-[332px]"
            icon={Fire}
          />
          <AttentionTag
            label={t("Для того, чтобы начать следующий цикл мойки, нужно обязательно выехать из поста!")}
            additionalStyles="text-red-400 w-[411px]"
            icon={Fire}
          />
        </div>
      </div>
    </InstructionLayout>
  );
}
