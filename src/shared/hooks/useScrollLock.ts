import { useEffect } from 'react';

/**
 * 스크롤 잠금 훅 (모달이 열릴 때 배경 스크롤 방지)
 *
 * @param enabled 스크롤 잠금 활성화 여부 (기본값: true)
 *
 * @example
 * useScrollLock(isModalOpen);
 */
export function useScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    // 현재 스크롤 위치 저장
    const originalOverflow = document.body.style.overflow;

    // 스크롤 잠금
    document.body.style.overflow = 'hidden';

    return () => {
      // 원래 상태로 복구
      document.body.style.overflow = originalOverflow || 'unset';
    };
  }, [enabled]);
}
