import type { StockSource } from '@/shared/types/heroMotion';

/** 무료 영상 사이트 — 검색 결과와 완성된 컷에 출처로 보여준다 (두 사이트 모두 출처 표시를 요청) */
export const STOCK_SITES: Record<StockSource, { label: string; url: string }> = {
  pexels: { label: 'Pexels', url: 'https://www.pexels.com' },
  pixabay: { label: 'Pixabay', url: 'https://pixabay.com' },
};
