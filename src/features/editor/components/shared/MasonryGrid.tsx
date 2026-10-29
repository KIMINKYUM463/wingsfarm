'use client';

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/shared/ui/Button/Button';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Skeleton from '@/shared/ui/Skeleton/Skeleton';
import { clsx } from 'clsx';
import { useDelayedHover } from '@/shared/hooks/useDelayedHover';

// Placeholder image URLs for fallback
const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=500&fit=crop',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400&h=550&fit=crop',
  'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=400&h=450&fit=crop',
];

export interface MasonryItem {
  id: string;
  name: string | null;
  thumbnailUrl?: string | null;
  url?: string;
  previewUrl?: string;
  category?: string;
  preview?: React.ReactNode;
  isSelected?: boolean;
}

interface MasonryGridProps {
  items: MasonryItem[];
  onItemClick: (item: MasonryItem) => void;
  isBlock?: boolean;
  itemClassName?: string;
  className?: string;
}

interface MasonryGridItemProps {
  item: MasonryItem;
  imageUrl: string;
  onItemClick: (item: MasonryItem) => void;
  itemClassName?: string;
}

/** 개별 아이템 컴포넌트 (호버 프리뷰 지원) */
const MasonryGridItem: React.FC<MasonryGridItemProps> = ({
  item,
  imageUrl,
  onItemClick,
  itemClassName,
}) => {
  const containerRef = useRef<HTMLButtonElement>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const hasPreview = !!item.previewUrl;

  const {
    isActive: showPreview,
    data: previewPosition,
    onMouseEnterWithRef,
    onMouseLeave,
  } = useDelayedHover<{ x: number; y: number }>({ enabled: hasPreview });

  const handleMouseEnter = () => {
    if (hasPreview) {
      onMouseEnterWithRef(containerRef);
    }
  };

  // 클릭 시 프리뷰 닫기 (다이얼로그 열릴 때 onMouseLeave 안 되는 문제 방지)
  const handleClick = () => {
    onMouseLeave();
    onItemClick(item);
  };

  return (
    <>
      <Button
        ref={containerRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={onMouseLeave}
        className={clsx(
          'hover-border-point overflow-hidden rounded-lg',
          itemClassName,
          'w-full',
          'mb-3.5',
          'break-inside-avoid',
        )}
      >
        {imageUrl ? (
          <>
            {!isImageLoaded && <Skeleton className="aspect-3/4 w-full" bg="gray-100" />}
            <img
              src={imageUrl}
              alt={item.name ?? ''}
              className={clsx('h-auto w-full', !isImageLoaded && 'hidden')}
              onLoad={() => setIsImageLoaded(true)}
            />
          </>
        ) : (
          item.preview || <div className="h-6 w-6 bg-gray-300" />
        )}
      </Button>

      {/* 1초 호버 후 미리보기 */}
      {showPreview && previewPosition && item.previewUrl && (
        <TemplatePreview position={previewPosition} name={item.name ?? ''} previewUrl={item.previewUrl} />
      )}
    </>
  );
};

interface TemplatePreviewProps {
  position: { x: number; y: number };
  name: string;
  previewUrl: string;
}

// 템플릿 프리뷰 상수
const PREVIEW_WIDTH = 250; // w-62.5 = 250px
const TEMPLATE_ASPECT_RATIO = 860 / 1080; // 템플릿 기본 비율 (width / height)
const PREVIEW_HEIGHT = Math.round(PREVIEW_WIDTH / TEMPLATE_ASPECT_RATIO); // ≈ 314px

/** 템플릿 미리보기 (1초 호버 후 표시) */
const TemplatePreview: React.FC<TemplatePreviewProps> = ({ position, name, previewUrl }) => {
  const [isLoading, setIsLoading] = useState(true);

  return createPortal(
    <div
      className="fixed z-9999 overflow-hidden rounded-xl bg-white shadow-(--shadow-1)"
      style={{ left: position.x, top: position.y, width: PREVIEW_WIDTH, minHeight: PREVIEW_HEIGHT }}
    >
      {isLoading && (
        <div className="flex-center" style={{ height: PREVIEW_HEIGHT }}>
          <Spinner className="text-(--color-point)" />
        </div>
      )}
      <img
        src={previewUrl}
        alt={name}
        className={clsx('h-auto w-full', isLoading && 'hidden')}
        onLoad={() => setIsLoading(false)}
      />
    </div>,
    document.body,
  );
};

/**
 * Masonry Grid Layout Component
 *
 * CSS column-count (Tailwind: 'columns-*')를 사용하여
 * 높이가 다른 아이템을 빈 공간 없이 채우는 메이슨리(Masonry) 레이아웃을 구현합니다.
 * Pinterest 스타일의 그리드 레이아웃에 적합합니다.
 */
const MasonryGrid: React.FC<MasonryGridProps> = ({
  items,
  onItemClick,
  isBlock = false,
  itemClassName = '',
  className = '',
}) => {
  return (
    <div className={clsx('gap-3.5', isBlock ? 'columns-2' : 'columns-3', className)}>
      {items.map((item, index) => {
        // URL이 없는 경우 플레이스홀더 이미지 사용
        const imageUrl =
          item.thumbnailUrl || item.url || PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length];

        return (
          <MasonryGridItem
            key={item.id}
            item={item}
            imageUrl={imageUrl}
            onItemClick={onItemClick}
            itemClassName={itemClassName}
          />
        );
      })}
    </div>
  );
};

export default MasonryGrid;
