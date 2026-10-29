import { useMemo } from 'react';
import type { KonvaImageAdjust } from '@/shared/types/konva';

export const IMAGE_ZOOM_MAX = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface ImagePatternParams extends KonvaImageAdjust {
  image: HTMLImageElement | undefined;
  width?: number;
  height?: number;
}

/** 흑백 사본 (CORS 때문에 픽셀을 못 읽으면 원본 그대로) */
const toGrayscale = (image: HTMLImageElement): HTMLImageElement | HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;
  ctx.drawImage(image, 0, 0);
  try {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      px[i] = px[i + 1] = px[i + 2] = gray;
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
  } catch {
    return image;
  }
};

/**
 * 사진 칸 채우기 패턴 (Konva fillPattern* 속성)
 * - 맞춤: cover(꽉 채움) / contain(전체 보이기) → 확대 배율 → 위치(focus)로 남는 부분 배치
 * - 반전: 배율을 음수로 두고 시작점을 사진 너비만큼 옮긴다
 */
export const useImagePattern = ({
  image,
  width,
  height,
  imageFit = 'cover',
  imageZoom = 1,
  imageFocusX = 0.5,
  imageFocusY = 0.5,
  imageFlipX = false,
  imageFlipY = false,
  imageGrayscale = false,
}: ImagePatternParams) => {
  const source = useMemo(() => (image && imageGrayscale ? toGrayscale(image) : image), [image, imageGrayscale]);

  return useMemo(() => {
    if (!image || !source || !width || !height) return null;

    const fit = imageFit === 'contain' ? Math.min : Math.max;
    const scale = fit(width / image.width, height / image.height) * clamp(imageZoom, 1, IMAGE_ZOOM_MAX);
    const drawnWidth = image.width * scale;
    const drawnHeight = image.height * scale;
    const x = (width - drawnWidth) * clamp(imageFocusX, 0, 1);
    const y = (height - drawnHeight) * clamp(imageFocusY, 0, 1);

    return {
      // Konva 타입은 HTMLImageElement만 받지만 실제로는 canvas도 패턴으로 그린다
      fillPatternImage: source as HTMLImageElement,
      fillPatternRepeat: 'no-repeat' as const,
      fillPatternScaleX: imageFlipX ? -scale : scale,
      fillPatternScaleY: imageFlipY ? -scale : scale,
      fillPatternX: imageFlipX ? x + drawnWidth : x,
      fillPatternY: imageFlipY ? y + drawnHeight : y,
    };
  }, [image, source, width, height, imageFit, imageZoom, imageFocusX, imageFocusY, imageFlipX, imageFlipY]);
};
