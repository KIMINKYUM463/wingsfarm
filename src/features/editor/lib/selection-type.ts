/**
 * selection-type.ts
 * 선택된 요소들로부터 Tool Panel 타입을 계산하는 유틸리티
 */

import { ToggleState } from '@/shared/types/ui/toggles';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import type { KonvaElement } from '@/shared/types/konva';

interface SelectedItem {
  id: string;
  type: string;
}

/** 요소 또는 자식 중 텍스트가 있는지 재귀 확인 */
const hasTextInElement = (element: KonvaElement): boolean => {
  if (element.type === 'text') return true;
  if ('children' in element && Array.isArray(element.children)) {
    return element.children.some(hasTextInElement);
  }
  return false;
};

/**
 * 선택된 아이템들로부터 Tool Panel 타입 계산
 *
 * @param selectedItems - 선택된 아이템 배열
 * @param getElement - ID로 요소를 가져오는 함수
 * @returns ToggleState | null (null이면 패널 상태 유지)
 */
export const getSelectionType = (
  selectedItems: SelectedItem[],
  getElement: (id: string) => KonvaElement | undefined,
): ToggleState | null => {
  if (selectedItems.length === 0) {
    return TOGGLE_STATES.NONE;
  }

  const validElements: KonvaElement[] = [];
  let allImageElements = true;
  let hasText = false;

  for (const item of selectedItems) {
    const element = getElement(item.id);
    if (!element) continue;

    // 1. assetId가 있는 rect/path → 이미지 계열 분기
    const hasAsset = (element.type === 'rect' || element.type === 'path') && 'assetId' in element && element.assetId;

    if (hasAsset) {
      // 1-1. 그래픽 (_graphic)
      if (element.name === '_graphic') {
        return TOGGLE_STATES.GRAPHIC_EDIT;
      }
      // 1-2. 이미지 (_image 포함)
      if (element.name?.includes('_image')) {
        validElements.push(element);
        continue;
      }
      // 1-3. 채워진 도형 (위 둘 다 아님) → 그래픽 패널
      return TOGGLE_STATES.GRAPHIC_EDIT;
    }

    // 2. assetId 없는 요소
    validElements.push(element);
    allImageElements = false;

    if (hasTextInElement(element)) {
      hasText = true;
    }
  }

  if (validElements.length === 0) {
    return TOGGLE_STATES.NONE;
  }

  // 3. 모두 이미지 요소면 IMAGE 패널
  if (allImageElements) {
    return TOGGLE_STATES.IMAGE;
  }

  // 4. 텍스트 요소가 있으면 TEXT 패널
  if (hasText) {
    return TOGGLE_STATES.TEXT;
  }

  // 5. 다중 선택 → 패널 상태 유지
  if (validElements.length > 1) {
    return null;
  }

  // 6. 단일 선택 → 해당 타입 패널
  const firstType = validElements[0]?.type;
  switch (firstType) {
    case 'rect':
    case 'path':
    case 'group':
    case 'circle':
    case 'ellipse':
    case 'star':
    case 'regularPolygon':
    case 'line':
    case 'arrow':
      return TOGGLE_STATES.SHAPE;
    case 'frame':
      return TOGGLE_STATES.TEMPLATE;
    default:
      return TOGGLE_STATES.SHAPE;
  }
};
