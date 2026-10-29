'use client';

import ToolControlGroup, {
  ComponentCategory,
  ComponentItem,
} from '@/features/editor/components/panel/common/ToolControlGroup';
import { useMemo, useCallback, useRef } from 'react';
import IconInputField from '@/shared/ui/Input/IconInputField';
import { ToolSectionLayout } from '@/features/editor/components/panel/common';
import {
  usePushMoreView,
  useReplaceMoreView,
  useToolPanelStore,
  ProductImageItem,
} from '@/features/editor/store/useToolPanelStore';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import { ToggleState } from '@/shared/types/ui/toggles';
import { SHAPE_CATEGORIES, getShapeById } from '@/features/editor/constants/shapes';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useActiveFrames } from '@/features/editor/store/useCanvasDataStore';
import { useSelectionStore } from '@/features/editor/store/useSelectionStore';
import { useCenteredFrame } from '@/features/editor/hooks/useCenteredFrame';
import { useScrollToElement } from '@/features/editor/hooks/useScrollToElement';
import { useGraphicElements } from '@/features/editor/context/GraphicElementsContext';
import { loadImageSize } from '@/features/editor/lib/image-utils';
import type { GraphicElement } from '@/shared/types/elements';

/** 그래픽 요소 최대 크기 (px) */
const GRAPHIC_MAX_SIZE = 200;

/** 원본 비율 유지하며 최대 크기 내로 조정 */
const constrainToMaxSize = (
  width: number,
  height: number,
  maxSize: number,
): { width: number; height: number } => {
  const maxDimension = Math.max(width, height);
  if (maxDimension <= maxSize) return { width, height };

  const scale = maxSize / maxDimension;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
};

const renderGraphicPreview = (item: GraphicElement) => (
  <img src={item.thumbnailUrl} alt={item.name} className="size-full object-contain" />
);

/** 요소 카테고리별 편집 패널 설정 */
const EDIT_PANEL_CONFIG: Record<
  'shape' | 'line' | 'graphic',
  { toggle: ToggleState; title: string }
> = {
  shape: { toggle: TOGGLE_STATES.SHAPE_EDIT, title: '도형' },
  line: { toggle: TOGGLE_STATES.LINE_EDIT, title: '선' },
  graphic: { toggle: TOGGLE_STATES.GRAPHIC_EDIT, title: '그래픽' },
};

const ShapeTool = () => {
  const pushMoreView = usePushMoreView();
  const replaceMoreView = useReplaceMoreView();
  const addShapeToFrame = useElementStore((state) => state.addShapeToFrame);
  const addGraphicToFrame = useElementStore((state) => state.addGraphicToFrame);
  const setSelectedItems = useSelectionStore((state) => state.setSelectedItems);
  const activeFrames = useActiveFrames();
  const { getCenteredFrame } = useCenteredFrame();
  const { scrollToPosition } = useScrollToElement();
  const graphicElements = useGraphicElements();

  const categories: ComponentCategory[] = useMemo(() => {
    const shapeCategories = SHAPE_CATEGORIES.map((cat) => ({
      id: cat.id,
      title: cat.title,
      type: 'shape' as const,
      showMore: cat.items.length > 3,
      items: cat.items.slice(0, 3).map((item) => ({
        id: item.id,
        name: item.name,
        preview: item.preview,
      })),
    }));

    if (graphicElements.length === 0) return shapeCategories;

    shapeCategories.push({
      id: 'graphics',
      title: '그래픽',
      type: 'shape' as const,
      showMore: graphicElements.length > 3,
      items: graphicElements.slice(0, 3).map((item) => ({
        id: item.id,
        name: item.name,
        preview: renderGraphicPreview(item),
      })),
    });

    return shapeCategories;
  }, [graphicElements]);

  /** 요소 추가 후 선택 및 편집 패널 전환 */
  const selectAndShowEditPanel = useCallback(
    (
      newId: string,
      elementType: string,
      frameId: string,
      category: 'shape' | 'line' | 'graphic',
    ) => {
      // 실행 시점의 moreViewStack 확인 (스테일 클로저 방지)
      const isInMoreView = useToolPanelStore.getState().moreViewStack.length > 0;
      const { toggle, title } = EDIT_PANEL_CONFIG[category];

      // 더보기에서 호출 시: 선택 후 다음 프레임에서 패널 전환 (렌더링 완료 대기)
      if (isInMoreView) {
        setSelectedItems([{ id: newId, type: elementType, rootId: frameId }]);
        requestAnimationFrame(() => {
          replaceMoreView(toggle, title, [], () => {});
        });
        return;
      }

      setSelectedItems([{ id: newId, type: elementType, rootId: frameId }]);
      pushMoreView(toggle, title, [], () => {}, TOGGLE_STATES.SHAPE);
    },
    [setSelectedItems, pushMoreView, replaceMoreView],
  );

  /** 프레임 중앙으로 스크롤 */
  const scrollToFrameCenter = useCallback(
    (frameId: string, width: number, height: number) => {
      scrollToPosition(frameId, width / 2, height / 2, { behavior: 'smooth', delay: 150 });
    },
    [scrollToPosition],
  );

  const handleItemClick = useCallback(
    async (item: ComponentItem) => {
      if (activeFrames.length === 0) return;

      const centeredFrame = getCenteredFrame(activeFrames);
      if (!centeredFrame) return;

      const frameId = centeredFrame.id;
      const frameWidth = centeredFrame.width ?? 860;
      const frameHeight = centeredFrame.height ?? 1080;

      // 그래픽 요소 처리
      const graphicElement = graphicElements.find((g) => g.id === item.id);
      if (graphicElement) {
        // 클라이언트에서 이미지 원본 크기 측정 후 최대 크기 내로 조정
        const originalSize = await loadImageSize(graphicElement.imageUrl);
        const size = constrainToMaxSize(originalSize.width, originalSize.height, GRAPHIC_MAX_SIZE);
        const newId = addGraphicToFrame(frameId, graphicElement.id, graphicElement.imageUrl, size);
        if (newId) {
          selectAndShowEditPanel(newId, 'rect', frameId, 'graphic');
        }
        scrollToFrameCenter(frameId, frameWidth, frameHeight);
        return;
      }

      // 도형/선 요소 처리
      const shapeDefinition = getShapeById(item.id);
      if (!shapeDefinition) return;

      const newId = addShapeToFrame(frameId, shapeDefinition.defaultProps);
      if (newId) {
        selectAndShowEditPanel(
          newId,
          shapeDefinition.defaultProps.type,
          frameId,
          shapeDefinition.category,
        );
      }
      scrollToFrameCenter(frameId, frameWidth, frameHeight);
    },
    [
      activeFrames,
      getCenteredFrame,
      graphicElements,
      addGraphicToFrame,
      addShapeToFrame,
      selectAndShowEditPanel,
      scrollToFrameCenter,
    ],
  );

  // 스테일 클로저 방지: onSelect 콜백에서 항상 최신 handleItemClick 사용
  const handleItemClickRef = useRef(handleItemClick);
  handleItemClickRef.current = handleItemClick;

  const handleMoreClick = useCallback(
    (categoryId: string) => {
      if (categoryId === 'graphics') {
        const moreItems: ProductImageItem[] = graphicElements.map((item) => ({
          id: item.id,
          name: item.name,
          category: 'graphic',
          preview: renderGraphicPreview(item),
        }));

        pushMoreView(
          TOGGLE_STATES.SHAPE_MORE,
          '그래픽',
          moreItems,
          (selectedItem) => handleItemClickRef.current({ id: selectedItem.id, name: selectedItem.name }),
          TOGGLE_STATES.SHAPE,
        );
        return;
      }

      const category = SHAPE_CATEGORIES.find((cat) => cat.id === categoryId);
      if (!category) return;

      const moreItems: ProductImageItem[] = category.items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        preview: item.preview,
      }));

      pushMoreView(
        TOGGLE_STATES.SHAPE_MORE,
        category.title,
        moreItems,
        (selectedItem) => {
          const shapeDefinition = getShapeById(selectedItem.id);
          if (!shapeDefinition) return;
          handleItemClickRef.current({
            id: shapeDefinition.id,
            name: shapeDefinition.name,
            preview: shapeDefinition.preview,
          });
        },
        TOGGLE_STATES.SHAPE,
      );
    },
    [graphicElements, pushMoreView],
  );

  return (
    <ToolSectionLayout
      title="요소"
      body={
        <IconInputField wrapClassName="tool-search-input mb-8" placeholder="요소를 검색하세요." />
      }
    >
      {categories.map((category) => (
        <ToolControlGroup
          key={category.id}
          category={category}
          onItemClick={handleItemClick}
          onMoreClick={handleMoreClick}
        />
      ))}
    </ToolSectionLayout>
  );
};

export default ShapeTool;
