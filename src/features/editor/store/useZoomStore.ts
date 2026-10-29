/**
 * useZoomStore.ts
 * 캔버스 줌 상태 관리
 *
 * ## 책임
 * - 수동 줌 레벨 (퍼센트, 30-100%)
 * - 자동 맞춤 줌 vs 수동 줌 모드 전환
 *
 * ## 설계
 * - autoFitZoom은 저장하지 않음 (useFrameLayout에서 계산)
 * - 수동 모드에서만 manualZoomPercentage 사용
 * - 자동 모드에서는 useFrameLayout의 계산값 사용
 *
 * ## 사용처
 * - useFrameLayout (스케일 계산)
 * - ZoomControl (줌 조절 UI)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/** 줌 제한값 */
export const ZOOM_LIMITS = {
  MIN: 30, // 최소 30%
  MAX: 100, // 최대 100% (원본 크기)
  STEP: 5, // 조절 단위 5%
} as const;

interface ZoomState {
  /** 수동 설정된 줌 퍼센트 (30-100) */
  manualZoomPercentage: number;
  /** 수동 줌 모드 여부 */
  isManualZoom: boolean;

  // Actions
  /** 수동 줌 설정 */
  setManualZoom: (percentage: number) => void;
  /** 자동 맞춤 모드로 리셋 */
  resetToAutoFit: () => void;
}

export const useZoomStore = create<ZoomState>()(
  devtools(
    (set) => ({
      manualZoomPercentage: 100,
      isManualZoom: false,

      setManualZoom: (percentage: number) => {
        const clampedValue = Math.max(
          ZOOM_LIMITS.MIN,
          Math.min(ZOOM_LIMITS.MAX, percentage),
        );
        set({
          manualZoomPercentage: clampedValue,
          isManualZoom: true,
        });
      },

      resetToAutoFit: () => {
        set({ isManualZoom: false });
      },
    }),
    { name: 'zoom-store' },
  ),
);

// 셀렉터 함수들
export const useManualZoomPercentage = () => useZoomStore((state) => state.manualZoomPercentage);
export const useIsManualZoom = () => useZoomStore((state) => state.isManualZoom);
export const useSetManualZoom = () => useZoomStore((state) => state.setManualZoom);
export const useResetToAutoFit = () => useZoomStore((state) => state.resetToAutoFit);
