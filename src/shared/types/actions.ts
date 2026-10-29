// ===== Server Actions Types =====

import type { KonvaFrameElement, FailedNode } from '@/shared/types/konva';

/**
 * Server Action 입력 타입
 */
export interface CreatePageFromFigmaInput {
  figmaFileId?: string; // 환경변수에서 가져올 수 있도록 선택적으로 변경
  targetLayerName?: string; // 환경변수에서 가져올 수 있도록 선택적으로 변경
}

/**
 * Server Action 출력 타입
 */
export interface CreatePageFromFigmaOutput {
  id: string;
  frames: KonvaFrameElement[];
  createdAt: string;
  conversionStats: {
    totalNodes: number;
    convertedNodes: number;
    skippedNodes: number;
    processingTime: number;
  };
  failedNodes: FailedNode[];
  warnings: string[];
}

/**
 * 외부 API 호출을 위한 입력 타입
 */
export interface CreatePageFromFigmaApiInput {
  figmaFileId?: string;
  targetLayerName?: string;
}

/**
 * 외부 API 응답 타입
 */
export interface ExternalApiResponse<T> {
  isSuccess: boolean;
  code: string;
  message: string;
  errors: string | null;
  requestId: string;
  data: T;
}

/**
 * 외부 API 데이터 타입
 */
export interface ExternalApiData {
  frames: KonvaFrameElement[];
  conversionStats: {
    totalNodes: number;
    convertedNodes: number;
    skippedNodes: number;
    processingTime: number;
  };
  failedNodes: FailedNode[];
  warnings: string[];
}
