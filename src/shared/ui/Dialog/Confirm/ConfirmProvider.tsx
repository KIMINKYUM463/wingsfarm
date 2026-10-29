'use client';

import { useCallback } from 'react';
import { useDialog } from '../useDialog';
import { DialogBase } from '../shared';
import ConfirmContent from './ConfirmContent';

/**
 * ConfirmProvider - 글로벌 Confirm 다이얼로그 렌더러
 * - 루트 레이아웃에 배치
 * - Promise 기반 API 지원
 * - HTML5 <dialog> + form method="dialog" 패턴 사용
 */
const ConfirmProvider = () => {
  const { confirmIsOpen, confirmOptions, resolveConfirm } = useDialog();

  // form method="dialog"의 returnValue로 결과 처리
  const handleCloseWithValue = useCallback(
    (value: string) => {
      resolveConfirm(value === 'confirm');
    },
    [resolveConfirm],
  );

  // isOpen으로 먼저 체크하여 닫힘 상태에서 빠르게 반환
  if (!confirmIsOpen || !confirmOptions) return null;

  return (
    <DialogBase
      isOpen={confirmIsOpen}
      onClose={() => resolveConfirm(false)}
      onCloseWithValue={handleCloseWithValue}
      ariaLabelledBy="confirm-dialog-title"
      ariaDescribedBy={confirmOptions.description ? 'confirm-dialog-description' : undefined}
      role="alertdialog"
    >
      <ConfirmContent
        options={confirmOptions}
        onClose={() => resolveConfirm(confirmOptions.closeButtonValue ?? false)}
      />
    </DialogBase>
  );
};

export default ConfirmProvider;
