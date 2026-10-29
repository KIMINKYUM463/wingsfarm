'use client';

import React from 'react';
import { Group, Rect, Path } from 'react-konva';

interface ImagePlaceholderProps {
  x: number;
  y: number;
  /** 아이콘 크기 (기본값: 28) */
  size?: number;
}

/**
 * 이미지 로딩 중 표시되는 플레이스홀더 아이콘
 * 원본 SVG: 107x107 viewBox (피그마 Frame 1097)
 * size prop으로 원하는 크기 지정, 패딩 없이 정확한 크기로 렌더링
 */
const ImagePlaceholder = React.memo<ImagePlaceholderProps>(({ x, y, size = 28 }) => {
  // 원본 viewBox 크기
  const VIEWBOX = 107;
  // 스케일 계산
  const scale = size / VIEWBOX;

  return (
    <Group x={x} y={y} scaleX={scale} scaleY={scale} listening={false}>
      {/* 외곽 테두리 (stroke rect) */}
      <Rect
        x={3.65441}
        y={3.65441}
        width={99.1489}
        height={99.1489}
        cornerRadius={15.5594}
        stroke="#6B7280"
        strokeWidth={7.30836}
      />

      {/* 원 아이콘 (태양) */}
      <Path
        data="M29.6009 33.085C34.2043 33.085 37.9361 29.3532 37.9361 24.7498C37.9361 20.1464 34.2043 16.4146 29.6009 16.4146C24.9974 16.4146 21.2656 20.1464 21.2656 24.7498C21.2656 29.3532 24.9974 33.085 29.6009 33.085Z"
        fill="#6B7280"
      />

      {/* 산 아이콘 (이미지 심볼) */}
      <Path
        data="M73.7252 46.7919L54.5177 65.9995C51.0631 69.454 45.4616 69.454 42.007 65.9995L33.419 57.4114C29.9645 53.9569 24.3629 53.9569 20.9084 57.4114L7.30859 71.0143L7.30859 99.15H99.1491V59.7082L86.2359 46.795C82.7813 43.3405 77.1798 43.3405 73.7252 46.795V46.7919Z"
        fill="#6B7280"
      />
    </Group>
  );
});

ImagePlaceholder.displayName = 'ImagePlaceholder';

export default ImagePlaceholder;
