/**
 * 카테고리 API 서비스 (서버 전용)
 */

import 'server-only';
import { successEnvelope } from '@/server/lever/http';
import { toCategoryList } from '@/server/lever/catalog/categories';
import type { CategoryListResponse } from '@/shared/types/category';

/**
 * 카테고리 전체 목록 조회
 * 상품 등록 폼에서 사용할 모든 카테고리를 한 번에 가져옴
 */
export async function getCategories(): Promise<CategoryListResponse> {
  return successEnvelope(toCategoryList()) as unknown as CategoryListResponse;
}
