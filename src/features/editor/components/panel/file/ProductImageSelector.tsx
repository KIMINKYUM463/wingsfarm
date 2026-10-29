'use client';

import React, { useMemo } from 'react';
import ToolSectionLayout from '@/features/editor/components/panel/common/ToolSectionLayout';
import ToolControlGroup, {
  ComponentCategory,
} from '@/features/editor/components/panel/common/ToolControlGroup';
import MasonryGrid from '@/features/editor/components/shared/MasonryGrid';
import ProductImageCard from '@/features/editor/components/shared/ProductImageCard';
import ShapeItemGrid from '@/features/editor/components/shared/ShapeItemGrid';
import {
  useCurrentMoreView,
  usePopMoreView,
  usePushMoreView,
  useClearMoreView,
  ProductImageItem,
} from '@/features/editor/store/useToolPanelStore';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import { getParentTool } from '@/shared/utils/toggleUtils';

/** 아이템을 groupName별로 그룹화 */
const groupItemsByGroupName = (items: ProductImageItem[]) => {
  const groups: { groupName: string; items: ProductImageItem[] }[] = [];
  const groupMap = new Map<string, ProductImageItem[]>();

  items.forEach((item) => {
    const key = item.groupName || '';
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(item);
  });

  // 순서 유지를 위해 원본 배열 순회
  const seenGroups = new Set<string>();
  items.forEach((item) => {
    const key = item.groupName || '';
    if (!seenGroups.has(key)) {
      seenGroups.add(key);
      groups.push({ groupName: key, items: groupMap.get(key)! });
    }
  });

  return groups;
};

const EMPTY_PRODUCT_IMAGE_ITEMS: ProductImageItem[] = [];

interface ProductImageSelectorProps {
  className?: string;
}

const ProductImageSelector: React.FC<ProductImageSelectorProps> = () => {
  const currentMoreView = useCurrentMoreView();
  const popMoreView = usePopMoreView();
  const pushMoreView = usePushMoreView();
  const clearMoreView = useClearMoreView();

  const type = currentMoreView?.type;
  const title = currentMoreView?.title;
  const items = currentMoreView?.items ?? EMPTY_PRODUCT_IMAGE_ITEMS;
  const onSelect = currentMoreView?.onSelect;
  const parentTool = type ? getParentTool(type) : null;

  // 아이템 클릭 핸들러
  const handleItemClick = (item: ProductImageItem) => {
    if (!onSelect) {
      return;
    }

    // 스타일 대분류 선택 시 → 해당 대분류의 스타일 목록으로 이동
    if (item.category === 'style_major' && item.data) {
      const majorData = item.data as {
        middles: {
          id: string;
          name: string;
          styles: {
            id: string;
            name: string;
            thumbnailUrl: string;
            sampleImageUrls: string[];
            price: number;
          }[];
        }[];
      };

      // middles의 styles를 flat하게 변환, groupName으로 중분류명 저장
      const styleItems: ProductImageItem[] = majorData.middles.flatMap((middle) =>
        middle.styles.map((style) => ({
          id: style.id,
          name: style.name,
          thumbnailUrl: style.thumbnailUrl,
          sampleImageUrls: style.sampleImageUrls,
          category: 'style_preset',
          price: style.price,
          parentName: item.name ?? undefined, // 대분류명
          groupName: middle.name, // 중분류명 (섹션 헤더용)
        })),
      );

      // 스타일이 1개뿐이면 바로 선택 완료
      if (styleItems.length === 1) {
        onSelect(styleItems[0]);
        clearMoreView();
        return;
      }

      pushMoreView(TOGGLE_STATES.IMAGE_STYLE_MORE, item.name ?? '', styleItems, (selectedStyle) => {
        onSelect(selectedStyle);
        clearMoreView();
      });
      return;
    }

    // 스타일 프리셋 선택 시 → 선택 완료
    if (item.category === 'style_preset') {
      onSelect(item);
      clearMoreView();
      return;
    }

    // IMAGE_STYLE_MORE 상태에서 다른 아이템들은 아무 동작 안 함
    if (parentTool === 'IMAGE') {
      return;
    }

    // TEMPLATE: 다이얼로그가 있으므로 onSelect만 호출 (clearMoreView는 onSelect 콜백에서 처리)
    if (parentTool === 'TEMPLATE') {
      onSelect(item);
      return;
    }

    // SHAPE 등 다른 화면에서는 선택 후 모두 닫기
    onSelect(item);
    clearMoreView();
  };

  // 스타일 프리셋 여부 확인 (groupName이 있는 style_preset 아이템들)
  const isStylePreset = items.length > 0 && items[0].category === 'style_preset';
  const groupedItems = useMemo(
    () => (isStylePreset ? groupItemsByGroupName(items) : []),
    [items, isStylePreset],
  );

  // 스타일 프리셋을 ToolControlGroup용 카테고리로 변환
  const styleCategories: ComponentCategory[] = useMemo(
    () =>
      groupedItems.map((group) => ({
        id: group.groupName,
        title: group.groupName,
        type: 'style' as const,
        items: [], // style 타입은 styleItems 사용
        styleItems: group.items,
        showMore: false, // 더보기 버튼 없음
      })),
    [groupedItems],
  );

  // 타입별 렌더러
  const contentByParentTool: Record<string, () => React.ReactNode> = {
    TEMPLATE: () => <MasonryGrid items={items} onItemClick={handleItemClick} isBlock />,

    IMAGE: () => {
      // 스타일 프리셋: 3열 그리드 (더보기 없음)
      if (isStylePreset && styleCategories.length > 0) {
        return (
          <div className="space-y-6">
            {styleCategories.map((category) => (
              <ToolControlGroup
                key={category.id}
                category={category}
                onStyleItemClick={handleItemClick}
              />
            ))}
          </div>
        );
      }
      // 대분류: 2열 그리드
      return (
        <div className="grid grid-cols-2 gap-3.5">
          {items.map((item) => (
            <ProductImageCard
              key={item.id}
              item={item}
              onClick={handleItemClick}
              showAiBadge
              textClassName="text-center text-(--color-gray-900)"
            />
          ))}
        </div>
      );
    },

    SHAPE: () => <ShapeItemGrid items={items} onItemClick={handleItemClick} />,
  };

  const renderContent = () => (parentTool ? contentByParentTool[parentTool]?.() : null);

  // 각 도구별 제목 표시
  // - TEMPLATE: part2 이름 (예: '전체', '문제 제기')
  // - SHAPE: 카테고리 이름 (예: '도형', '선')
  // - IMAGE: 스타일 이름 또는 기본값
  const displayTitle = title || '더보기';

  if (!currentMoreView) {
    return null;
  }

  return (
    <ToolSectionLayout title={displayTitle} onBack={popMoreView}>
      {renderContent()}
    </ToolSectionLayout>
  );
};

export default ProductImageSelector;
