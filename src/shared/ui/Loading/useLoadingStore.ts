import { create } from 'zustand';

interface LoadingState {
  /** 로딩 중인지 여부 */
  isLoading: boolean;
  /** 로딩 메시지 */
  message: string;
  /** 로딩 시작 */
  show: (message?: string) => void;
  /** 로딩 종료 */
  hide: () => void;
}

/**
 * 전역 로딩 상태 관리 스토어
 * LoadingProvider와 함께 사용
 *
 * ## 사용 예시
 * ```tsx
 * const { show, hide } = useLoadingStore();
 *
 * show('생성 중...');
 * await mutate();
 * hide();
 * ```
 */
export const useLoadingStore = create<LoadingState>((set) => ({
  isLoading: false,
  message: '처리 중...',
  show: (message = '처리 중...') => set({ isLoading: true, message }),
  hide: () => set({ isLoading: false }),
}));
