/**
 * 판매처별 다운로드 옵션 (다운로드 팝오버 ↔ useImageDownload)
 */
export type DownloadFormat = 'jpg' | 'png' | 'webp' | 'html';
export type DownloadBundle = 'single' | 'zip';
export type DownloadQuality = 'saver' | 'standard' | 'original';

export interface DownloadOptions {
  format: DownloadFormat;
  /** 내보낼 가로 폭 (px) — 캔버스 폭(860) 대비 배율로 렌더링 */
  width: number;
  quality: DownloadQuality;
  /** 내보낼 페이지 (0부터) */
  pageIndexes: number[];
  /** HTML은 항상 ZIP */
  bundle: DownloadBundle;
}

/** 에디터 캔버스 기본 폭 */
export const CANVAS_WIDTH = 860;

export const PLATFORMS = [
  { id: 'smartstore', label: '네이버 스마트스토어', note: 'G마켓·옥션 호환', width: 860 },
  { id: 'coupang', label: '쿠팡', note: '가로 780px 권장', width: 780 },
  { id: 'toss', label: '토스쇼핑', note: '올웨이즈·당근 호환', width: 1080 },
  { id: 'custom', label: '자사몰', note: '너비 지정 · 상세 HTML', width: null },
] as const;
export type PlatformId = (typeof PLATFORMS)[number]['id'];

export const WIDTH_RANGE: [number, number] = [320, 2000];

export const FORMATS: { id: DownloadFormat; label: string; description: string }[] = [
  { id: 'jpg', label: 'JPG', description: '대부분의 쇼핑몰에 맞는 기본 형식' },
  { id: 'png', label: 'PNG', description: '글자가 가장 선명한 무손실 이미지' },
  { id: 'webp', label: 'WEBP', description: '같은 화질에 더 작은 용량' },
  { id: 'html', label: 'HTML', description: '자사몰용 상세 HTML + 이미지 (ZIP)' },
];

export const QUALITIES: { id: DownloadQuality; label: string; value: number; bytesPerPixel: number }[] = [
  { id: 'saver', label: '용량 절약', value: 0.7, bytesPerPixel: 0.16 },
  { id: 'standard', label: '표준', value: 0.85, bytesPerPixel: 0.28 },
  { id: 'original', label: '원본', value: 0.95, bytesPerPixel: 0.5 },
];

/** PNG는 무손실이라 품질 대신 고정 추정치 */
const PNG_BYTES_PER_PIXEL = 1.1;

export const qualityValue = (quality: DownloadQuality) => QUALITIES.find((q) => q.id === quality)!.value;

/**
 * "1-3, 5" → [0, 1, 2, 4] (중복 제거·정렬). 형식이 틀리거나 범위를 벗어나면 null
 */
export function parsePageRange(input: string, total: number): number[] | null {
  const pages = new Set<number>();
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  for (const part of parts) {
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) return null;
    const from = Number(match[1]);
    const to = Number(match[2] ?? match[1]);
    if (from < 1 || to > total || from > to) return null;
    for (let page = from; page <= to; page++) pages.add(page - 1);
  }
  return [...pages].sort((a, b) => a - b);
}

/** 예상 용량 (byte) — 픽셀 수 × 형식·품질별 평균 압축률 */
export function estimateBytes(format: DownloadFormat, quality: DownloadQuality, width: number, heights: number[], canvasWidth: number) {
  const scale = width / canvasWidth;
  const pixels = heights.reduce((sum, h) => sum + width * h * scale, 0);
  const perPixel = format === 'png' ? PNG_BYTES_PER_PIXEL : QUALITIES.find((q) => q.id === quality)!.bytesPerPixel;
  return pixels * perPixel;
}

export const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
