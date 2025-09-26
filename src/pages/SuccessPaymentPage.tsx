import NavigationButton from "../components/buttons/NavigationButton";
import Logo from "../assets/Logo-white.svg";
import WhiteBack from "../assets/exit_to_app_white.svg";
import CheckMark from "../assets/Success_perspective_matte 1.svg";
import Sally from "../assets/Saly-22.svg";
import { useEffect, useState } from "react";
import { secondsToTime } from "../util";
import { useTranslation } from "react-i18next";
import QRCode from "react-qr-code";
import useStore from "../components/state/store";

export default function SuccessPaymentPage() {
  const [isBusy, setIsBusy] = useState<number>(10);
  const [wasBusy, setWasBusy] = useState<boolean>(false);
  const { t } = useTranslation();

  const { bankCheck } = useStore();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBusy > 0) {
      setWasBusy(true);
      interval = setInterval(() => {
        setIsBusy((prevTime) => {
          if (prevTime > 0) {
            prevTime -= 1;
          } else {
            prevTime = 0;
          }
          return prevTime;
        });
      }, 1000);
    }

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <section className=" bg-primary h-screen w-screen">
      <div className=" w-full flex justify-between py-8 px-8">
        <img
          src={Logo}
          alt="Logo"
          className={`min-w-[173px] min-h-[71px] max-w-[173px] max-h-[71px]`}
        />

        <NavigationButton
          label={
            <img
              src={WhiteBack}
              alt="Back"
              className={`min-w-[69px] min-h-[68px] max-w-[69px] max-h-[68px]`}
            />
          }
        />
      </div>
      <div className={` flex flex-col items-center`}>
        <img
          src={CheckMark}
          alt="check mark"
          className=" min-w-[200px] min-h-[200px] max-w-[200px] max-h-[200px]"
        />
        <p className=" text-white-500 text-[6.5rem] font-inter-medium">
          {isBusy === 0 && wasBusy ? t("“Бокс свободен”") : t("“Успешно”")}
        </p>
        {isBusy === 0 && (
          <p className=" font-montserrat-regular text-[2rem] text-white-500">
            {t(" Можете проезжать в бокс!")}
          </p>
        )}

        {isBusy >= 0 && (
          <div>
            <div className="w-48 h-48 bg-white rounded-2xl flex items-center justify-center mb-6 p-4">
              {bankCheck ? (
                <QRCode
                  size={256}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  value={bankCheck}
                  viewBox={`0 0 256 256`}
                />
              ) : (
                <div className="text-center">
                  <div className="text-white/80 text-sm">QR-код</div>
                </div>
              )}
            </div>
            <p className=" font-montserrat-regular text-[1.5rem] text-white-500 mt-14">
              {t("Ваш чек")}
            </p>
          </div>
        )}

        {isBusy ? (
          <div className=" mt-10 text-white-500 text-[4rem]">
            <p className=" font-inter-semibold">
              {t("Бокс освободится через:")}
            </p>
            <p className=" font-inter-semibold">{secondsToTime(isBusy)}</p>
          </div>
        ) : (
          <img
            src={Sally}
            alt="sally"
            className=" min-w-[55rem] min-h-[55rem] max-w-[55rem] max-h-[55rem] object-contain mt-5"
          />
        )}
      </div>
    </section>
  );
}
