/**
 * 그래픽 요소 API 서비스 (서버 전용)
 */

import 'server-only';
import { listGraphicElements } from '@/server/lever/catalog/graphics';
import type { GraphicElement } from '@/shared/types/elements';

export interface GetElementsParams {
  limit?: number;
}

/**
 * 그래픽 요소 목록 조회
 *
 * 에디터 ShapeTool에서 사용하는 그래픽 요소
 */
export async function getGraphicElements(params?: GetElementsParams): Promise<GraphicElement[]> {
  return listGraphicElements(params?.limit);
}
