// ===== 변환 결과 타입 정의 =====
// Figma to Konva 변환 시스템의 결과 관련 타입들

// BoundingBox는 @figma/rest-api-spec의 Rectangle 타입을 사용

// LayoutConstraint는 @figma/rest-api-spec에서 가져옴

// 레이아웃 관련 타입들은 @figma/rest-api-spec에서 가져옴

// BlendMode는 @figma/rest-api-spec에서 가져옴

/**
 * 실패한 노드 정보
 */
export interface FailedNode {
  id: string;
  name: string;
  type: string;
  path: string;
  reason: string;
  properties: any;
}

/**
 * 변환 결과 통계
 */
export interface ConversionStats {
  totalNodes: number;
  convertedNodes: number;
  skippedNodes: number;
  processingTime: number;
}

/**
 * 변환 결과 타입
 */
export interface ConversionResult<T = any> {
  success: boolean;
  error?: string;
  data: T | null;
  originalData?: any; // Figma 원본 JSON 데이터
  errors: Array<{ type: string; message: string }>;
  warnings: string[];
  stats: ConversionStats;
  failedNodes: FailedNode[];
}
