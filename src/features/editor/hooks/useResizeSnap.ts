/**
 * useResizeSnap.ts
 * 리사이즈 시 스냅 기능을 위한 anchorDragBoundFunc 제공
 *
 * ## 동작
 * - Transformer의 anchorDragBoundFunc에 전달하여 앵커 드래그 시 스냅 적용
 * - 프레임 경계 및 다른 요소들의 가장자리에 자석처럼 달라붙음
 * - useKonvaTransform의 handleTransform에서 캐시된 스냅 대상 사용
 */

import { useCallback } from 'react';
import { Vector2d } from 'konva/lib/types';
import { useSnapStore } from '@/features/editor/store/useSnapStore';
import { SNAP_OFFSET } from '@/features/editor/constants/snap';

export const useResizeSnap = () => {
  const isSnapEnabled = useSnapStore((state) => state.isSnapEnabled);

  /**
   * anchorDragBoundFunc - 앵커 드래그 시 스냅 적용
   * Stage 좌표를 프레임 좌표로 변환하여 스냅 체크
   */
  const anchorDragBoundFunc = useCallback(
    (oldPos: Vector2d, newPos: Vector2d): Vector2d => {
      // 스냅 비활성화 또는 캐시 없음
      const cache = useSnapStore.getState().resizeSnapCache;
      if (!isSnapEnabled || !cache) return newPos;

      const { lineGuideStops, layerOffsetX, layerOffsetY, scale } = cache;

      // Stage 좌표 → 프레임 로컬 좌표 변환
      // Layer offset은 음수로 설정됨 (offsetX = -layerOffsetX / scale)
      const frameX = newPos.x / scale + layerOffsetX;
      const frameY = newPos.y / scale + layerOffsetY;

      let snappedX = newPos.x;
      let snappedY = newPos.y;

      // 수직 스냅 (X 방향) - 가장 가까운 것 찾기
      let minDiffV = SNAP_OFFSET;
      for (const targetX of lineGuideStops.vertical) {
        const diff = Math.abs(frameX - targetX);
        if (diff < minDiffV) {
          minDiffV = diff;
          snappedX = (targetX - layerOffsetX) * scale;
        }
      }

      // 수평 스냅 (Y 방향) - 가장 가까운 것 찾기
      let minDiffH = SNAP_OFFSET;
      for (const targetY of lineGuideStops.horizontal) {
        const diff = Math.abs(frameY - targetY);
        if (diff < minDiffH) {
          minDiffH = diff;
          snappedY = (targetY - layerOffsetY) * scale;
        }
      }

      return { x: snappedX, y: snappedY };
    },
    [isSnapEnabled],
  );

  return { anchorDragBoundFunc };
};
