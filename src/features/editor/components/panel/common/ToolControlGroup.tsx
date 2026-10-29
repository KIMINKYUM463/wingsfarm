// src/features/editor/components/Tool/common/ToolControlGroup.tsx

import Button from '@/shared/ui/Button/Button';
import React from 'react';
import MasonryGrid from '@/features/editor/components/shared/MasonryGrid';
import ShapeItemGrid from '@/features/editor/components/shared/ShapeItemGrid';
import ProductImageCard from '@/features/editor/components/shared/ProductImageCard';
import { ProductImageItem } from '@/features/editor/store/useToolPanelStore';
import { clsx } from 'clsx';

export interface ComponentItem {
  id: string;
  name: string | null;
  url?: string;
  previewUrl?: string;
  icon?: React.ReactNode;
  preview?: React.ReactNode;
  isSelected?: boolean;
  onClick?: () => void;
  /** 템플릿 구성 (BlockTool에서 사용) */
  part2?: string;
}

export interface ComponentCategory {
  id: string;
  title: string;
  type: 'block' | 'shape' | 'style';
  items: ComponentItem[];
  /** style 타입일 때 사용하는 ProductImageItem 배열 */
  styleItems?: ProductImageItem[];
  showMore?: boolean;
  onMoreClick?: () => void;
}

interface ToolControlGroupProps {
  category: ComponentCategory;
  onItemClick?: (item: ComponentItem) => void;
  /** style 타입일 때 사용하는 클릭 핸들러 */
  onStyleItemClick?: (item: ProductImageItem) => void;
  onMoreClick?: (categoryId: string) => void;
  className?: string;
  itemClassName?: string;
}

const ToolControlGroup: React.FC<ToolControlGroupProps> = ({
  category,
  onItemClick,
  onStyleItemClick,
  onMoreClick,
  className,
  itemClassName,
}) => {
  const handleItemClick = (item: ComponentItem) => {
    onItemClick?.(item);
    item.onClick?.();
  };

  const handleMoreClick = () => {
    onMoreClick?.(category.id);
    category.onMoreClick?.();
  };

  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-center justify-between mb-4">
        <p className="p-bold">{category.title}</p>
        {category.showMore && (
          <Button
            type="button"
            onClick={handleMoreClick}
            className="description text-gray-300 hover:text-gray-500"
          >
            더보기
          </Button>
        )}
      </div>

      {category.type === 'block' && (
        <MasonryGrid
          items={category.items}
          onItemClick={handleItemClick}
          isBlock
          itemClassName={itemClassName}
        />
      )}
      {category.type === 'shape' && (
        <ShapeItemGrid items={category.items} onItemClick={handleItemClick} />
      )}
      {category.type === 'style' && category.styleItems && (
        <div className="grid grid-cols-[repeat(3,6.25rem)] justify-between gap-y-2.75">
          {category.styleItems.map((item) => (
            <ProductImageCard
              key={item.id}
              item={item}
              onClick={onStyleItemClick}
              showAiBadge
              isSquare
              textClassName="text-center"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ToolControlGroup;
