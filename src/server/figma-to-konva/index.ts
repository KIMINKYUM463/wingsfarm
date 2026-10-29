/**
 * Figma to Konva 변환 시스템
 *
 * Figma API 응답을 Konva.js 템플릿으로 변환하는 시스템입니다.
 *
 * @example
 * ```typescript
 * import { convertFigmaToKonva } from './figma-to-konva';
 *
 * const result = convertFigmaToKonva(figmaResponse);
 * if (result.success) {
 *   console.log('변환된 Konva 템플릿:', result.data);
 * }
 * ```
 */

import { Converter } from './converters';
import { StyleMapper } from './mappers/StyleMapper';

export { Converter } from './converters';
export { StyleMapper } from './mappers/StyleMapper';

// 인터페이스들 export
export type { ShapeConverter, ContainerConverter } from './converters';

// Shape 변환기들 export
export {
  TextConverter,
  RectangleConverter,
  EllipseConverter,
  VectorConverter,
  ImageConverter,
} from './converters';

// Container 변환기들 export
export { CanvasConverter, FrameConverter, GroupConverter } from './converters';

// 타입 가드 함수들 export
export * from './types/konva';

// 타입들 export (외부용 - 모든 Konva 타입)
export type * from './types/index';

/**
 * Figma API 응답을 Konva 템플릿으로 변환하는 메인 함수
 *
 * @param figmaResponse - Figma API에서 받은 파일 응답
 * @returns 변환 결과 (성공/실패, 데이터, 통계 등)
 *
 * @example
 * ```typescript
 * const figmaResponse = await figma.getFile({ fileKey: 'your-file-key' });
 * const result = convertFigmaToKonva(figmaResponse);
 *
 * if (result.success) {
 *   // 변환 성공
 *   const konvaStage = result.data;
 *   console.log(`변환된 요소: ${result.stats.convertedNodes}개`);
 * } else {
 *   // 변환 실패
 *   console.error('변환 실패:', result.error);
 * }
 * ```
 */
export function convertFigmaToKonva(figmaResponse: any) {
  const converter = new Converter();
  return converter.convert(figmaResponse);
}

/**
 * 변환기 인스턴스를 생성하는 팩토리 함수
 *
 * @returns 새로운 Converter 인스턴스
 *
 * @example
 * ```typescript
 * const converter = createConverter();
 * const result = converter.convert(figmaResponse);
 * ```
 */
export function createConverter() {
  return new Converter();
}

/**
 * 변환 통계를 포맷팅하는 유틸리티 함수
 *
 * @param stats - 변환 통계
 * @returns 포맷팅된 통계 문자열
 */
export function formatConversionStats(stats: any): string {
  if (!stats) return '통계 정보 없음';

  return `총 ${stats.totalNodes}개 노드 중 ${stats.convertedNodes}개 변환됨 (${stats.skippedNodes}개 건너뜀) - ${stats.processingTime}ms 소요`;
}
