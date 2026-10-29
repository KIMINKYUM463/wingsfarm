/**
 * useImageDropTargetStore.ts
 * 외부 이미지 드래그 시 드롭 대상 이미지 요소 상태 관리
 *
 * ## 책임
 * - 패널에서 캔버스로 이미지 드래그 시 드롭 대상 이미지 요소 추적
 * - 이미지 교체 호버 효과를 위한 상태 관리
 *
 * ## 성능 최적화
 * - selector로 개별 요소만 구독 (useIsDropTarget)
 * - throttle은 호출부(CanvasFrame)에서 적용
 */

import { create } from 'zustand';

interface ImageDropTargetState {
  /** 드롭 대상 이미지 요소 ID (hover 중인 이미지) */
  dropTargetId: string | null;
  /** 드롭 대상 요소가 속한 프레임 ID */
  dropTargetFrameId: string | null;
  setDropTarget: (elementId: string | null, frameId: string | null) => void;
  clearDropTarget: () => void;
}

export const useImageDropTargetStore = create<ImageDropTargetState>()((set, get) => ({
  dropTargetId: null,
  dropTargetFrameId: null,

  setDropTarget: (elementId, frameId) => {
    const { dropTargetId } = get();
    // 동일하면 업데이트 스킵 (불필요한 리렌더링 방지)
    if (dropTargetId === elementId) return;
    set({ dropTargetId: elementId, dropTargetFrameId: frameId });
  },

  clearDropTarget: () => {
    const { dropTargetId } = get();
    if (dropTargetId === null) return;
    set({ dropTargetId: null, dropTargetFrameId: null });
  },
}));

/** 특정 요소가 드롭 대상인지 확인 (개별 요소 구독용) */
export const useIsDropTarget = (elementId: string) =>
  useImageDropTargetStore((state) => state.dropTargetId === elementId);

/** 드롭 대상 요소 ID (전체 구독용 - 필요시에만 사용) */
export const useDropTargetId = () => useImageDropTargetStore((state) => state.dropTargetId);
