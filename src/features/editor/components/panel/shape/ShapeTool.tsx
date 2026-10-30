'use client';

import ToolControlGroup, {
  ComponentCategory,
  ComponentItem,
} from '@/features/editor/components/panel/common/ToolControlGroup';
import { useMemo, useCallback, useRef, useState } from 'react';
import IconInputField from '@/shared/ui/Input/IconInputField';
import { ToolSectionLayout } from '@/features/editor/components/panel/common';
import ShapeItemGrid from '@/features/editor/components/shared/ShapeItemGrid';
import {
  usePushMoreView,
  useReplaceMoreView,
  useToolPanelStore,
  ProductImageItem,
} from '@/features/editor/store/useToolPanelStore';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import { ToggleState } from '@/shared/types/ui/toggles';
import { SHAPE_CATEGORIES, groupInOrder, type ShapeDefinition } from '@/features/editor/constants/shapes';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useActiveFrames } from '@/features/editor/store/useCanvasDataStore';
import { useSelectionStore } from '@/features/editor/store/useSelectionStore';
import { useCenteredFrame } from '@/features/editor/hooks/useCenteredFrame';
import { useScrollToElement } from '@/features/editor/hooks/useScrollToElement';
import { useIconCategories } from '@/features/editor/hooks/useIconCategories';
import { useGraphicElements } from '@/features/editor/context/GraphicElementsContext';
import { loadImageSize } from '@/features/editor/lib/image-utils';
import { searchElements } from '@/features/editor/lib/elementSearch';
import type { GraphicElement } from '@/shared/types/elements';

/** 그래픽 요소 최대 크기 (px) */
const GRAPHIC_MAX_SIZE = 200;
/** 패널 첫 화면에서 묶음마다 보여 주는 개수 (나머지는 더보기) */
const PREVIEW_COUNT = 3;

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
  <img src={item.thumbnailUrl} alt={item.name} loading="lazy" className="size-full object-contain" />
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

type CatalogItem = ComponentItem & { keywords?: string };

interface CatalogCategory {
  id: string;
  title: string;
  items: CatalogItem[];
}

const toCatalogItem = ({ id, name, keywords, preview }: ShapeDefinition): CatalogItem => ({
  id,
  name,
  keywords,
  preview,
});

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
  const iconCategories = useIconCategories();
  const [query, setQuery] = useState('');

  /** 도형·선 → 아이콘 → 라벨·꾸밈·스티커 순서의 전체 목록 */
  const catalog: CatalogCategory[] = useMemo(() => {
    const shapeCategories = [...SHAPE_CATEGORIES, ...iconCategories].map((cat) => ({
      id: cat.id,
      title: cat.title,
      items: cat.items.map(toCatalogItem),
    }));
    const graphicCategories = groupInOrder(graphicElements, (g) => g.group).map(({ key, items }, index) => ({
      id: `graphics-${index}`,
      title: key,
      items: items.map((g) => ({ id: g.id, name: g.name, keywords: g.keywords, preview: renderGraphicPreview(g) })),
    }));
    return [...shapeCategories, ...graphicCategories];
  }, [iconCategories, graphicElements]);

  const shapeById = useMemo(
    () => new Map([...SHAPE_CATEGORIES, ...iconCategories].flatMap((cat) => cat.items.map((s) => [s.id, s] as const))),
    [iconCategories],
  );
  const graphicById = useMemo(() => new Map(graphicElements.map((g) => [g.id, g])), [graphicElements]);

  const categories: ComponentCategory[] = useMemo(
    () =>
      catalog.map((cat) => ({
        id: cat.id,
        title: cat.title,
        type: 'shape' as const,
        showMore: cat.items.length > PREVIEW_COUNT,
        items: cat.items.slice(0, PREVIEW_COUNT),
      })),
    [catalog],
  );

  const searchResults = useMemo(
    () => searchElements(catalog.flatMap((cat) => cat.items), query),
    [catalog, query],
  );

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
      const graphicElement = graphicById.get(item.id);
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

      // 도형/선/아이콘 요소 처리
      const shapeDefinition = shapeById.get(item.id);
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
      graphicById,
      shapeById,
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
      const category = catalog.find((cat) => cat.id === categoryId);
      if (!category) return;

      const moreItems: ProductImageItem[] = category.items.map((item) => ({
        id: item.id,
        name: item.name,
        category: categoryId,
        preview: item.preview,
      }));

      pushMoreView(
        TOGGLE_STATES.SHAPE_MORE,
        category.title,
        moreItems,
        (selectedItem) => handleItemClickRef.current({ id: selectedItem.id, name: selectedItem.name }),
        TOGGLE_STATES.SHAPE,
      );
    },
    [catalog, pushMoreView],
  );

  const isSearching = query.trim().length > 0;

  return (
    <ToolSectionLayout
      title="요소"
      body={
        <IconInputField
          wrapClassName="tool-search-input mb-8"
          placeholder="요소를 검색하세요. (예: 배송, 딸기, 할인)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="요소 검색"
        />
      }
    >
      {isSearching ? (
        <div className="w-full">
          <p className="description mb-4 text-gray-500">
            {searchResults.length > 0
              ? `검색 결과 ${searchResults.length}개`
              : '검색 결과가 없어요. 다른 낱말로 찾아보세요.'}
          </p>
          <ShapeItemGrid items={searchResults} onItemClick={handleItemClick} />
        </div>
      ) : (
        categories.map((category) => (
          <ToolControlGroup
            key={category.id}
            category={category}
            onItemClick={handleItemClick}
            onMoreClick={handleMoreClick}
          />
        ))
      )}
    </ToolSectionLayout>
  );
};

export default ShapeTool;
