// ===== Shared Common Types =====

/**
 * 미들웨어 응답 타입 (모든 도메인에서 공통 사용)
 *
 * Server Actions에서 안전한 직렬화를 위해 결과 객체를 반환합니다.
 */
export interface MiddlewareResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number; // 에러 시 HTTP 상태 코드 (401, 403, 500 등)
}

/**
 * Server Action 직렬화 가능 에러
 *
 * Server Action에서 throw된 CustomError는 클라이언트로 전송 시 직렬화되어
 * instanceof 체크와 커스텀 프로퍼티(status, rawMessage)가 손실됩니다.
 *
 * 이 타입은 에러 정보를 plain object로 유지하여 직렬화 후에도 보존됩니다.
 */
export interface SerializableError {
  __isSerializableError: true;
  status: number;
  message: string;
  rawMessage?: string;
}

/**
 * 에러 타입 (공통)
 */
export interface ActionError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * 기본 변환 통계 타입 (공통)
 */
export interface BaseConversionStats {
  totalNodes: number;
  convertedNodes: number;
  skippedNodes: number;
  processingTime: number;
}

/**
 * 실패한 노드 정보 (공통)
 */
export interface FailedNode {
  id: string;
  name: string;
  type: string;
  path: string;
  reason: string;
  properties: unknown;
}

/**
 * 기본 처리 결과 타입 (공통)
 */
export interface BaseProcessingResult<T = unknown> {
  success: boolean;
  error?: string;
  data: T | null;
  stats: BaseConversionStats;
  failedNodes: FailedNode[];
  warnings: string[];
}
