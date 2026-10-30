'use client';

import { useMemo } from 'react';
import { useManualZoomPercentage, useIsManualZoom } from '@/features/editor/store/useZoomStore';
import { calcAutoFitZoom, resolveZoomPercentage } from '@/features/editor/utils/zoomUtils';
import { getCSSVariableValue } from '@/utils/css';
import useWindowSize from '@/shared/hooks/useWindowSize';

/** 기본 프레임 크기 */
const DEFAULT_FRAME_WIDTH = 860;
const DEFAULT_FRAME_HEIGHT = 1080;

/** 정적 CSS 변수값 캐시 */
let cachedSidebarValues: {
  leftSidebarWidth: number;
  toolPanelWidth: number;
  rightSidebarWidth: number;
  rightSidebarGap: number;
  frameGap: number;
  frameTopOffset: number;
} | null = null;

const getSidebarValues = () => {
  if (!cachedSidebarValues && typeof window !== 'undefined') {
    cachedSidebarValues = {
      leftSidebarWidth: getCSSVariableValue('--w-left-sidebar'),
      toolPanelWidth: getCSSVariableValue('--tool-panel-w'),
      rightSidebarWidth: getCSSVariableValue('--right-sidebar-w'),
      rightSidebarGap: getCSSVariableValue('--right-sidebar-gap'),
      frameGap: getCSSVariableValue('--frame-gap'),
      frameTopOffset: getCSSVariableValue('--frame-top-offset'),
    };
  }
  return (
    cachedSidebarValues ?? {
      leftSidebarWidth: 0,
      toolPanelWidth: 0,
      rightSidebarWidth: 0,
      rightSidebarGap: 0,
      frameGap: 0,
      frameTopOffset: 0,
    }
  );
};

interface FrameLoadingPlaceholderProps {
  /** 플레이스홀더 너비 (모바일 전용, 데스크톱은 자동 계산) */
  width?: number;
  /** 레이아웃 변형 - mobile: 반응형 모바일 레이아웃 (width 없이도 자동 계산) */
  variant?: 'desktop' | 'mobile';
  /** 툴 패널 열림 상태 (데스크톱에서 부모로부터 전달) */
  isToolPanelOpen?: boolean;
  /** 프레임 ID (인디케이터 감지용) */
  frameId?: string;
  /** 프레임 인덱스 (간격 계산용) */
  index?: number;
  /** 마지막 프레임 여부 (하단 간격 계산용) */
  isLastFrame?: boolean;
  /** 로딩 막대 아래 안내 문구 */
  message?: string;
}

/**
 * 프레임 로딩 플레이스홀더 (Figma 디자인 기반)
 * - 모바일: width prop 전달, mt-9 상단 여백
 * - 데스크톱: useFrameLayout과 동일한 계산으로 크기/위치 결정
 */
/** 모바일 콘텐츠 패딩 (MobileEditorView와 동일: px-4.5 = 18px) */
const MOBILE_CONTENT_PADDING = 18;

export function FrameLoadingPlaceholder({
  width,
  variant = 'desktop',
  isToolPanelOpen = false,
  frameId,
  index = 0,
  isLastFrame = false,
  message,
}: FrameLoadingPlaceholderProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowSize(16);
  const manualZoomPercentage = useManualZoomPercentage();
  const isManualZoom = useIsManualZoom();

  // 모바일 레이아웃 여부: variant='mobile' 또는 width prop이 있으면 모바일
  const isMobileLayout = variant === 'mobile' || width !== undefined;

  // 모바일: width prop 또는 뷰포트 기반 자동 계산
  const mobileWidth = width ?? viewportWidth - MOBILE_CONTENT_PADDING * 2;

  // 데스크톱: useFrameLayout과 동일한 계산
  const desktopLayout = useMemo(() => {
    if (isMobileLayout) return null;

    const sidebar = getSidebarValues();
    const toolPanelWidth = isToolPanelOpen ? sidebar.toolPanelWidth : 0;

    const stageMaxWidth =
      viewportWidth -
      sidebar.leftSidebarWidth -
      sidebar.rightSidebarWidth -
      sidebar.rightSidebarGap;
    const availableWidth = stageMaxWidth - toolPanelWidth;

    const autoFitZoom = calcAutoFitZoom({ availableWidth, frameWidth: DEFAULT_FRAME_WIDTH });
    const zoomPercentage = resolveZoomPercentage(isManualZoom, manualZoomPercentage, autoFitZoom);
    const scale = zoomPercentage / 100;

    const scaledWidth = DEFAULT_FRAME_WIDTH * scale;
    const scaledHeight = DEFAULT_FRAME_HEIGHT * scale;

    // 간격 계산 (useFrameLayout과 동일)
    const halfGap = sidebar.frameGap / 2;
    const topOffset = index === 0 ? sidebar.frameTopOffset : halfGap;
    const bottomOffset = halfGap + (isLastFrame ? sidebar.frameTopOffset : 0);
    const containerHeight = Math.max(scaledHeight + topOffset + bottomOffset, viewportHeight);

    return {
      scaledWidth,
      scaledHeight,
      topOffset,
      containerHeight,
    };
  }, [isMobileLayout, isToolPanelOpen, viewportWidth, viewportHeight, isManualZoom, manualZoomPercentage, index, isLastFrame]);

  const placeholderWidth = isMobileLayout ? mobileWidth : desktopLayout!.scaledWidth;
  const placeholderHeight = isMobileLayout
    ? (mobileWidth * DEFAULT_FRAME_HEIGHT) / DEFAULT_FRAME_WIDTH
    : desktopLayout!.scaledHeight;

  const placeholder = (
    <div
      className="flex flex-col items-center justify-center gap-4 bg-gray-100"
      style={{ width: placeholderWidth, height: placeholderHeight }}
      suppressHydrationWarning
    >
      <div className="flex items-center gap-1.25">
        <div
          className="h-5.75 w-1.25 origin-center bg-gray-900"
          style={{ animation: 'loading-bar-pulse 1.2s ease-in-out infinite' }}
        />
        <div
          className="h-3.75 w-1.25 origin-center bg-gray-900"
          style={{ animation: 'loading-bar-pulse 1.2s ease-in-out infinite', animationDelay: '0.2s' }}
        />
        <div
          className="h-5.75 w-1.25 origin-center bg-gray-900"
          style={{ animation: 'loading-bar-pulse 1.2s ease-in-out infinite', animationDelay: '0.4s' }}
        />
      </div>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );

  // 모바일: 상단 여백만 추가
  if (isMobileLayout) {
    return <div className="mt-9">{placeholder}</div>;
  }

  // 데스크톱: 개별 프레임 로딩 vs 초기 로딩 분기
  const isIndividualFrameLoading = frameId !== undefined;

  if (isIndividualFrameLoading && desktopLayout) {
    // 개별 프레임 로딩: useFrameLayout과 동일한 레이아웃
    return (
      <div
        data-frame-id={frameId}
        className="flex justify-center"
        style={{ paddingTop: desktopLayout.topOffset, height: desktopLayout.containerHeight }}
      >
        {placeholder}
      </div>
    );
  }

  // 초기 로딩: 기존 레이아웃 유지 (height 없음)
  return (
    <div className="flex justify-center pt-(--frame-top-offset)">
      {placeholder}
    </div>
  );
}
