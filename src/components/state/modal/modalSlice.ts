import { StoreSlice } from "../types";

export interface ModalSlice {
  isLoyaltyCardModalOpen: boolean;
  openLoyaltyCardModal: () => void;
  closeLoyaltyCardModal: () => void;
  toggleLoyaltyCardModal: () => void;
}

export const createModalSlice: StoreSlice<ModalSlice> = (set, get) => ({
  isLoyaltyCardModalOpen: false,

  openLoyaltyCardModal: () => {
    set(state => ({ ...state, isLoyaltyCardModalOpen: true }));
  },

  closeLoyaltyCardModal: () => {
    set(state => ({ ...state, isLoyaltyCardModalOpen: false }));
  },

  toggleLoyaltyCardModal: () => {
    const { isLoyaltyCardModalOpen } = get();
    set(state => ({...state, isLoyaltyCardModalOpen: !isLoyaltyCardModalOpen}));
  },
})