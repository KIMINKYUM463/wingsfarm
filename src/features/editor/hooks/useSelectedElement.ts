import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSelectionStore } from '@/features/editor/store/useSelectionStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import {
  KonvaElement,
  KonvaTextElement,
  KonvaShapeElement,
  KonvaLineTypeElement,
  KonvaRectElement,
  isKonvaContainerElement,
  isKonvaTextElement,
  isKonvaShapeElement,
  isKonvaLineTypeElement,
  isKonvaGraphicElement,
} from '@/shared/types/konva';
import { isFilledShapeElement } from '@/features/editor/lib/element-finder';

/**
 * 요소에서 텍스트 요소들을 재귀적으로 수집
 * Group 및 중첩 Frame 내부도 탐색
 */
const collectTextElements = (element: KonvaElement): KonvaTextElement[] => {
  if (isKonvaTextElement(element)) {
    return [element];
  }
  if (isKonvaContainerElement(element)) {
    return element.children.flatMap(collectTextElements);
  }
  return [];
};

/**
 * 요소에서 Shape 요소들을 재귀적으로 수집
 * Group 및 중첩 Frame 내부도 탐색
 */
const collectShapeElements = (element: KonvaElement): KonvaShapeElement[] => {
  if (isKonvaShapeElement(element)) {
    return [element];
  }
  if (isKonvaContainerElement(element)) {
    return element.children.flatMap(collectShapeElements);
  }
  return [];
};

/**
 * 요소에서 Line 요소들을 재귀적으로 수집 (line, arrow)
 * Group 및 중첩 Frame 내부도 탐색
 */
const collectLineElements = (element: KonvaElement): KonvaLineTypeElement[] => {
  if (isKonvaLineTypeElement(element)) {
    return [element];
  }
  if (isKonvaContainerElement(element)) {
    return element.children.flatMap(collectLineElements);
  }
  return [];
};

/**
 * 요소에서 그래픽 요소들을 재귀적으로 수집
 * - name === '_graphic' (기존 그래픽)
 * - rect + assetId + name이 _graphic/_image 아님 (채워진 도형)
 * Group 및 중첩 Frame 내부도 탐색
 */
const collectGraphicElements = (element: KonvaElement): KonvaRectElement[] => {
  if (isKonvaGraphicElement(element) || isFilledShapeElement(element)) {
    return [element as KonvaRectElement];
  }
  if (isKonvaContainerElement(element)) {
    return element.children.flatMap(collectGraphicElements);
  }
  return [];
};


/**
 * 현재 선택된 요소들을 반환하는 커스텀 훅
 *
 * ## 구독 방식 (최적화)
 * - flatElements 전체 Map이 아닌 선택된 요소만 추출
 * - useShallow로 배열 요소 단위 비교 → 선택되지 않은 요소 변경 시 re-render 방지
 *
 * ## 반환값
 * - element: 첫 번째 선택된 요소 (단일 선택 호환)
 * - elements: 모든 선택된 요소 배열 (다중 선택용)
 * - textElements: 선택된 요소들 중 텍스트 요소 (그룹 내부 포함)
 * - shapeElements: 선택된 요소들 중 도형 요소 (그룹 내부 포함, line/arrow/graphic 제외)
 * - lineElements: 선택된 요소들 중 선 요소 (line, arrow)
 * - graphicElements: 선택된 요소들 중 그래픽 요소 (name === '_graphic')
 */
export const useSelectedElement = () => {
  const selectedItems = useSelectionStore((state) => state.selectedItems);

  // 선택된 요소의 ID 목록
  const selectedIds = useMemo(
    () => selectedItems.map((item) => item.id),
    [selectedItems],
  );

  // 선택된 요소만 추출 + useShallow로 얕은 비교
  // → 선택되지 않은 요소가 변경되어도 re-render 안 함
  const selectedElements = useCanvasDataStore(
    useShallow((state) => {
      if (selectedIds.length === 0) return [];
      return selectedIds
        .map((id) => state.flatElements.get(id))
        .filter((el): el is KonvaElement => el !== undefined);
    }),
  );

  const { element, elements, textElements, shapeElements, lineElements, graphicElements } = useMemo(() => {
    if (selectedElements.length === 0) {
      return { element: null, elements: [], textElements: [], shapeElements: [], lineElements: [], graphicElements: [] };
    }

    // 텍스트 요소 수집 (그룹 내부 텍스트 포함)
    const texts = selectedElements.flatMap(collectTextElements);
    // Shape 요소 수집 (그룹 내부 포함, line/arrow/graphic 제외)
    const shapes = selectedElements.flatMap(collectShapeElements);
    // Line 요소 수집 (line, arrow)
    const lines = selectedElements.flatMap(collectLineElements);
    // Graphic 요소 수집 (name === '_graphic' 또는 채워진 도형)
    const graphics = selectedElements.flatMap(collectGraphicElements);

    return {
      element: selectedElements[0] ?? null,
      elements: selectedElements,
      textElements: texts,
      shapeElements: shapes,
      lineElements: lines,
      graphicElements: graphics,
    };
  }, [selectedElements]);

  return { element, elements, textElements, shapeElements, lineElements, graphicElements };
};
