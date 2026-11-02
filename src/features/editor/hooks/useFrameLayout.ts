import { useMemo } from 'react';
import { KonvaFrameElement } from '@/shared/types/konva';
import { useIsToolPanelOpen } from '@/features/editor/store/useToolPanelStore';
import { useManualZoomPercentage, useIsManualZoom } from '@/features/editor/store/useZoomStore';
import { calcAutoFitZoom, resolveZoomPercentage } from '@/features/editor/utils/zoomUtils';
import { getCSSVariableValue } from '@/utils/css';
import useWindowSize from '@/shared/hooks/useWindowSize';

interface FrameLayoutConfig {
  /** 프레임 인덱스 (0 = 첫 프레임) */
  index?: number;
  /** 마지막 프레임 여부 - 하단 여백 추가 */
  isLastFrame?: boolean;
  /** 첫 프레임 상단 여백 (px) - 기본값: CSS 변수 */
  topOffset?: number;
  /** 프레임 간 간격 (px) - 기본값: CSS 변수 */
  frameGap?: number;
  defaultFrameWidth?: number;
  defaultFrameHeight?: number;
}

/** 정적 CSS 변수값 캐시 (런타임에 변하지 않음) */
let cachedSidebarValues: {
  leftSidebarWidth: number;
  toolPanelWidth: number;
  rightSidebarWidth: number;
  rightSidebarGap: number;
} | null = null;

const getSidebarValues = () => {
  if (!cachedSidebarValues && typeof window !== 'undefined') {
    cachedSidebarValues = {
      leftSidebarWidth: getCSSVariableValue('--w-left-sidebar'),
      toolPanelWidth: getCSSVariableValue('--tool-panel-w'),
      rightSidebarWidth: getCSSVariableValue('--right-sidebar-w'),
      rightSidebarGap: getCSSVariableValue('--right-sidebar-gap'),
    };
  }
  return cachedSidebarValues ?? { leftSidebarWidth: 0, toolPanelWidth: 0, rightSidebarWidth: 0, rightSidebarGap: 0 };
};

/** frame은 크기만 쓴다 — 프레임이 아닌 섹션(맨 위 움직이는 컷)도 같은 배치를 쓸 수 있게 */
export const useFrameLayout = (frame: Pick<KonvaFrameElement, 'width' | 'height'>, config: FrameLayoutConfig = {}) => {
  const { index = 0, isLastFrame = false, defaultFrameWidth = 860, defaultFrameHeight = 1080 } =
    config;

  const isToolPanelOpen = useIsToolPanelOpen();
  const { width: viewportWidth, height: viewportHeight } = useWindowSize(16); // 60fps

  // 줌 상태 (수동 모드일 때만 사용)
  const manualZoomPercentage = useManualZoomPercentage();
  const isManualZoom = useIsManualZoom();

  return useMemo(() => {
    const frameWidth = frame.width || defaultFrameWidth;
    const frameHeight = frame.height || defaultFrameHeight;

    // CSS 변수에서 레이아웃 값 가져오기
    const frameGap = config.frameGap ?? getCSSVariableValue('--frame-gap');
    const halfGap = frameGap / 2;
    const baseTopOffset = config.topOffset ?? getCSSVariableValue('--frame-top-offset');
    const topOffset = index === 0 ? baseTopOffset : halfGap;

    // 사이드바 너비 (캐시된 값 사용)
    const sidebar = getSidebarValues();
    const toolPanelWidth = isToolPanelOpen ? sidebar.toolPanelWidth : 0;

    // Stage 너비 계산
    const stageMaxWidth =
      viewportWidth - sidebar.leftSidebarWidth - sidebar.rightSidebarWidth - sidebar.rightSidebarGap;
    const availableWidth = stageMaxWidth - toolPanelWidth;

    // 자동 맞춤 줌 계산 (공통 유틸 사용)
    const autoFitZoom = calcAutoFitZoom({ availableWidth, frameWidth });
    const zoomPercentage = resolveZoomPercentage(isManualZoom, manualZoomPercentage, autoFitZoom);
    const scale = zoomPercentage / 100;

    // 스케일 적용된 프레임 크기
    const scaledFrameWidth = frameWidth * scale;
    const scaledFrameHeight = frameHeight * scale;

    // 프레임 위치 계산 (스케일 적용된 크기 기준으로 중앙 정렬)
    const layerOffsetX = (availableWidth - scaledFrameWidth) / 2;
    const layerOffsetY = topOffset;

    // Stage 높이 (스케일 적용된 높이 기준)
    const bottomOffset = halfGap + (isLastFrame ? baseTopOffset : 0);
    const stageHeight = Math.max(scaledFrameHeight + topOffset + bottomOffset, viewportHeight);

    return {
      frameWidth,
      frameHeight,
      scaledFrameWidth,
      scaledFrameHeight,
      scale,
      zoomPercentage, // UI 표시용
      layerOffsetX,
      layerOffsetY,
      stageWidth: availableWidth,
      stageHeight,
      frameGap,
    };
  }, [
    frame.width,
    frame.height,
    defaultFrameWidth,
    defaultFrameHeight,
    config.frameGap,
    config.topOffset,
    index,
    isLastFrame,
    isToolPanelOpen,
    viewportWidth,
    viewportHeight,
    manualZoomPercentage,
    isManualZoom,
  ]);
};
