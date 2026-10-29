import { ApiResponse } from './api.types';

/**
 * 그래픽 요소 (서버에서 제공)
 */
export interface GraphicElement {
  id: string;
  name: string;
  thumbnailUrl: string;
  imageUrl: string;
}

/**
 * 그래픽 요소 목록 API 응답
 */
export interface GraphicElementsResponse extends ApiResponse<{ elements: GraphicElement[] }> {}
