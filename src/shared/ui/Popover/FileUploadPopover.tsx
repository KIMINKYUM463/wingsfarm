'use client';

import { useMemo } from 'react';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';

export default function FileUploadPopover() {
  const frames = useCanvasDataStore((state) => state.frames);
  const productName = useCanvasDataStore((state) => state.productName);

  // 캔버스 크기 계산 (프레임 기반)
  const canvasSize = useMemo(() => {
    if (frames.length === 0) {
      return '0px × 0px';
    }

    const width = frames[0].width ?? 0;
    const totalHeight = frames.reduce((sum, frame) => sum + (frame.height ?? 0), 0);

    return `${Math.round(width).toLocaleString()}px × ${Math.round(totalHeight).toLocaleString()}px`;
  }, [frames]);

  return (
    <div className="p-4">
      <h2 className="title-1-bold mb-1">{productName || '제목 없음'}</h2>
      <p className="p text-gray-400 whitespace-nowrap">{canvasSize}</p>
    </div>
  );
}
