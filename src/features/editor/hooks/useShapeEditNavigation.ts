/**
 * useShapeEditNavigation.ts
 * ShapeEditTool / LineEditTool / GraphicEditTool 공통 네비게이션 로직
 *
 * ## 책임
 * - 선택 해제 시 ShapeTool로 복귀
 * - 다른 타입(도형↔선↔그래픽) 선택 시 패널 교체
 *
 * ## 사용 예시
 * ```tsx
 * const LineEditTool = () => {
 *   const { shouldRender } = useShapeEditNavigation({
 *     currentType: 'line',
 *     hasCurrentElements: lineElements.length > 0,
 *     otherElements: { shape: shapeElements.length > 0, graphic: graphicElements.length > 0 },
 *   });
 *   if (!shouldRender) return null;
 *   return <LineEditForm />;
 * };
 * ```
 */

import { useEffect, useRef } from 'react';
import { usePopMoreView, useReplaceMoreView } from '@/features/editor/store/useToolPanelStore';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';

type EditType = 'shape' | 'line' | 'graphic';

interface UseShapeEditNavigationOptions {
  /** 현재 패널 타입 */
  currentType: EditType;
  /** 현재 타입 요소가 선택되어 있는지 */
  hasCurrentElements: boolean;
  /** 다른 타입 요소들의 선택 여부 (현재 타입 제외) */
  otherElements: Partial<Record<EditType, boolean>>;
}

interface UseShapeEditNavigationResult {
  /** 현재 패널을 렌더링해야 하는지 (선택된 요소가 있는지) */
  shouldRender: boolean;
}

const EDIT_VIEW_CONFIG: Record<EditType, { view: (typeof TOGGLE_STATES)[keyof typeof TOGGLE_STATES]; title: string }> = {
  shape: { view: TOGGLE_STATES.SHAPE_EDIT, title: '도형' },
  line: { view: TOGGLE_STATES.LINE_EDIT, title: '선' },
  graphic: { view: TOGGLE_STATES.GRAPHIC_EDIT, title: '그래픽' },
};

/**
 * ShapeEditTool/LineEditTool/GraphicEditTool 공통 네비게이션 훅
 *
 * @param options.currentType - 현재 패널 타입 ('shape' | 'line' | 'graphic')
 * @param options.hasCurrentElements - 현재 타입 요소 선택 여부
 * @param options.otherElements - 다른 타입 요소들의 선택 여부
 */
export const useShapeEditNavigation = ({
  currentType: _currentType,
  hasCurrentElements,
  otherElements,
}: UseShapeEditNavigationOptions): UseShapeEditNavigationResult => {
  const popMoreView = usePopMoreView();
  const replaceMoreView = useReplaceMoreView();
  const hasReplacedRef = useRef(false);

  // 다른 타입 중 선택된 것이 있는지
  const hasAnyOtherElements = Object.values(otherElements).some(Boolean);

  // 선택 해제 시 ShapeTool로 복귀
  useEffect(() => {
    if (!hasCurrentElements && !hasAnyOtherElements) {
      popMoreView();
    }
  }, [hasCurrentElements, hasAnyOtherElements, popMoreView]);

  // 다른 타입 선택 시 해당 edit view로 교체
  useEffect(() => {
    if (hasReplacedRef.current) return;

    // 선택된 다른 타입 찾기
    const selectedOtherType = (Object.entries(otherElements) as [EditType, boolean][])
      .find(([, hasElements]) => hasElements)?.[0];

    if (!selectedOtherType) return;

    const config = EDIT_VIEW_CONFIG[selectedOtherType];
    hasReplacedRef.current = true;
    replaceMoreView(config.view, config.title, [], () => {});
  }, [otherElements, replaceMoreView]);

  // 현재 타입으로 돌아왔을 때 ref 리셋
  useEffect(() => {
    if (hasCurrentElements) {
      hasReplacedRef.current = false;
    }
  }, [hasCurrentElements]);

  return {
    shouldRender: hasCurrentElements,
  };
};
