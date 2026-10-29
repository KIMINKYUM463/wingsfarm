import { useEffect, RefObject } from 'react';

interface UseClickOutsideOptions {
  /** 외부 클릭 시 실행할 콜백 */
  onClickOutside: () => void;
  /** ESC 키 누를 때 실행할 콜백 */
  onEscape?: () => void;
  /** 활성화 여부 */
  enabled?: boolean;
}

/**
 * 외부 클릭 및 ESC 키 감지 훅
 *
 * @example
 * const modalRef = useRef<HTMLDivElement>(null);
 * useClickOutside(modalRef, {
 *   onClickOutside: closeModal,
 *   onEscape: closeModal,
 *   enabled: isOpen
 * });
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  options: UseClickOutsideOptions
) {
  const { onClickOutside, onEscape, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        onEscape();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    if (onEscape) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (onEscape) {
        document.removeEventListener('keydown', handleEscape);
      }
    };
  }, [ref, onClickOutside, onEscape, enabled]);
}
