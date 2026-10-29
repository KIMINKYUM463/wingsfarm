'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { clsx } from 'clsx';
import { useScrollLock } from '@/shared/hooks/useScrollLock';

interface DialogBaseProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** 배경 클릭 시 닫기 (기본: false - 대부분의 다이얼로그는 실수로 닫히면 안 됨) */
  closeOnBackdrop?: boolean;
  /** ::backdrop 비활성화 (자체 배경 사용 시) */
  noBackdrop?: boolean;
  /** form method="dialog" 사용 시 returnValue로 닫기 처리 */
  onCloseWithValue?: (value: string) => void;
  /** 접근성: 다이얼로그 제목 요소 ID */
  ariaLabelledBy?: string;
  /** 접근성: 다이얼로그 설명 요소 ID */
  ariaDescribedBy?: string;
  /** 접근성: 사용자 응답 필요 시 alertdialog 사용 */
  role?: 'dialog' | 'alertdialog';
}

/**
 * DialogBase - HTML5 <dialog> 래퍼
 * - showModal()로 모달 열기 (접근성 자동 지원)
 * - ESC 키 기본 지원 (네이티브)
 * - 포커스 트랩 자동 지원
 */
const DialogBase = ({
  isOpen,
  onClose,
  children,
  className,
  closeOnBackdrop = false,
  noBackdrop = false,
  onCloseWithValue,
  ariaLabelledBy,
  ariaDescribedBy,
  role,
}: DialogBaseProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // 스크롤 잠금
  useScrollLock(isOpen);

  // 열기/닫기 제어
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // 이미 원하는 상태면 종료
    if (isOpen === dialog.open) return;

    // 열기
    if (isOpen) {
      // 이전 returnValue 초기화 (중복 호출 방지)
      dialog.returnValue = '';
      dialog.showModal();
      return;
    }

    // 닫기
    dialog.close();
  }, [isOpen]);

  // ESC 키로 닫기 - keydown으로 직접 처리
  // (파일 선택 창 닫힐 때 cancel 이벤트가 발생하는 브라우저 버그 방지)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // 네이티브 cancel 이벤트 완전 차단 (파일 선택 창에서 발생하는 것 포함)
    const blockCancel = (e: Event) => {
      e.preventDefault();
    };

    // ESC 키를 keydown으로 직접 감지
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      e.preventDefault();
      dialog.returnValue = '';

      if (onCloseWithValue) {
        onCloseWithValue('cancel');
        return;
      }
      onClose();
    };

    dialog.addEventListener('cancel', blockCancel);
    dialog.addEventListener('keydown', handleKeyDown);
    return () => {
      dialog.removeEventListener('cancel', blockCancel);
      dialog.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, onCloseWithValue]);

  // form method="dialog" 닫기 이벤트 처리 (returnValue 활용)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !onCloseWithValue) return;

    const handleClose = () => {
      // form method="dialog"로 닫힌 경우에만 처리
      // ESC(cancel)로 닫힌 경우는 위에서 처리되므로 returnValue가 있을 때만
      if (dialog.returnValue) {
        onCloseWithValue(dialog.returnValue);
      }
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onCloseWithValue]);

  // 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (!closeOnBackdrop) return;

    // dialog 요소 자체를 클릭한 경우에만 (자식 요소가 아닌)
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={clsx('dialog-base', noBackdrop && 'no-backdrop', className)}
      onClick={handleBackdropClick}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      role={role}
    >
      {children}
    </dialog>
  );
};

export default DialogBase;
