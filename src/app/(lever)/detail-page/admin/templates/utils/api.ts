import type {
  ApiResponse,
  TemplateListResponse,
  CategoryListResponse,
  UpdateTemplateCategoriesResponse,
} from './types';

const BASE_URL = '/api/lever/functions/v1';

const request = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !data?.isSuccess) {
    throw new Error(data?.message || `API 호출 실패: ${response.status} ${response.statusText}`);
  }
  return data.data;
};

// 카테고리 목록 조회
export const getCategories = () => request<CategoryListResponse>('/template-admin/categories');

// 템플릿 목록 조회
export const getTemplates = (params?: { part2?: string; page?: number; pageSize?: number }) => {
  const searchParams = new URLSearchParams();
  if (params?.part2) searchParams.set('part2', params.part2);
  if (params?.page !== undefined) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
  const query = searchParams.toString();
  return request<TemplateListResponse>(`/template-admin/templates${query ? `?${query}` : ''}`);
};

// 템플릿 카테고리 수정
export const updateTemplateCategories = (templateId: string, excludedCategoryIds: string[]) =>
  request<UpdateTemplateCategoriesResponse>(`/template-admin/templates/${templateId}/categories`, {
    method: 'PATCH',
    body: JSON.stringify({ excludedCategoryIds }),
  });

// ===== Figma 템플릿 동기화 =====

export interface FigmaStatus {
  hasToken: boolean;
  fileKey: string;
}

export interface SyncFigmaRequest {
  /** Figma 개인 액세스 토큰 (비우면 저장된 값 사용) */
  token?: string;
  /** Figma 파일 키 또는 파일 URL (비우면 저장된 값 사용) */
  fileKey?: string;
  /** true면 기본 템플릿을 숨기고 Figma 템플릿만 사용 */
  hideBuiltin?: boolean;
}

export interface SyncFigmaResponse {
  message: string;
  syncedCount?: number;
  errors?: string[];
}

export const getFigmaStatus = () => request<FigmaStatus>('/template-admin/figma');

export const syncFigmaTemplates = (body: SyncFigmaRequest) =>
  request<SyncFigmaResponse>('/template-admin/sync-figma', {
    method: 'POST',
    body: JSON.stringify(body),
  });
