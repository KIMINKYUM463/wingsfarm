/**
 * useSnapStore.ts
 * 스냅 가이드라인 상태 관리
 *
 * ## 책임
 * - 활성화된 가이드라인 상태 관리
 * - 스냅 활성화 여부 관리
 *
 * ## 사용처
 * - useKonvaDrag (가이드라인 설정)
 * - SnapGuidelines (가이드라인 렌더링)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Guide, LineGuideStops } from '../utils/snapUtils';

/** 리사이즈 스냅용 캐시 */
interface ResizeSnapCache {
  lineGuideStops: LineGuideStops;
  layerOffsetX: number;
  layerOffsetY: number;
  scale: number;
}

interface SnapState {
  /** 현재 활성화된 가이드라인 */
  guides: Guide[];
  /** 가이드라인이 표시될 프레임 ID */
  activeFrameId: string | null;
  /** 스냅 기능 활성화 여부 */
  isSnapEnabled: boolean;
  /** 리사이즈 스냅용 캐시 (transform 중에만 유효) */
  resizeSnapCache: ResizeSnapCache | null;

  setGuides: (guides: Guide[], frameId: string) => void;
  clearGuides: () => void;
  setSnapEnabled: (enabled: boolean) => void;
  setResizeSnapCache: (cache: ResizeSnapCache | null) => void;
}

export const useSnapStore = create<SnapState>()(
  devtools(
    (set) => ({
      guides: [],
      activeFrameId: null,
      isSnapEnabled: true,
      resizeSnapCache: null,

      setGuides: (guides, frameId) => set({ guides, activeFrameId: frameId }),
      clearGuides: () => set({ guides: [], activeFrameId: null }),
      setSnapEnabled: (enabled) => set({ isSnapEnabled: enabled }),
      setResizeSnapCache: (cache) => set({ resizeSnapCache: cache }),
    }),
    { name: 'snap-store' },
  ),
);

// 셀렉터
export const useSnapGuides = () => useSnapStore((state) => state.guides);
export const useActiveSnapFrameId = () => useSnapStore((state) => state.activeFrameId);
export const useIsSnapEnabled = () => useSnapStore((state) => state.isSnapEnabled);
