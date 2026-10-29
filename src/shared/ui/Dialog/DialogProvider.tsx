'use client';

import { ModalProvider } from './Modal';
import { ConfirmProvider } from './Confirm';
import { AlertProvider } from './Alert';
import { PromptProvider } from './Prompt';
import { ChoiceProvider } from './Choice';

/**
 * DialogProvider - 통합 다이얼로그 Provider
 * - 루트 레이아웃에 단일 컴포넌트로 배치
 */
const DialogProvider = () => {
  return (
    <>
      <ModalProvider />
      <ConfirmProvider />
      <AlertProvider />
      <PromptProvider />
      <ChoiceProvider />
    </>
  );
};

export default DialogProvider;
