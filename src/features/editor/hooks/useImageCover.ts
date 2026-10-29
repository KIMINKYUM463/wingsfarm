import { useMemo } from 'react';

interface ImageCoverParams {
  imageUrl?: string;
  image: HTMLImageElement | undefined;
  width?: number;
  height?: number;
}

interface CoverScale {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * object-fit: cover 스타일 계산 훅
 * 이미지를 요소 크기에 맞춰 비율을 유지하면서 꽉 채우고 중앙 정렬
 */
export const useImageCover = ({
  imageUrl,
  image,
  width,
  height,
}: ImageCoverParams): CoverScale | null => {
  return useMemo(() => {
    if (!imageUrl || !image || !width || !height) {
      return null;
    }

    const scaleX = width / image.width;
    const scaleY = height / image.height;
    // cover: 둘 중 큰 스케일 사용 (요소를 완전히 채움)
    const scale = Math.max(scaleX, scaleY);

    // 스케일링된 이미지 크기
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;

    // 중앙 정렬을 위한 offset 계산
    // fillPatternOffset은 패턴의 시작 위치를 지정하므로
    // 이미지가 요소보다 크면 음수 offset으로 중앙 정렬
    const offsetX = (width - scaledWidth) / 2;
    const offsetY = (height - scaledHeight) / 2;

    return {
      scale,
      offsetX,
      offsetY,
    };
  }, [imageUrl, image, width, height]);
};
