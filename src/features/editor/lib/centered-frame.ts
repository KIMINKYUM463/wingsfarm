/**
 * centered-frame.ts
 * viewport 중심에 가장 가까운 프레임을 찾는 유틸리티
 */

import { KonvaFrameElement } from '@/shared/types/konva';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';

/**
 * 요소 중심점과 뷰포트 중심점 사이의 거리 계산
 */
const calculateDistanceFromViewportCenter = (rect: DOMRect): number => {
  const viewportCenterX = window.innerWidth / 2;
  const viewportCenterY = window.innerHeight / 2;
  const elementCenterX = rect.left + rect.width / 2;
  const elementCenterY = rect.top + rect.height / 2;
  const dx = viewportCenterX - elementCenterX;
  const dy = viewportCenterY - elementCenterY;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * 프레임 배열에서 viewport 중심에 가장 가까운 프레임 반환
 */
export const getCenteredFrame = (frames: KonvaFrameElement[]): KonvaFrameElement | null => {
  if (!frames || frames.length === 0) return null;

  let minDistance = Infinity;
  let closestFrame: KonvaFrameElement | null = null;

  frames.forEach((frame) => {
    const frameElement = document.querySelector(`[data-frame-id="${frame.id}"]`) as HTMLElement;
    let rect: DOMRect | null = null;

    if (frameElement) {
      rect = frameElement.getBoundingClientRect();
    } else {
      const allStages = document.querySelectorAll('canvas');
      const frameIndex = frames.findIndex((f) => f.id === frame.id);
      const canvas = allStages[frameIndex];
      if (canvas) {
        rect = canvas.getBoundingClientRect();
      }
    }

    if (!rect) return;

    const distance = calculateDistanceFromViewportCenter(rect);
    if (distance < minDistance) {
      minDistance = distance;
      closestFrame = frame;
    }
  });

  return closestFrame || frames[0];
};

/**
 * 현재 viewport 중심에 있는 active 프레임의 ID 반환 (명령형)
 * - 키보드 핸들러, 콜백 등에서 사용
 */
export const getCenteredFrameId = (): string | null => {
  const frames = useCanvasDataStore.getState().frames;
  const activeFrames = frames.filter((f) => f.status === 'active');
  const centeredFrame = getCenteredFrame(activeFrames);
  return centeredFrame?.id ?? null;
};
