/**
 * 클라이언트 사이드 이미지 합성 유틸리티
 *
 * 서버 액션 대신 브라우저 Canvas API를 사용하여 이미지를 합성합니다.
 * Vercel 4.5MB payload 제한을 우회합니다.
 */

import { CustomError } from '@/shared/lib/CustomError';

// ===== Types =====

interface CombineImagesRequest {
  images: string[]; // base64 data URL 배열
  format: 'png' | 'jpg';
  quality?: number; // 0-1 (jpg only)
}

interface CombineImagesResponse {
  dataUrls: string[];
  width: number;
  height: number;
  splitCount: number;
  /** 분할 원인 브라우저 */
  splitBrowser: BrowserType;
}

interface LoadedImage {
  img: HTMLImageElement;
  width: number;
  height: number;
}

// ===== Constants =====

/** JPEG 포맷 최대 높이 제한 (스펙상 65535, 안전 마진 확보) */
const JPEG_MAX_HEIGHT = 60000;

/**
 * 브라우저별 Canvas API 제한
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#maximum_canvas_size
 */
const CANVAS_LIMITS = {
  chrome: { maxPixels: 268_000_000, maxDimension: 32000 }, // 268M pixels, 32767px
  firefox: { maxPixels: 124_000_000, maxDimension: 32000 }, // 124M pixels, 32767px
  safari: { maxPixels: 16_500_000, maxDimension: 16384 }, // 16.7M pixels, 16384px
} as const;

type BrowserType = keyof typeof CANVAS_LIMITS;

// ===== Browser Detection =====

/** 브라우저 타입 감지 */
export const detectBrowser = (): BrowserType => {
  if (typeof navigator === 'undefined') return 'chrome';
  const ua = navigator.userAgent.toLowerCase();

  if (/safari/.test(ua) && !/chrome/.test(ua) && !/chromium/.test(ua)) {
    return 'safari';
  }
  if (/firefox/.test(ua)) {
    return 'firefox';
  }
  return 'chrome';
};

// ===== Image Loading =====

/** base64 data URL을 HTMLImageElement로 변환 */
const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new CustomError(500, '이미지 로드에 실패했습니다.'));
    img.src = src;
  });

/** 여러 이미지를 로드하여 LoadedImage 배열로 변환 */
const loadAllImages = async (sources: string[]): Promise<LoadedImage[]> => {
  const results: LoadedImage[] = [];
  for (const src of sources) {
    const img = await loadImage(src);
    results.push({ img, width: img.naturalWidth, height: img.naturalHeight });
  }
  return results;
};

// ===== Canvas Operations =====

/** 이미지 그룹을 Canvas에서 합성 */
const createCombinedCanvas = (
  images: LoadedImage[],
  totalWidth: number,
  totalHeight: number,
  format: 'png' | 'jpg',
  quality: number,
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new CustomError(500, 'Canvas context를 생성할 수 없습니다.');
  }

  // JPG는 흰색 배경 필요 (PNG 투명 영역 처리)
  if (format === 'jpg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, totalWidth, totalHeight);
  }

  // 이미지를 세로로 합성 (가운데 정렬)
  let currentY = 0;
  for (const { img, width, height } of images) {
    ctx.drawImage(img, Math.floor((totalWidth - width) / 2), currentY);
    currentY += height;
  }

  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const dataUrl = canvas.toDataURL(mimeType, format === 'jpg' ? quality : undefined);

  // 캔버스 크기 초과 시 빈 데이터 반환 체크
  if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 100) {
    throw new CustomError(500, '이미지 합성에 실패했습니다. 브라우저 메모리가 부족할 수 있습니다.');
  }

  return dataUrl;
};

// ===== Height Calculation =====

/** 브라우저/포맷별 최대 높이 계산 */
const calculateMaxHeight = (totalWidth: number, format: 'png' | 'jpg', browser: BrowserType): number => {
  const { maxPixels, maxDimension } = CANVAS_LIMITS[browser];

  if (format === 'jpg') {
    // JPG: Safari만 캔버스 제한, 나머지는 JPEG 스펙 제한만
    return browser === 'safari' ? Math.min(JPEG_MAX_HEIGHT, maxDimension) : JPEG_MAX_HEIGHT;
  }

  // PNG: 픽셀 수와 최대 차원 중 작은 값
  return Math.min(Math.floor(maxPixels / totalWidth), maxDimension);
};

// ===== Image Grouping =====

/** 이미지를 maxHeight 기준으로 그룹 분할 */
const splitIntoGroups = (images: LoadedImage[], maxHeight: number): LoadedImage[][] => {
  const groups: LoadedImage[][] = [];
  let currentGroup: LoadedImage[] = [];
  let currentHeight = 0;

  for (const img of images) {
    if (currentHeight + img.height > maxHeight && currentGroup.length > 0) {
      groups.push(currentGroup);
      currentGroup = [];
      currentHeight = 0;
    }
    currentGroup.push(img);
    currentHeight += img.height;
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
};

// ===== Main Function =====

/**
 * 여러 이미지를 세로로 합쳐서 하나의 이미지로 생성
 *
 * JPEG 높이 제한(65535px) 또는 캔버스 크기 제한 초과 시 자동 분할
 */
export const combineImagesClient = async (request: CombineImagesRequest): Promise<CombineImagesResponse> => {
  const { images, format, quality = 0.92 } = request;

  if (!images.length) {
    throw new CustomError(400, '다운로드할 이미지가 없습니다.');
  }

  const loadedImages = await loadAllImages(images);
  const totalWidth = Math.max(...loadedImages.map((d) => d.width));
  const totalHeight = loadedImages.reduce((sum, d) => sum + d.height, 0);
  const browser = detectBrowser();
  const maxHeight = calculateMaxHeight(totalWidth, format, browser);

  // 단일 프레임이 maxHeight 초과하는 엣지 케이스 경고
  const oversizedFrame = loadedImages.find((d) => d.height > maxHeight);
  if (oversizedFrame) {
    console.warn(`[combineImagesClient] 단일 프레임(${oversizedFrame.height}px)이 최대 높이(${maxHeight}px) 초과`);
  }

  // 분할 불필요 - 단일 이미지로 시도
  if (totalHeight <= maxHeight) {
    try {
      const dataUrl = createCombinedCanvas(loadedImages, totalWidth, totalHeight, format, quality);
      return { dataUrls: [dataUrl], width: totalWidth, height: totalHeight, splitCount: 1, splitBrowser: browser };
    } catch {
      // 실패 시 분할로 fallback (브라우저 제한이 예상보다 낮을 수 있음)
      console.warn('[combineImagesClient] 단일 이미지 생성 실패, 분할 시도');
    }
  }

  // 분할 - 이미지 경계에서 그룹화
  const groups = splitIntoGroups(loadedImages, maxHeight);
  const dataUrls = groups.map((group) => {
    const groupWidth = Math.max(...group.map((d) => d.width));
    const groupHeight = group.reduce((sum, d) => sum + d.height, 0);
    return createCombinedCanvas(group, groupWidth, groupHeight, format, quality);
  });

  return { dataUrls, width: totalWidth, height: totalHeight, splitCount: dataUrls.length, splitBrowser: browser };
};
