// ===== 타입 진입점 =====
// 모든 타입을 re-export하는 통합 진입점 (모듈 내부용)

// Figma 관련 타입들 - 모든 타입 re-export
export * from '@figma/rest-api-spec';

// Konva 관련 타입들
export * from './konva';

// 변환 결과 관련 타입들
export * from './conversion';

// 특별한 타입 조합들
import type { KonvaStage } from './konva';
import type { ConversionResult } from './conversion';

/**
 * Figma to Konva 변환 결과 타입
 */
export type FigmaToKonvaResult = ConversionResult<KonvaStage>;
