// API 응답 공통 구조
export interface ApiResponse<T> {
  isSuccess: boolean;
  code: string;
  message: string;
  data: T;
  errors: string[] | null;
  requestId: string;
}

// 카테고리
export interface Category {
  id: string;
  name: string;
  order: number;
}

// 카테고리 목록 응답
export interface CategoryListResponse {
  categories: Category[];
}

// 템플릿 목록 아이템
export interface TemplateListItem {
  id: string;
  figmaId?: string;
  name: string;
  part1: string;
  part2: string;
  part2SortKey?: number;
  status?: string;
  thumbnailUrl: string | null;
  imageCount?: number;
  excludedCategoryIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

// 템플릿 목록 응답
export interface TemplateListResponse {
  templates: TemplateListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  filters?: {
    part2Options: string[];
  };
}

// 템플릿 카테고리 수정 요청
export interface UpdateTemplateCategoriesRequest {
  excludedCategoryIds: string[];
}

// 템플릿 카테고리 수정 응답
export interface UpdateTemplateCategoriesResponse {
  templateId: string;
  excludedCategoryIds: string[];
  updatedAt: string;
}
