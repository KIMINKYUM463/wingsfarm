/**
 * useHoverStore.ts
 * 캔버스 요소 호버 상태 관리
 *
 * ## 책임
 * - 호버된 요소의 바운딩 박스 정보 관리
 * - 클리핑 Group 내부에서 HoverOutline 렌더링에 사용
 *
 * ## 왜 별도 store인가?
 * - 기존 useKonvaHover는 요소에 직접 stroke를 적용 → 클리핑 안 됨
 * - 새 방식: store에 위치 정보 저장 → HoverOutline이 클리핑 Group 내부에서 렌더링
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface HoveredElement {
  id: string;
  frameId: string; // 요소가 속한 프레임 ID
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** 회전 기준점 (offset) */
  offsetX: number;
  offsetY: number;
}

interface HoverState {
  hoveredElement: HoveredElement | null;
  setHoveredElement: (element: HoveredElement | null) => void;
  clearHover: () => void;
}

export const useHoverStore = create<HoverState>()(
  devtools(
    (set) => ({
      hoveredElement: null,

      setHoveredElement: (element) => {
        set({ hoveredElement: element });
      },

      clearHover: () => {
        set({ hoveredElement: null });
      },
    }),
    { name: 'hover-store' },
  ),
);

// 셀렉터
export const useHoveredElement = () => useHoverStore((state) => state.hoveredElement);
export const useHoveredId = () => useHoverStore((state) => state.hoveredElement?.id ?? null);
export const useSetHoveredElement = () => useHoverStore((state) => state.setHoveredElement);
export const useClearHover = () => useHoverStore((state) => state.clearHover);

/**
 * 특정 요소가 호버되었는지 확인하는 훅
 * - 각 요소 컴포넌트에서 hover stroke 렌더링에 사용
 */
export const useIsElementHovered = (elementId: string) =>
  useHoverStore((state) => state.hoveredElement?.id === elementId);
