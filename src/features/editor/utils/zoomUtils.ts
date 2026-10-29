/**
 * zoomUtils.ts
 * 줌 계산 공통 유틸리티
 */

import { ZOOM_LIMITS } from '@/features/editor/store/useZoomStore';

// 프레임 좌우 여백 (스케일링 시 최소 여백 확보)
export const FRAME_HORIZONTAL_PADDING = 20;

interface CalcAutoFitZoomParams {
  availableWidth: number;
  frameWidth: number;
}

/**
 * 자동 맞춤 줌 퍼센트 계산
 * - 프레임이 availableWidth보다 크면 축소
 * - 좌우 여백(FRAME_HORIZONTAL_PADDING) 확보
 * - ZOOM_LIMITS 범위 내로 클램프
 */
export const calcAutoFitZoom = ({ availableWidth, frameWidth }: CalcAutoFitZoomParams): number => {
  const maxFrameWidth = availableWidth - FRAME_HORIZONTAL_PADDING * 2;
  const autoFitScale = Math.min(1, maxFrameWidth / frameWidth);
  return Math.max(ZOOM_LIMITS.MIN, Math.min(ZOOM_LIMITS.MAX, Math.round(autoFitScale * 100)));
};

/**
 * 최종 줌 퍼센트 결정
 * - 수동 모드: manualZoomPercentage 사용
 * - 자동 모드: autoFitZoom 사용
 */
export const resolveZoomPercentage = (
  isManualZoom: boolean,
  manualZoomPercentage: number,
  autoFitZoom: number,
): number => {
  return isManualZoom ? manualZoomPercentage : autoFitZoom;
};
