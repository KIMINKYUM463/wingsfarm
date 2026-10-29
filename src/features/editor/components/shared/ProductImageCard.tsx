'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import Icon from '@/shared/ui/Icon';
import { ProductImageItem } from '@/features/editor/store/useToolPanelStore';
import Badge from '@/shared/ui/Badge';
import { StyleSamplePreview } from '@/features/editor/components/panel/image/style';
import Button from '@/shared/ui/Button/Button';
import { useDelayedHover } from '@/shared/hooks/useDelayedHover';

interface ProductImageCardProps {
  item: ProductImageItem;
  onClick?: (item: ProductImageItem) => void;
  onItemAction?: (item: ProductImageItem) => void;
  /** AI 배지 표시 여부 */
  showAiBadge?: boolean;
  /** 정사각형(100x100) 이미지 사용 여부 */
  isSquare?: boolean;
  /** LCP 이미지 우선 로딩 (첫 화면 이미지에 사용) */
  priority?: boolean;
  textClassName?: string;
  className?: string;
}

const ProductImageCard: React.FC<ProductImageCardProps> = ({
  item,
  onClick,
  onItemAction,
  showAiBadge = false,
  isSquare = false,
  priority = false,
  textClassName,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 스타일 프리셋 + 샘플 이미지가 있을 때만 호버 프리뷰 활성화
  const hasSamplePreview =
    item.category === 'style_preset' && item.sampleImageUrls && item.sampleImageUrls.length > 0;

  const {
    isActive: showPreview,
    data: previewPosition,
    onMouseEnterWithRef,
    onMouseLeave,
  } = useDelayedHover<{ x: number; y: number }>({ enabled: hasSamplePreview });

  // 클릭 시 프리뷰 닫기 (다이얼로그 열릴 때 onMouseLeave 안 되는 문제 방지)
  const handleClick = () => {
    onMouseLeave();
    if (onClick) {
      onClick(item);
    }
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 부모 클릭 이벤트 방지
    if (onItemAction) {
      onItemAction(item);
    }
  };

  const handleMouseEnter = () => {
    if (hasSamplePreview) {
      onMouseEnterWithRef(containerRef);
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        className={clsx('group cursor-pointer', className)}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* 이미지 컨테이너 */}
        <div
          className={clsx(
            'relative w-full overflow-hidden rounded-lg border border-gray-100 transition-all duration-100',
            'group-hover:border-transparent group-hover:outline-2 group-hover:-outline-offset-2 group-hover:outline-(--color-point)',
            isSquare ? 'aspect-square' : 'aspect-154/206',
          )}
        >
          {item.thumbnailUrl && (
            <Image
              src={item.thumbnailUrl}
              alt={item.name ?? ''}
              fill
              unoptimized
              priority={priority}
              className="img-placeholder object-cover"
            />
          )}

          {/* AI 배지 */}
          {showAiBadge && <Badge type="ai" className="absolute top-1.5 left-1.5" />}

          {/* 더보기 액션 버튼 (모델샷 등) */}
          {onItemAction && (
            <Button
              onClick={handleActionClick}
              className="absolute right-2 bottom-2 rounded-lg bg-white/90 p-2 shadow-md transition-all duration-100 hover:bg-white"
              aria-label="더보기"
            >
              <Icon name="more_horiz" className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* 텍스트 라벨 */}
        <p
          className={clsx(
            'mt-2 transition-colors duration-100 group-hover:text-(--color-point)',
            textClassName,
          )}
        >
          {item.name ?? ''}
        </p>
      </div>

      {/* 스타일 프리셋 호버 시 샘플 이미지 프리뷰 */}
      {showPreview && previewPosition && item.sampleImageUrls && (
        <StyleSamplePreview
          position={previewPosition}
          styleName={item.name ?? ''}
          sampleImageUrls={item.sampleImageUrls}
        />
      )}
    </>
  );
};

export default ProductImageCard;
