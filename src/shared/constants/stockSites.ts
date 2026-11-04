import type { StockSource } from '@/shared/types/heroMotion';

/** 영상 출처 — 검색 결과·완성된 컷·내 첨부 영상에 표시 */
export const STOCK_SITES: Record<StockSource, { label: string; url: string }> = {
  pexels: { label: 'Pexels', url: 'https://www.pexels.com' },
  pixabay: { label: 'Pixabay', url: 'https://pixabay.com' },
  upload: { label: '내 영상', url: '#' },
};
