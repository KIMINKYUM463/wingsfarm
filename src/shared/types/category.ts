/**
 * 카테고리 및 키워드 API 응답 타입
 */

/**
 * API 공통 응답 래퍼
 */
export interface ApiResponse<T> {
  isSuccess: boolean;
  code: string;
  message: string;
  errors: string[] | null;
  requestId: string;
  data: T;
}

/**
 * 키워드 정보
 */
export interface Keyword {
  id: string;
  name: string;
  description: string;
  priority: number;
}

/**
 * 키워드 그룹
 */
export interface KeywordGroup {
  id: string;
  name: string;
  description: string;
  keywords: Keyword[];
}

/**
 * 카테고리 정보
 */
export interface Category {
  id: string;
  name: string;
  path: string;
  level: number;
  hasChildren: boolean;
  keywordGroups: KeywordGroup[];
  totalKeywordGroups: number;
  totalKeywords: number;
}

/**
 * 카테고리 목록 응답 데이터
 */
export interface CategoryListData {
  language: string;
  categories: Category[];
  totalCategories: number;
  totalKeywordGroups: number;
  totalKeywords: number;
}

/**
 * 카테고리 목록 API 응답
 */
export type CategoryListResponse = ApiResponse<CategoryListData>;

/**
 * 카테고리 쿼리 파라미터
 */
export interface CategoryQueryParams {
  language?: string;
  level?: number;
  parentId?: string;
  includeKeywords?: boolean;
}

/**
 * AI 키워드 생성 요청 파라미터 (선택 사항)
 */
export interface GenerateKeywordsRequest {
  forceRefresh?: boolean;
}

/**
 * AI 생성 키워드 그룹 (간소화된 구조)
 */
export interface GeneratedKeywordGroup {
  name: string;
  keywords: string[];
}

/**
 * AI 키워드 생성 응답 데이터
 */
export interface GenerateKeywordsData {
  groups: GeneratedKeywordGroup[];
}

/**
 * AI 키워드 생성 API 응답
 */
export type GenerateKeywordsResponse = ApiResponse<GenerateKeywordsData>;
