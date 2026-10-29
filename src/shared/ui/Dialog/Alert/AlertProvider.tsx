'use client';

import { useCallback } from 'react';
import { useDialog } from '../useDialog';
import { DialogBase } from '../shared';
import AlertContent from './AlertContent';

/**
 * AlertProvider - 글로벌 Alert 다이얼로그 렌더러
 * - 루트 레이아웃에 배치
 * - Promise 기반 API 지원
 * - HTML5 <dialog> + form method="dialog" 패턴 사용
 */
const AlertProvider = () => {
  const { alertIsOpen, alertOptions, resolveAlert } = useDialog();

  // form method="dialog"의 returnValue로 결과 처리
  const handleCloseWithValue = useCallback(() => {
    resolveAlert();
  }, [resolveAlert]);

  // isOpen으로 먼저 체크하여 닫힘 상태에서 빠르게 반환
  if (!alertIsOpen || !alertOptions) return null;

  return (
    <DialogBase
      isOpen={alertIsOpen}
      onClose={resolveAlert}
      onCloseWithValue={handleCloseWithValue}
      ariaLabelledBy="alert-dialog-title"
      ariaDescribedBy={alertOptions.description ? 'alert-dialog-description' : undefined}
      role="alertdialog"
    >
      <AlertContent options={alertOptions} onClose={resolveAlert} />
    </DialogBase>
  );
};

export default AlertProvider;
