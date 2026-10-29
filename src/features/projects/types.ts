/**
 * Projects 관련 타입 정의
 */

/**
 * 프로젝트 상태
 */
export type ProjectStatus = 'active' | 'deleted';

/**
 * 프로젝트 정렬 옵션 (UI용)
 */
export type ProjectSortOption = 'recent' | 'name';

/**
 * API sortBy 파라미터
 */
export type ProjectSortBy = 'createdAt' | 'title' | 'updatedAt';

/**
 * API sortOrder 파라미터
 */
export type ProjectSortOrder = 'asc' | 'desc';

/**
 * 프로젝트 아이템 (API 응답)
 */
export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  productName: string;
  categoryId: string;
  description: string;
  generationJobId: string;
  thumbnailUrl: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 프로젝트 목록 조회 API 응답
 */
export interface ProjectsApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: {
    projects: Project[];
    total: number;
    nextCursor?: string;
  };
  errors: null | unknown[];
  requestId: string;
}

/**
 * 프로젝트 목록 조회 파라미터
 */
export interface ProjectListParams {
  /** 한 번에 조회할 프로젝트 수 (1~50, 기본 20) */
  limit?: number;
  /** 다음 페이지 조회용 커서 */
  cursor?: string;
  /** 프로젝트 상태 필터 */
  status?: ProjectStatus;
  /** 정렬 기준 필드 (기본값: updatedAt) */
  sortBy?: ProjectSortBy;
  /** 정렬 방향 (기본값: desc) */
  sortOrder?: ProjectSortOrder;
  /** 검색 키워드 (제목 또는 상품명, 1-100자) */
  search?: string;
}

/**
 * 프로젝트 검색 파라미터 (클라이언트용)
 */
export interface ProjectSearchParams {
  query?: string;
  sort?: ProjectSortOption;
}

/**
 * 프로젝트 수정 요청 (부분 업데이트)
 */
export interface UpdateProjectRequest {
  /** 프로젝트 제목 (1-100자) */
  title?: string;
  /** 상품명 (최대 100자, null 허용) */
  productName?: string | null;
  /** 카테고리 ID (UUID, null 허용) */
  categoryId?: string | null;
  /** 프로젝트 설명 (최대 1000자, null 허용) */
  description?: string | null;
}

/**
 * 프로젝트 수정 API 응답
 */
export interface UpdateProjectResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: Project;
  errors: null | unknown[];
  requestId: string;
}
