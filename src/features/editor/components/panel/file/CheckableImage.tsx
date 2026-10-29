'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { clsx } from 'clsx';
import Checkbox from '@/shared/ui/Checkbox';
import { FileInfoTooltip } from '@/shared/ui/Tooltip';
import Badge from '@/shared/ui/Badge';

export interface CheckableImageProps {
  id: string;
  /** 패널 표시용 URL (thumbnailUrl) */
  src: string;
  /** 캔버스 추가용 URL (signedUrl) */
  originalSrc?: string;
  selected?: boolean;
  onToggle?: (id: string, nextSelected: boolean) => void;
  /** 이미지 클릭 시 호출 (체크박스 영역 제외) */
  onImageClick?: (id: string, src: string) => void;
  /** AI 생성 이미지 여부 */
  isAiImage?: boolean;
  /** 파일명 (호버 시 표시) */
  fileName?: string;
  /** 업로드 날짜 (호버 시 표시) */
  createdAt?: string;
  /** 파일 크기 (bytes) */
  fileSizeBytes?: number;
  /** 이미지 너비 (px) - 툴팁용 */
  width?: number;
  /** 이미지 높이 (px) - 툴팁용 */
  height?: number;
  /** 체크박스 표시 여부 (기본: true) */
  showCheckbox?: boolean;
  /** 이미지 표시 크기 (px, 기본: 100) */
  size?: number;
  /** 하나라도 선택된 상태인지 (true면 전체 이미지 클릭 가능, false면 체크박스만 클릭 가능) */
  hasAnySelection?: boolean;
}

const CheckableImage: React.FC<CheckableImageProps> = ({
  id,
  src,
  originalSrc,
  selected = false,
  onToggle,
  onImageClick,
  isAiImage,
  fileName,
  createdAt,
  fileSizeBytes,
  width,
  height,
  showCheckbox = true,
  size = 100,
  hasAnySelection = false,
}) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 언마운트 시 tooltip timeout cleanup
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // 단일 선택 모드: 체크박스 없이 전체가 버튼
  const isSingleMode = !showCheckbox;

  const handleToggle = () => {
    onToggle?.(id, !selected);
  };

  // 이미지 클릭 핸들러 (체크박스 영역 제외)
  // - 선택된 항목 있으면: 선택 토글
  // - 선택된 항목 없으면: 프레임에 이미지 추가
  const handleImageClick = () => {
    if (hasAnySelection) {
      handleToggle();
      return;
    }
    onImageClick?.(id, src);
  };

  // 이미지 클릭 가능 여부
  const isImageClickable = hasAnySelection || !!onImageClick;

  const handleMouseEnter = () => {
    if (!containerRef.current || !fileName) return;
    const rect = containerRef.current.getBoundingClientRect();

    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltip({ x: rect.right, y: rect.top });
    }, 1000);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setTooltip(null);
  };

  // 드래그 시작 핸들러 (캔버스로 이미지 드롭용)
  const handleDragStart = (e: React.DragEvent) => {
    // 원본 URL 우선 사용 (썸네일이 아닌 고화질 이미지)
    e.dataTransfer.setData('application/json', JSON.stringify({ assetId: id, imageUrl: originalSrc ?? src }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const imageElement = (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      unoptimized
      className={clsx(
        'img-placeholder h-full w-full overflow-hidden rounded-lg object-cover',
        'border border-gray-100 transition-all duration-100',
        'group-hover:border-transparent group-hover:outline-2 group-hover:-outline-offset-2 group-hover:outline-(--color-point)',
        selected && 'border-transparent outline-3 -outline-offset-3 outline-(--color-point)',
      )}
    />
  );

  const badgeElement = isAiImage && (
    <Badge
      type="ai"
      className={clsx(
        'absolute top-1.5 left-1.5 z-10 transition-opacity duration-200',
        selected ? 'opacity-0' : 'opacity-100 group-hover:opacity-0',
      )}
    />
  );

  // 단일 선택 모드: button으로 감싸서 키보드 접근성 확보
  if (isSingleMode) {
    return (
      <>
        <button
          ref={containerRef as React.RefObject<HTMLButtonElement>}
          type="button"
          draggable
          onClick={handleToggle}
          onDragStart={handleDragStart}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="group relative aspect-square cursor-pointer img-placeholder rounded-lg"
        >
          {badgeElement}
          {imageElement}
        </button>

        {tooltip && fileName && (
          <FileInfoTooltip
            position={tooltip}
            fileName={fileName}
            width={width}
            height={height}
            fileSizeBytes={fileSizeBytes}
            createdAt={createdAt}
          />
        )}
      </>
    );
  }

  // 다중 선택 모드: 체크박스 + 이미지 (hasAnySelection일 때만 이미지 클릭 가능)
  return (
    <>
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        draggable
        onDragStart={handleDragStart}
        className="group relative aspect-square img-placeholder rounded-lg"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Checkbox
          id={id}
          checked={selected}
          onChange={(e) => onToggle?.(id, (e.target as HTMLInputElement).checked)}
          labelClassName="absolute top-1.5 right-1.5 z-10"
          className={clsx(
            'transition-opacity duration-200',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        />

        {badgeElement}

        {isImageClickable ? (
          <button type="button" onClick={handleImageClick} className="absolute inset-0 cursor-pointer">
            <Image
              src={src}
              alt=""
              width={size}
              height={size}
              unoptimized
              className={clsx(
                'img-placeholder h-full w-full overflow-hidden rounded-lg object-cover',
                'border border-gray-100 transition-all duration-100',
                'group-hover:border-transparent group-hover:outline-2 group-hover:-outline-offset-2 group-hover:outline-(--color-point)',
                selected && 'border-transparent outline-3 -outline-offset-3 outline-(--color-point)',
              )}
            />
          </button>
        ) : (
          <Image
            src={src}
            alt=""
            width={size}
            height={size}
            unoptimized
            className={clsx(
              'img-placeholder h-full w-full overflow-hidden rounded-lg object-cover',
              'border border-gray-100 transition-all duration-100',
              'group-hover:border-transparent group-hover:outline-2 group-hover:-outline-offset-2 group-hover:outline-(--color-point)',
              selected && 'border-transparent outline-3 -outline-offset-3 outline-(--color-point)',
            )}
          />
        )}
      </div>

      {/* 호버 시 파일 정보 툴팁 */}
      {tooltip && fileName && (
        <FileInfoTooltip
          position={tooltip}
          fileName={fileName}
          width={width}
          height={height}
          fileSizeBytes={fileSizeBytes}
          createdAt={createdAt}
        />
      )}
    </>
  );
};

export default CheckableImage;
