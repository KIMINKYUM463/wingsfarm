// ===== Konva 타입 정의 =====
// Konva.js 관련 타입 정의

// KonvaElementType은 실제로 사용되지 않음

/**
 * 통합 Fill 변환 결과
 *
 * @description Konva.js와 완전 호환되는 fill 속성들
 *
 * @example
 * // SOLID 채우기
 * { fill: 'rgba(255, 0, 0, 1)', fillPriority: 'color' }
 *
 * @example
 * // LINEAR 그라데이션
 * {
 *   fillLinearGradientStartPoint: { x: 0, y: 0 },
 *   fillLinearGradientEndPoint: { x: 100, y: 100 },
 *   fillLinearGradientColorStops: [0, 'rgba(255, 0, 0, 1)', 1, 'rgba(0, 0, 255, 1)'],
 *   fillPriority: 'linear-gradient'
 * }
 *
 * @example
 * // RADIAL 그라데이션
 * {
 *   fillRadialGradientStartPoint: { x: 50, y: 50 },
 *   fillRadialGradientEndPoint: { x: 100, y: 100 },
 *   fillRadialGradientStartRadius: 0,
 *   fillRadialGradientEndRadius: 50,
 *   fillRadialGradientColorStops: [0, 'rgba(255, 0, 0, 1)', 1, 'rgba(0, 0, 255, 1)'],
 *   fillPriority: 'radial-gradient'
 * }
 */
export interface KonvaFillConfig {
  // SOLID 채우기
  fill?: string;

  // LINEAR 그라데이션
  fillLinearGradientStartPoint?: { x: number; y: number };
  fillLinearGradientEndPoint?: { x: number; y: number };
  fillLinearGradientColorStops?: (number | string)[];

  // RADIAL 그라데이션
  fillRadialGradientStartPoint?: { x: number; y: number };
  fillRadialGradientEndPoint?: { x: number; y: number };
  fillRadialGradientStartRadius?: number;
  fillRadialGradientEndRadius?: number;
  fillRadialGradientColorStops?: (number | string)[];

  // Fill 우선순위 (Konva에서 그라데이션 렌더링을 위해 필수)
  fillPriority?: 'color' | 'linear-gradient' | 'radial-gradient';
}

export interface KonvaStrokeConfig {
  stroke?: string;
}

/**
 * 기본 Konva 요소 인터페이스
/**
 * Konva 레이어
 */
export interface KonvaLayer {
  id: string;
  name: string;
  type: 'layer';
  elements: KonvaElement[];
  backgroundColor?: string | null;
  width: number;
  height: number;
  visible: boolean;
}

/**
 * Konva 스테이지 (전체 캔버스)
 */
export interface KonvaStage {
  name: string;
  layers: KonvaLayer[];
  totalElements: number;
  layerCount: number;
  version: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 텍스트 요소
 */

/**
 * 모든 Konva 요소의 공통 속성
 */
export interface KonvaElementBase {
  type: string;
  id: string;
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  visible?: boolean;
  opacity?: number;
  rotation?: number;
  offsetX?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;

  // Konva 호환 fill 속성들
  fill?: string;
  fillPriority?: 'color' | 'linear-gradient' | 'radial-gradient';
  fillLinearGradientStartPoint?: { x: number; y: number };
  fillLinearGradientEndPoint?: { x: number; y: number };
  fillLinearGradientColorStops?: (number | string)[];
  fillRadialGradientStartPoint?: { x: number; y: number };
  fillRadialGradientEndPoint?: { x: number; y: number };
  fillRadialGradientStartRadius?: number;
  fillRadialGradientEndRadius?: number;
  fillRadialGradientColorStops?: (number | string)[];

  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number | number[];
}

export interface KonvaTextElement extends KonvaElementBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: 'normal' | 'italic' | 'bold' | 'bold italic';
  fontWeight: number;
  align: 'left' | 'center' | 'right' | 'justify';
  verticalAlign: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  wrap?: 'word' | 'char' | 'none';
  ellipsis?: boolean;
  padding?: number;
  width: number;
  height: number;
  backgroundColor?: string; // 텍스트 배경색 (Group 내 Rect의 fill)
}

/**
 * 사각형 요소
 */
export interface KonvaRectElement extends KonvaElementBase {
  type: 'rect';
  width: number;
  height: number;
  /** Figma 이미지 채우기 참조 (템플릿 이미지 파일명) */
  figmaImageRef?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * 타원 요소
 */
export interface KonvaEllipseElement extends KonvaElementBase {
  type: 'ellipse';
  radiusX: number;
  radiusY: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * 경로 요소 (벡터)
 */
export interface KonvaPathElement extends KonvaElementBase {
  type: 'path';
  data: string;
  fillRule?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * 선 요소 (Path로 대체)
 */
// export interface KonvaLineElement extends KonvaElementBase {
//   type: 'line';
//   points: number[];
//   stroke?: string;
//   strokeWidth?: number;
//   closed?: boolean;
//   cornerRadius?: number;
// }

/**
 * 이미지 요소
 */
export interface KonvaImageElement extends KonvaElementBase {
  type: 'image';
  imageUrl: string;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
}

/**
 * 그룹 요소
 */
export interface KonvaGroupElement extends KonvaElementBase {
  type: 'group';
  children: KonvaElement[];
}

/**
 * 프레임 요소 (Figma Frame에서 변환)
 */
export interface KonvaFrameElement extends KonvaElementBase {
  type: 'frame';
  children: KonvaElement[];
  cornerRadius?: number | number[]; // 모서리 둥글기
  layoutMode?: string; // 레이아웃 모드
  padding?: {
    // 내부 여백
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  };
  itemSpacing?: number; // 자식 요소 간격
  /** Figma clipsContent가 true일 때 자르기 영역 */
  clipX?: number;
  clipY?: number;
  clipWidth?: number;
  clipHeight?: number;
}

/**
 * Union Type: 모든 Konva 요소 타입
 * Discriminated Union으로 타입 안전성 확보
 */
export type KonvaElement =
  | KonvaTextElement
  | KonvaRectElement
  | KonvaEllipseElement
  | KonvaPathElement
  // | KonvaLineElement (Path로 대체)
  | KonvaImageElement
  | KonvaGroupElement
  | KonvaFrameElement;

// 타입 가드 함수들
export const isKonvaTextElement = (element: KonvaElement): element is KonvaTextElement => {
  return element.type === 'text';
};

export const isKonvaRectElement = (element: KonvaElement): element is KonvaRectElement => {
  return element.type === 'rect';
};

export const isKonvaImageElement = (element: KonvaElement): element is KonvaImageElement => {
  return element.type === 'image';
};

export const isKonvaEllipseElement = (element: KonvaElement): element is KonvaEllipseElement => {
  return element.type === 'ellipse';
};

export const isKonvaPathElement = (element: KonvaElement): element is KonvaPathElement => {
  return element.type === 'path';
};

// export const isKonvaLineElement = (element: KonvaElement): element is KonvaLineElement => {
//   return element.type === 'line';
// };

export const isKonvaGroupElement = (element: KonvaElement): element is KonvaGroupElement => {
  return element.type === 'group';
};

export const isKonvaFrameElement = (element: KonvaElement): element is KonvaFrameElement => {
  return element.type === 'frame';
};
