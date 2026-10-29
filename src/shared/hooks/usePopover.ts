import { useState, useCallback } from 'react';

/**
 * Popover 로컬 상태 관리 훅
 * Popover 컴포넌트 내부에서만 사용
 *
 * @returns isOpen, open, close, toggle 함수들
 */
export function usePopover() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}
