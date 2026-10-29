/**
 * useCurrentZoom.ts
 * 현재 줌 퍼센트를 계산하는 훅 (EditorFooter 등에서 사용)
 *
 * useFrameLayout의 줌 계산 로직을 공유하여 일관성 유지
 */

import { useMemo } from 'react';
import { useIsToolPanelOpen } from '@/features/editor/store/useToolPanelStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useManualZoomPercentage, useIsManualZoom } from '@/features/editor/store/useZoomStore';
import { calcAutoFitZoom, resolveZoomPercentage } from '@/features/editor/utils/zoomUtils';
import { getCSSVariableValue } from '@/utils/css';
import useWindowSize from '@/shared/hooks/useWindowSize';

/** 정적 CSS 변수값 캐시 */
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

const DEFAULT_FRAME_WIDTH = 860;

/**
 * 현재 줌 퍼센트를 반환하는 훅
 * - 자동 모드: 뷰포트 기반 계산된 줌
 * - 수동 모드: 사용자가 설정한 줌
 */
export const useCurrentZoom = () => {
  const isToolPanelOpen = useIsToolPanelOpen();
  const { width: viewportWidth } = useWindowSize(100); // UI 표시용 (60fps 불필요)
  const frames = useCanvasDataStore((state) => state.frames);

  // 줌 상태
  const manualZoomPercentage = useManualZoomPercentage();
  const isManualZoom = useIsManualZoom();

  return useMemo(() => {
    // 첫 프레임의 너비 사용 (없으면 기본값)
    const frameWidth = frames[0]?.width || DEFAULT_FRAME_WIDTH;

    // 사이드바 너비 (캐시된 값 사용)
    const sidebar = getSidebarValues();
    const toolPanelWidth = isToolPanelOpen ? sidebar.toolPanelWidth : 0;

    // Stage 너비 계산
    const stageMaxWidth =
      viewportWidth - sidebar.leftSidebarWidth - sidebar.rightSidebarWidth - sidebar.rightSidebarGap;
    const availableWidth = stageMaxWidth - toolPanelWidth;

    // 자동 맞춤 줌 계산 (공통 유틸 사용)
    const autoFitZoom = calcAutoFitZoom({ availableWidth, frameWidth });
    return resolveZoomPercentage(isManualZoom, manualZoomPercentage, autoFitZoom);
  }, [frames, isToolPanelOpen, viewportWidth, manualZoomPercentage, isManualZoom]);
};
