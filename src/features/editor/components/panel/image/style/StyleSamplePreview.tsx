'use client';

import { createPortal } from 'react-dom';
import Image from 'next/image';
import Badge from '@/shared/ui/Badge';

export interface StyleSamplePreviewPosition {
  x: number;
  y: number;
}

interface StyleSamplePreviewProps {
  /** 프리뷰 위치 */
  position: StyleSamplePreviewPosition;
  /** 스타일명 */
  styleName: string;
  /** 샘플 이미지 URL 목록 (최대 4개 표시) */
  sampleImageUrls: string[];
}

/**
 * 스타일 프리셋 호버 시 샘플 이미지 프리뷰
 *
 * Figma: ai-image-style-preset-hover
 * - 2초 호버 후 표시
 * - 2x2 그리드 (최대 4개)
 * - 각 이미지 100x100, AI 배지
 */
const StyleSamplePreview = ({ position, styleName, sampleImageUrls }: StyleSamplePreviewProps) => {
  // 최대 4개만 표시
  const displayImages = sampleImageUrls.slice(0, 4);

  if (displayImages.length === 0) return null;

  return createPortal(
    <div
      className="fixed z-9999 rounded-xl bg-white p-4 shadow-(--shadow-1)"
      style={{ left: position.x + 8, top: position.y }}
    >
      {/* 스타일명 */}
      <p className="p-bold mb-4">{styleName}</p>

      {/* 2x2 그리드 */}
      <div className="grid grid-cols-[repeat(2,6.25rem)] gap-2">
        {displayImages.map((url, index) => (
          <div key={index} className="relative size-25 overflow-hidden rounded-md">
            <Image
              src={url}
              alt={`${styleName} 샘플 ${index + 1}`}
              fill
              unoptimized
              className="img-placeholder object-cover"
            />
            <Badge type="ai" className="absolute top-1.25 left-1.25" />
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
};

export default StyleSamplePreview;
