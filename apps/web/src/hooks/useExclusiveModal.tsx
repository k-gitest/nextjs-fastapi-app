"use client";

import { useState, useCallback, useEffect, useId } from "react";
import { create } from "zustand";

interface UIState {
  currentModalId: string | null;
  openModal: (id: string) => boolean;
  closeModal: (id: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  currentModalId: null,
  openModal: (id: string) => {
    const current = get().currentModalId;
    if (current !== null) {
      if (process.env.DEV) {
        console.warn(
          `モーダル "${id}" を開こうとしましたが、"${current}" が既に開いています`,
        );
      }
      return false;
    }
    set({ currentModalId: id });
    return true;
  },
  closeModal: (id: string) => {
    const current = get().currentModalId;
    if (current === id) {
      set({ currentModalId: null });
    } else if (process.env.DEV && current !== null) {
      console.warn(
        `モーダル "${id}" が閉じようとしましたが、現在開いているのは "${current}" です`,
      );
    }
  },
}));

export const useExclusiveModal = () => {
  const openModal = useUIStore((state) => state.openModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const [isOpen, setIsOpen] = useState(false);
  const modalId = useId(); //useRef 不要、直接使える

  const open = useCallback(() => {
    const success = openModal(modalId);
    if (success) {
      setIsOpen(true);
    }
    return success;
  }, [openModal, modalId]);

  const close = useCallback(() => {
    setIsOpen(false);
    closeModal(modalId);
  }, [closeModal, modalId]);

  useEffect(() => {
    // modalId はこのスコープ（クロージャ）に固定されているので、
    // アンマウント時に「自分が持っていたID」を正しく closeModal に渡せる
    return () => {
      closeModal(modalId); // クロージャでキャプチャされる
    };
  }, [closeModal, modalId]);

  return { isOpen, open, close };
};
