import { ApiResponse } from './api.types';

/**
 * 그래픽 요소 (서버에서 제공)
 */
export interface GraphicElement {
  id: string;
  name: string;
  thumbnailUrl: string;
  imageUrl: string;
  /** 요소 패널의 묶음 이름 (예: '라벨·뱃지', '스티커 · 과일') */
  group: string;
  /** 검색어 (공백으로 구분) */
  keywords?: string;
}

/**
 * 그래픽 요소 목록 API 응답
 */
export interface GraphicElementsResponse extends ApiResponse<{ elements: GraphicElement[] }> {}
