import { useEffect } from 'react';

/**
 * ESC 키 감지 훅
 *
 * @param onEscape ESC 키 누를 때 실행할 콜백
 * @param enabled 활성화 여부 (기본값: true)
 *
 * @example
 * useEscapeKey(() => closeModal(), isModalOpen);
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onEscape, enabled]);
}
