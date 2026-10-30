import type { ElementAnimation } from '../animation';

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
  fill?: string;
  fillLinearGradientStartPoint?: {
    x: number;
    y: number;
  };
  fillLinearGradientEndPoint?: {
    x: number;
    y: number;
  };
  fillLinearGradientColorStops?: (number | string)[];
  fillRadialGradientStartPoint?: {
    x: number;
    y: number;
  };
  fillRadialGradientEndPoint?: {
    x: number;
    y: number;
  };
  fillRadialGradientStartRadius?: number;
  fillRadialGradientEndRadius?: number;
  fillRadialGradientColorStops?: (number | string)[];
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
  /** 회전 기준점 X (Figma 중심점 회전 → Konva 변환용) */
  offsetX?: number;
  /** 회전 기준점 Y (Figma 중심점 회전 → Konva 변환용) */
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
  fill?: string;
  fillPriority?: 'color' | 'linear-gradient' | 'radial-gradient';
  fillLinearGradientStartPoint?: {
    x: number;
    y: number;
  };
  fillLinearGradientEndPoint?: {
    x: number;
    y: number;
  };
  fillLinearGradientColorStops?: (number | string)[];
  fillRadialGradientStartPoint?: {
    x: number;
    y: number;
  };
  fillRadialGradientEndPoint?: {
    x: number;
    y: number;
  };
  fillRadialGradientStartRadius?: number;
  fillRadialGradientEndRadius?: number;
  fillRadialGradientColorStops?: (number | string)[];
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number | number[];
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  shadowEnabled?: boolean;
  /** 움직임 (없으면 정지) */
  animation?: ElementAnimation;
  /** 부모 프레임의 DB UUID - 프론트엔드 초기화 시 주입 */
  rootId: string;
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
  backgroundColor?: string;
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through';
}
/**
 * 사진 칸 표시 설정 — 원본 사진은 그대로 두고 그릴 때만 반영 (사진 편집 패널)
 */
export interface KonvaImageAdjust {
  /** cover = 칸을 꽉 채움(넘치는 부분 잘림), contain = 사진 전체가 보이게 맞춤 */
  imageFit?: 'cover' | 'contain';
  /** 확대 배율 (1 = 맞춤 기준) */
  imageZoom?: number;
  /** 사진이 칸보다 클 때 보이는 위치 (0 = 왼쪽/위, 0.5 = 가운데, 1 = 오른쪽/아래) */
  imageFocusX?: number;
  imageFocusY?: number;
  imageFlipX?: boolean;
  imageFlipY?: boolean;
  imageGrayscale?: boolean;
}
/**
 * 사각형 요소
 */
export interface KonvaRectElement extends KonvaElementBase, KonvaImageAdjust {
  type: 'rect';
  width: number;
  height: number;
  assetId?: string;
  /** Figma 이미지 참조 - public-resources/template-images/{figmaImageRef} */
  figmaImageRef?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}
/**
 * 경로 요소 (벡터)
 */
export interface KonvaPathElement extends KonvaElementBase, KonvaImageAdjust {
  type: 'path';
  data: string;
  fillRule?: string;
  assetId?: string;
  /** Figma 이미지 참조 - public-resources/template-images/{figmaImageRef} */
  figmaImageRef?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}
/**
 * 그룹 요소
 */
export interface KonvaGroupElement extends KonvaElementBase {
  type: 'group';
  children: KonvaElement[];
}

/**
 * 원 요소
 */
export interface KonvaCircleElement extends KonvaElementBase {
  type: 'circle';
  radius: number;
}

/**
 * 타원 요소
 */
export interface KonvaEllipseElement extends KonvaElementBase {
  type: 'ellipse';
  radiusX: number;
  radiusY: number;
}

/**
 * 별 요소
 */
export interface KonvaStarElement extends KonvaElementBase {
  type: 'star';
  numPoints: number;
  innerRadius: number;
  outerRadius: number;
}

/**
 * 정다각형 요소 (삼각형, 사각형, 오각형, 육각형 등)
 */
export interface KonvaRegularPolygonElement extends KonvaElementBase {
  type: 'regularPolygon';
  sides: number;
  radius: number;
}

/**
 * 선 요소
 */
export interface KonvaLineElement extends KonvaElementBase {
  type: 'line';
  points: number[];
  tension?: number;
  closed?: boolean;
  dash?: number[];
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  /** 클릭 감지용 두께 (strokeWidth보다 크게 설정하면 클릭이 쉬워짐) */
  hitStrokeWidth?: number;
}

/**
 * 화살표 요소
 */
export interface KonvaArrowElement extends KonvaElementBase {
  type: 'arrow';
  points: number[];
  pointerLength?: number;
  pointerWidth?: number;
  pointerAtBeginning?: boolean;
  pointerAtEnding?: boolean;
  tension?: number;
  dash?: number[];
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  /** 클릭 감지용 두께 (strokeWidth보다 크게 설정하면 클릭이 쉬워짐) */
  hitStrokeWidth?: number;
}
/**
 * 프레임 상태
 * - active: 활성화된 프레임 (캔버스에 렌더링됨)
 * - ghost: 비활성화된 part2의 순서 정보를 유지하는 플레이스홀더
 */
export type FrameStatus = 'active' | 'ghost';

/**
 * 프레임 요소 (Figma Frame에서 변환)
 *
 * ## 두 가지 사용처
 * 1. **최상위 Frame**: rootId 없음, status 필수
 * 2. **중첩 Frame**: rootId 필수, status 없음
 *
 * @note 최상위 Frame의 id가 DB UUID로 사용됨
 * @note 자식 요소(children)는 rootId로 최상위 프레임의 id를 참조
 */
export interface KonvaFrameElement extends Omit<KonvaElementBase, 'rootId'> {
  type: 'frame';
  /** 중첩 Frame의 경우 최상위 프레임 ID (최상위 Frame은 없음) */
  rootId?: string;
  /** 프레임 상태 - 최상위 Frame만 사용 (active: 렌더링됨, ghost: 플레이스홀더) */
  status?: FrameStatus;
  children: KonvaElement[];
  /** 프레임 정렬 순서 (Fractional Index) - 최상위 Frame만 사용 */
  frameOrder?: string;
  /** 프레임 구성 단계 (예: "문제 제기", "해결책 제시" 등) - 최상위 Frame만 사용 */
  part2?: string;
  /** 움직임 재생 길이(초) - 최상위 Frame만 사용, 없으면 기본값 */
  animationLength?: number;
  cornerRadius?: number | number[];
  layoutMode?: string;
  padding?: {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  };
  itemSpacing?: number;
  /** Clip 속성 - Figma clipsContent가 true일 때 설정 */
  clipX?: number;
  clipY?: number;
  clipWidth?: number;
  clipHeight?: number;
}

/**
 * 중첩 Frame 타입 (rootId 필수)
 *
 * @note KonvaFrame 컴포넌트(중첩 Frame 렌더링용)에서 사용
 * @note rootId로 최상위 프레임의 id 참조 (CRUD 작업 지원)
 */
export type KonvaNestedFrameElement = KonvaFrameElement & { rootId: string };

/**
 * 중첩 Frame 타입 가드
 */
export const isKonvaNestedFrameElement = (
  element: KonvaElement,
): element is KonvaNestedFrameElement => {
  return element.type === 'frame' && 'rootId' in element && !!element.rootId;
};
/**
 * Union Type: 모든 Konva 요소 타입
 * Discriminated Union으로 타입 안전성 확보
 */
export type KonvaElement =
  | KonvaTextElement
  | KonvaRectElement
  | KonvaPathElement
  | KonvaGroupElement
  | KonvaFrameElement
  | KonvaCircleElement
  | KonvaEllipseElement
  | KonvaStarElement
  | KonvaRegularPolygonElement
  | KonvaLineElement
  | KonvaArrowElement;
// Type guard functions
export const isKonvaTextElement = (element: KonvaElement): element is KonvaTextElement => {
  return element.type === 'text';
};
export const isKonvaRectElement = (element: KonvaElement): element is KonvaRectElement => {
  return element.type === 'rect';
};
export const isKonvaPathElement = (element: KonvaElement): element is KonvaPathElement => {
  return element.type === 'path';
};
export const isKonvaGroupElement = (element: KonvaElement): element is KonvaGroupElement => {
  return element.type === 'group';
};
export const isKonvaFrameElement = (element: KonvaElement): element is KonvaFrameElement => {
  return element.type === 'frame';
};
export const isKonvaCircleElement = (element: KonvaElement): element is KonvaCircleElement => {
  return element.type === 'circle';
};
export const isKonvaEllipseElement = (element: KonvaElement): element is KonvaEllipseElement => {
  return element.type === 'ellipse';
};
export const isKonvaStarElement = (element: KonvaElement): element is KonvaStarElement => {
  return element.type === 'star';
};
export const isKonvaRegularPolygonElement = (
  element: KonvaElement,
): element is KonvaRegularPolygonElement => {
  return element.type === 'regularPolygon';
};
export const isKonvaLineElement = (element: KonvaElement): element is KonvaLineElement => {
  return element.type === 'line';
};
export const isKonvaArrowElement = (element: KonvaElement): element is KonvaArrowElement => {
  return element.type === 'arrow';
};

/**
 * 선 요소 Union Type (선 편집 패널용)
 * - line, arrow
 */
export type KonvaLineTypeElement = KonvaLineElement | KonvaArrowElement;

/**
 * 선 요소인지 확인 (선 편집 패널용)
 */
export const isKonvaLineTypeElement = (element: KonvaElement): element is KonvaLineTypeElement => {
  return element.type === 'line' || element.type === 'arrow';
};

/**
 * 도형 요소 Union Type (도형 편집 패널용)
 * - rect (이미지가 아닌 순수 도형만)
 * - circle, ellipse, star, regularPolygon
 * - path (이미지가 아닌 순수 벡터만)
 * - line, arrow 제외 (별도 "선" 패널 사용)
 */
export type KonvaShapeElement =
  | KonvaRectElement
  | KonvaCircleElement
  | KonvaEllipseElement
  | KonvaStarElement
  | KonvaRegularPolygonElement
  | KonvaPathElement;

/**
 * 그래픽 요소인지 확인 (그래픽 편집 패널용)
 * - name === '_graphic' 인 rect 요소
 */
export const isKonvaGraphicElement = (element: KonvaElement): element is KonvaRectElement => {
  if (element.type !== 'rect') return false;
  return element.name === '_graphic';
};

/**
 * 도형 요소인지 확인 (도형 편집 패널용)
 * - line, arrow는 제외 (별도 "선" 패널 사용)
 * - rect: 그래픽/이미지가 아닌 순수 도형만
 * - path: assetId/figmaImageRef가 없는 순수 벡터만
 */
export const isKonvaShapeElement = (element: KonvaElement): element is KonvaShapeElement => {
  // line, arrow는 별도 패널
  if (element.type === 'line' || element.type === 'arrow') return false;

  const shapeTypes = ['circle', 'ellipse', 'star', 'regularPolygon'];
  if (shapeTypes.includes(element.type)) return true;

  // rect: 그래픽/이미지가 아닌 순수 도형
  if (element.type === 'rect') {
    const rect = element as KonvaRectElement;
    return !rect.assetId && !rect.figmaImageRef && rect.name !== '_graphic';
  }

  // path: 이미지가 아닌 순수 벡터만
  if (element.type === 'path') {
    const path = element as KonvaPathElement;
    return !path.assetId && !path.figmaImageRef;
  }

  return false;
};

/**
 * Group 또는 중첩 Frame인지 확인 (children을 가진 논리적 컨테이너)
 * - KonvaGroup: type === 'group'
 * - KonvaNestedFrame: type === 'frame' && rootId 있음
 */
export const isKonvaContainerElement = (
  element: KonvaElement,
): element is KonvaGroupElement | KonvaNestedFrameElement => {
  return isKonvaGroupElement(element) || isKonvaNestedFrameElement(element);
};

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
  originalData?: any;
  errors: Array<{
    type: string;
    message: string;
  }>;
  warnings: string[];
  stats: ConversionStats;
  failedNodes: FailedNode[];
}
//# sourceMappingURL=conversion.d.ts.map
