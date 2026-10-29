'use client';

import { useCallback, useRef } from 'react';
import { useDialog } from '../useDialog';
import { DialogBase } from '../shared';
import PromptContent from './PromptContent';

/**
 * PromptProvider - 글로벌 Prompt 다이얼로그 렌더러
 * - 루트 레이아웃에 배치
 * - Promise 기반 API 지원 (입력값 또는 null 반환)
 * - HTML5 <dialog> + form method="dialog" 패턴 사용
 */
const PromptProvider = () => {
  const { promptIsOpen, promptOptions, resolvePrompt } = useDialog();
  // form submit 시 캡처된 input 값 저장
  const capturedValueRef = useRef<string>('');

  // input 값 캡처 (form submit 직전)
  const handleInputCapture = useCallback((value: string) => {
    capturedValueRef.current = value;
  }, []);

  // form method="dialog"의 returnValue로 결과 처리
  const handleCloseWithValue = useCallback(
    (value: string) => {
      const result = value === 'confirm' ? capturedValueRef.current : null;
      resolvePrompt(result);
      capturedValueRef.current = '';
    },
    [resolvePrompt],
  );

  // isOpen으로 먼저 체크하여 닫힘 상태에서 빠르게 반환
  if (!promptIsOpen || !promptOptions) return null;

  return (
    <DialogBase
      isOpen={promptIsOpen}
      onClose={() => resolvePrompt(null)}
      closeOnBackdrop={false}
      onCloseWithValue={handleCloseWithValue}
      ariaLabelledBy="prompt-dialog-title"
      ariaDescribedBy={promptOptions.description ? 'prompt-dialog-description' : undefined}
      role="alertdialog"
    >
      <PromptContent options={promptOptions} onInputCapture={handleInputCapture} />
    </DialogBase>
  );
};

export default PromptProvider;
