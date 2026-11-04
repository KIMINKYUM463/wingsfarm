'use client';

import React, { useState } from 'react';
import Button from '@/shared/ui/Button/Button';
import Icon from '@/shared/ui/Icon';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Skeleton from '@/shared/ui/Skeleton/Skeleton';
import { DialogBase, CloseButton } from '@/shared/ui/Dialog/shared';
import { clsx } from 'clsx';

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

/** 개별 템플릿 썸네일 — 클릭은 적용, 돋보기는 큰 미리보기 팝업 */
const MasonryGridItem: React.FC<MasonryGridItemProps> = ({
  item,
  imageUrl,
  onItemClick,
  itemClassName,
}) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasPreview = !!item.previewUrl;

  return (
    <>
      <div className={clsx('group relative mb-3.5 w-full break-inside-avoid', itemClassName)}>
        <Button
          onClick={() => onItemClick(item)}
          className="hover-border-point w-full overflow-hidden rounded-lg"
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

        {/* 우측 상단 돋보기 — 누르면 큰 미리보기 팝업 (호버로 안 띄움: 떠있는 오류 방지) */}
        {hasPreview && (
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(true);
            }}
            className="absolute top-1.5 right-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-black/55 text-white shadow-sm transition-colors hover:bg-black/70"
            aria-label="템플릿 크게 보기"
          >
            <Icon name="search" width={16} />
          </Button>
        )}
      </div>

      {previewOpen && item.previewUrl && (
        <TemplatePreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          name={item.name ?? '템플릿 미리보기'}
          previewUrl={item.previewUrl}
        />
      )}
    </>
  );
};

interface TemplatePreviewModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  previewUrl: string;
}

/** 돋보기 클릭 시 템플릿을 크게 보여주는 팝업 (DialogBase는 전체 화면 flex — 안쪽 카드에 스타일) */
const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  open,
  onClose,
  name,
  previewUrl,
}) => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <DialogBase
      isOpen={open}
      onClose={onClose}
      closeOnBackdrop
      ariaLabelledBy="template-preview-title"
    >
      {/* dialog-base가 flex row라 헤더·이미지가 옆으로 붙지 않도록 카드 하나로 감싼다 */}
      <div
        className="relative flex max-h-[90vh] w-[min(520px,92vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-(--shadow-1)"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="template-preview-title" className="sr-only">
          {name || '템플릿 미리보기'}
        </p>
        {/* X는 카드 우측 상단 고정 (이미지 위에 겹침) */}
        <CloseButton
          onClick={onClose}
          className="rounded-full bg-white/90 text-gray-500 shadow-sm hover:bg-white hover:text-gray-800"
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex-center min-h-[70vh]">
              <Spinner className="text-(--color-point)" />
            </div>
          )}
          <img
            src={previewUrl}
            alt={name || '템플릿 미리보기'}
            className={clsx('block h-auto w-full', isLoading && 'hidden')}
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </div>
    </DialogBase>
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
