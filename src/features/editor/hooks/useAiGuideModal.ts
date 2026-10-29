import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useDialog } from '@/shared/ui/Dialog/useDialog';
import { MODAL_TYPES } from '@/shared/ui/Dialog/Modal/types';

/** AI 가이드 "다시 보지 않음" localStorage 키 */
export const AI_GUIDE_STORAGE_KEY = 'hideAiGuide';

/** AI 가이드 모달을 표시해야 하는지 확인 */
export const shouldShowAiGuide = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AI_GUIDE_STORAGE_KEY) !== 'true';
};

/**
 * AI 가이드 모달 자동 표시 훅
 *
 * ## 책임
 * - 초안 만들기로 진입 시 AI 가이드 모달 자동 표시
 * - localStorage로 중복 표시 방지 (사용자가 "다시 보지 않음" 체크 시)
 * - 쿼리 파라미터 정리 (?draft=true 제거)
 *
 * ## 표시 조건 (모두 충족 시)
 * 1. shouldShow=true (에디터 초기화 완료)
 * 2. isDraftCreation=true (초안 만들기로 진입)
 * 3. isFirstView=true (서버 최초 조회)
 * 4. localStorage에 'hideAiGuide'가 없을 때
 *
 * ## 사용 예시
 * ```tsx
 * useAiGuideModal(isInitialized && isDraftCreation && isFirstView);
 * ```
 *
 * @param shouldShow - 모달 표시 조건 (모든 조건 AND 연산)
 */
export const useAiGuideModal = (shouldShow: boolean) => {
  const pathname = usePathname();
  const openModal = useDialog((state) => state.openModal);

  useEffect(() => {
    if (!shouldShow) return;
    if (!shouldShowAiGuide()) return;

    // 쿼리 파라미터 정리 (?draft=true 제거)
    window.history.replaceState(null, '', pathname);

    // 에디터 렌더링 완료 후 모달 표시 (backdrop 애니메이션 동기화)
    requestAnimationFrame(() => {
      openModal(MODAL_TYPES.AI_GUIDE);
    });
  }, [shouldShow, openModal, pathname]);
};
