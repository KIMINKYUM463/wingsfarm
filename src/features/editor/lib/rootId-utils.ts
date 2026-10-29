import Konva from 'konva';
import type { KonvaElement, KonvaFrameElement, KonvaTextElement } from '@/shared/types/konva';
import { isKonvaGroupElement, isKonvaFrameElement, isKonvaTextElement } from '@/shared/types/konva';

/**
 * Konva Text를 오프스크린에서 생성하여 실제 width/height 측정
 *
 * Figma textAutoResize 모드에 따른 처리:
 * - WIDTH_AND_HEIGHT: width/height 모두 undefined → 둘 다 측정
 * - HEIGHT: width 고정, height undefined → height만 측정
 * - NONE: width/height 모두 고정 → 측정 불필요
 */
const measureTextDimensions = (
  textElement: KonvaTextElement,
): { width: number; height: number } => {
  const tempText = new Konva.Text({
    text: textElement.text,
    fontSize: textElement.fontSize,
    fontFamily: textElement.fontFamily,
    fontStyle: textElement.fontStyle,
    lineHeight: textElement.lineHeight,
    letterSpacing: textElement.letterSpacing,
    width: textElement.width || undefined, // undefined면 Konva가 auto width 계산
    wrap: textElement.wrap,
    padding: textElement.padding,
  });

  const dimensions = {
    width: tempText.width(),
    height: tempText.height(),
  };
  tempText.destroy();

  return dimensions;
};

/**
 * 요소에 rootId 주입 (재귀)
 * - 텍스트 요소: width/height가 없으면 Konva로 측정하여 주입
 *
 * @description 프론트엔드 전역 상태 초기화 시 사용
 * @note 백엔드 응답에 rootId가 있어도 덮어씀 (일관성 보장)
 */
export const injectRootId = (element: KonvaElement, rootId: string): KonvaElement => {
  // Group/중첩 Frame: children도 재귀 처리
  if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) {
    return {
      ...element,
      rootId,
      children: element.children.map((child) => injectRootId(child, rootId)),
    } as KonvaElement;
  }

  // 텍스트 요소: width/height 없으면 측정
  if (isKonvaTextElement(element)) {
    const needsWidthMeasure = !element.width || element.width <= 0;
    const needsHeightMeasure = !element.height || element.height <= 0;

    // 측정 필요 없으면 바로 반환
    if (!needsWidthMeasure && !needsHeightMeasure) {
      return { ...element, rootId } as KonvaElement;
    }

    const measured = measureTextDimensions(element);

    return {
      ...element,
      rootId,
      width: needsWidthMeasure ? measured.width : element.width,
      height: needsHeightMeasure ? measured.height : element.height,
    } as KonvaElement;
  }

  // 일반 요소
  return { ...element, rootId } as KonvaElement;
};

/**
 * Frame의 모든 자식에 rootId 주입
 *
 * @param frameData - 백엔드에서 받은 frame_data (rootId 없을 수 있음)
 * @param frameId - 최상위 프레임의 DB UUID (rootId로 사용)
 * @returns rootId가 주입된 KonvaFrameElement
 */
export const injectRootIdToFrame = (
  frameData: KonvaFrameElement,
  frameId: string,
): KonvaFrameElement => {
  return {
    ...frameData,
    children: frameData.children.map((child) => injectRootId(child, frameId)),
  };
};
