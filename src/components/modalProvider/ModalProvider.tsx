import { LoaderModal } from "../modals/LoaderModal";
import { LoyaltyCardModal } from "../modals/LoyaltyCardModal";

export function ModalProvider() {
  
  return (
    <>
      <LoyaltyCardModal />
      <LoaderModal />
    </>
  );
}