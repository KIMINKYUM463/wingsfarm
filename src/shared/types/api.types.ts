/**
 * API 관련 전역 타입 정의
 *
 * 프로젝트 전체에서 사용되는 API 공통 타입들을 정의합니다.
 */

/**
 * API 응답 공통 구조
 */
export interface ApiResponse<T = any> {
  /** 응답 데이터 */
  data: T;
  /** 성공 여부 */
  success: boolean;
  /** 메시지 */
  message?: string;
  /** 타임스탬프 */
  timestamp?: string;
}

/**
 * API 에러 응답
 */
export interface ApiError {
  /** 에러 코드 */
  code: string;
  /** 에러 메시지 */
  message: string;
  /** HTTP 상태 코드 */
  status: number;
  /** 에러 상세 정보 */
  details?: Record<string, any>;
  /** 타임스탬프 */
  timestamp?: string;
}

/**
 * 페이지네이션 요청 파라미터
 */
export interface PaginationParams {
  /** 페이지 번호 (1부터 시작) */
  page?: number;
  /** 페이지 크기 */
  pageSize?: number;
  /** 정렬 기준 필드 */
  sortBy?: string;
  /** 정렬 순서 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 페이지네이션 응답 메타데이터
 */
export interface PaginationMeta {
  /** 현재 페이지 */
  currentPage: number;
  /** 페이지 크기 */
  pageSize: number;
  /** 전체 아이템 수 */
  totalItems: number;
  /** 전체 페이지 수 */
  totalPages: number;
  /** 다음 페이지 존재 여부 */
  hasNext: boolean;
  /** 이전 페이지 존재 여부 */
  hasPrevious: boolean;
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedResponse<T> {
  /** 데이터 목록 */
  items: T[];
  /** 페이지네이션 메타데이터 */
  meta: PaginationMeta;
}

/**
 * HTTP 메서드
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * API 요청 옵션
 */
export interface ApiRequestOptions {
  /** HTTP 메서드 */
  method?: HttpMethod;
  /** 요청 헤더 */
  headers?: Record<string, string>;
  /** 요청 바디 */
  body?: any;
  /** 타임아웃 (ms) */
  timeout?: number;
  /** 재시도 횟수 */
  retries?: number;
}

/**
 * 필터 옵션
 */
export interface FilterOptions {
  /** 검색 키워드 */
  search?: string;
  /** 필터 조건 */
  filters?: Record<string, any>;
  /** 날짜 범위 */
  dateRange?: {
    from?: string;
    to?: string;
  };
}
