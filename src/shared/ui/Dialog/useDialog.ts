import { create } from 'zustand';
import type { ModalType, ModalData } from './Modal/types';
import type { ConfirmOptions } from './Confirm/types';
import type { AlertOptions } from './Alert/types';
import type { PromptOptions } from './Prompt/types';
import type { ChoiceOptions } from './Choice/types';

interface DialogState {
  // Modal 상태
  modalIsOpen: boolean;
  modalType: ModalType | null;
  modalData: ModalData;
  /** 모달 닫기 방지 (로딩 중 등) */
  preventClose: boolean;

  // Confirm 상태
  confirmIsOpen: boolean;
  confirmOptions: ConfirmOptions | null;
  confirmResolve: ((value: boolean) => void) | null;

  // Alert 상태
  alertIsOpen: boolean;
  alertOptions: AlertOptions | null;
  alertResolve: (() => void) | null;

  // Prompt 상태
  promptIsOpen: boolean;
  promptOptions: PromptOptions | null;
  promptResolve: ((value: string | null) => void) | null;

  // Choice 상태
  choiceIsOpen: boolean;
  choiceOptions: ChoiceOptions | null;
  choiceResolve: ((value: string | null) => void) | null;

  // Modal Actions
  openModal: (type: ModalType, data?: ModalData) => void;
  closeModal: () => void;
  setPreventClose: (prevent: boolean) => void;

  // Confirm Actions
  openConfirm: (options: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (value: boolean) => void;

  // Alert Actions
  openAlert: (options: AlertOptions) => Promise<void>;
  resolveAlert: () => void;

  // Prompt Actions
  openPrompt: (options: PromptOptions) => Promise<string | null>;
  resolvePrompt: (value: string | null) => void;

  // Choice Actions
  openChoice: (options: ChoiceOptions) => Promise<string | null>;
  resolveChoice: (value: string | null) => void;
}

export const useDialog = create<DialogState>((set, get) => ({
  // Modal 초기 상태
  modalIsOpen: false,
  modalType: null,
  modalData: null,
  preventClose: false,

  // Confirm 초기 상태
  confirmIsOpen: false,
  confirmOptions: null,
  confirmResolve: null,

  // Alert 초기 상태
  alertIsOpen: false,
  alertOptions: null,
  alertResolve: null,

  // Prompt 초기 상태
  promptIsOpen: false,
  promptOptions: null,
  promptResolve: null,

  // Choice 초기 상태
  choiceIsOpen: false,
  choiceOptions: null,
  choiceResolve: null,

  // Modal Actions
  openModal: (type, data) =>
    set({
      modalIsOpen: true,
      modalType: type,
      modalData: data ?? null,
    }),

  closeModal: () => {
    // 닫기 방지 상태면 무시
    if (get().preventClose) return;
    set({
      modalIsOpen: false,
      modalType: null,
      modalData: null,
      preventClose: false,
    });
  },

  setPreventClose: (prevent) => set({ preventClose: prevent }),

  // Confirm Actions
  openConfirm: (options) =>
    new Promise((resolve) => {
      set({
        confirmIsOpen: true,
        confirmOptions: options,
        confirmResolve: resolve,
      });
    }),

  resolveConfirm: (value) => {
    const { confirmResolve } = get();
    confirmResolve?.(value);
    // 먼저 닫기 → dialog 닫힘 애니메이션 후 options 초기화
    set({ confirmIsOpen: false });
    // 다음 렌더 사이클에서 options 초기화 (dialog 닫힘 후)
    setTimeout(() => {
      set({ confirmOptions: null, confirmResolve: null });
    }, 0);
  },

  // Alert Actions
  openAlert: (options) =>
    new Promise((resolve) => {
      set({
        alertIsOpen: true,
        alertOptions: options,
        alertResolve: resolve,
      });
    }),

  resolveAlert: () => {
    const { alertResolve } = get();
    alertResolve?.();
    // 먼저 닫기 → dialog 닫힘 애니메이션 후 options 초기화
    set({ alertIsOpen: false });
    // 다음 렌더 사이클에서 options 초기화 (dialog 닫힘 후)
    setTimeout(() => {
      set({ alertOptions: null, alertResolve: null });
    }, 0);
  },

  // Prompt Actions
  openPrompt: (options) =>
    new Promise((resolve) => {
      set({
        promptIsOpen: true,
        promptOptions: options,
        promptResolve: resolve,
      });
    }),

  resolvePrompt: (value) => {
    const { promptResolve } = get();
    promptResolve?.(value);
    set({ promptIsOpen: false });
    setTimeout(() => {
      set({ promptOptions: null, promptResolve: null });
    }, 0);
  },

  // Choice Actions
  openChoice: (options) =>
    new Promise((resolve) => {
      set({
        choiceIsOpen: true,
        choiceOptions: options,
        choiceResolve: resolve,
      });
    }),

  resolveChoice: (value) => {
    const { choiceResolve } = get();
    choiceResolve?.(value);
    set({ choiceIsOpen: false });
    setTimeout(() => {
      set({ choiceOptions: null, choiceResolve: null });
    }, 0);
  },
}));
