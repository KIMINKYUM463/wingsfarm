'use client';

// ===== 통합 훅 =====
export { useDialog } from './useDialog';

export { confirmAiImages } from './confirmAiImages';

// ===== 통합 Provider =====
export { default as DialogProvider } from './DialogProvider';

// ===== Modal =====
export {
  ModalProvider,
  ModalContent,
  registerModal,
  getModal,
  hasModal,
  MODAL_TYPES,
} from './Modal';

export type { ModalType, ModalData, ModalConfig, ModalComponentProps } from './Modal';

// ===== Confirm =====
export { ConfirmProvider, ConfirmContent } from './Confirm';

export type { ConfirmOptions } from './Confirm';

// ===== Alert =====
export { AlertProvider, AlertContent } from './Alert';

export type { AlertOptions } from './Alert';

// ===== Prompt =====
export { PromptProvider, PromptContent } from './Prompt';

export type { PromptOptions } from './Prompt';

// ===== Choice =====
export { ChoiceProvider, ChoiceContent } from './Choice';

export type { ChoiceOptions, ChoiceItem, ChoiceVariant } from './Choice';

// ===== Shared =====
export { DialogBase, CloseButton } from './shared';
