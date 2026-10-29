import Konva from 'konva';

// Transformer 조절점 상수
export const TRANSFORMER_ANCHORS = {
  CORNER_ONLY: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as string[],
  TEXT: [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
    'middle-left',
    'middle-right',
  ] as string[],
  ALL: [
    'top-left',
    'top-center',
    'top-right',
    'middle-right',
    'bottom-right',
    'bottom-center',
    'bottom-left',
    'middle-left',
  ] as string[],
};

type ElementRefs = React.MutableRefObject<Map<string, Konva.Node>>;

/** 선택된 단일 요소 가져오기 (다중 선택이거나 없으면 null) */
const getSingleSelectedElement = (
  selectedIds: string[],
  elementRefs: ElementRefs,
): Konva.Node | null => {
  if (selectedIds.length !== 1) return null;
  return elementRefs.current.get(selectedIds[0]) ?? null;
};

/** Group이 단일 텍스트 wrapper인지 확인 (KonvaText는 Group > Text 구조) */
const isSingleTextWrapper = (group: Konva.Group): boolean => {
  return !!group.findOne('Text');
};

/** 그래픽 요소(name에 _graphic이 포함된 Rect)인지 확인 */
const isGraphicElement = (node: Konva.Node): boolean => {
  return node.getClassName() === 'Rect' && (node.name() || '').includes('_graphic');
};

/** 논리적 컨테이너(data-group 또는 data-frame) 여부 확인 */
const isLogicalContainer = (node: Konva.Node): boolean => {
  return node.getClassName() === 'Group' && (node.hasName('data-group') || node.hasName('data-frame'));
};

/** Transformer 조절점 계산 */
export const getEnabledAnchors = (
  selectedIds: string[],
  elementRefs: ElementRefs,
): string[] => {
  const element = getSingleSelectedElement(selectedIds, elementRefs);

  // 다중 선택 또는 요소 없음 → 꼭지점만
  if (!element) return TRANSFORMER_ANCHORS.CORNER_ONLY;

  // 논리적 컨테이너(data-group 또는 data-frame) → 꼭지점만
  if (isLogicalContainer(element)) return TRANSFORMER_ANCHORS.CORNER_ONLY;

  const nodeType = element.getClassName();

  // 단일 텍스트 wrapper → TEXT 앵커
  if (nodeType === 'Group' && isSingleTextWrapper(element as Konva.Group)) {
    return TRANSFORMER_ANCHORS.TEXT;
  }

  // 그래픽 요소(fillPatternImage가 있는 Rect) → 꼭지점만 (비율 유지)
  if (isGraphicElement(element)) {
    return TRANSFORMER_ANCHORS.CORNER_ONLY;
  }

  switch (nodeType) {
    case 'Text':
      return TRANSFORMER_ANCHORS.TEXT;
    // Rect, Ellipse: 자유 리사이즈 (직사각형/타원 변형 자연스러움)
    case 'Rect':
    case 'Ellipse':
      return TRANSFORMER_ANCHORS.ALL;
    // Image, Circle, Star, RegularPolygon: 비율 유지 (정형화된 도형/이미지 왜곡 방지)
    case 'Image':
    case 'Circle':
    case 'Star':
    case 'RegularPolygon':
    // Line, Arrow: 중앙 앵커가 의미 없음
    case 'Line':
    case 'Arrow':
      return TRANSFORMER_ANCHORS.CORNER_ONLY;
    default:
      return TRANSFORMER_ANCHORS.ALL;
  }
};

/** keepRatio 계산 */
export const getKeepRatio = (
  selectedIds: string[],
  elementRefs: ElementRefs,
): boolean => {
  const element = getSingleSelectedElement(selectedIds, elementRefs);

  // 다중 선택 또는 요소 없음 → 비율 유지
  if (!element) return true;

  // 논리적 컨테이너(data-group 또는 data-frame) → 비율 유지
  if (isLogicalContainer(element)) return true;

  // 그래픽 요소(fillPatternImage가 있는 Rect) → 비율 유지
  if (isGraphicElement(element)) return true;

  const nodeType = element.getClassName();

  // 단일 텍스트 wrapper → 비율 유지 안 함
  if (nodeType === 'Group' && isSingleTextWrapper(element as Konva.Group)) {
    return false;
  }

  // Text, Rect, Ellipse: 자유 리사이즈 (비율 유지 안 함)
  // - Text: 폭 변경 시 텍스트 reflow
  // - Rect/Ellipse: 직사각형/타원 변형 자연스러움
  const freeResizeTypes = ['Text', 'Rect', 'Ellipse'];
  return !freeResizeTypes.includes(nodeType);
};

const MIN_SIZE = 20;
const MIN_LINE_SIZE = 5;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** Transformer boundBox 함수 */
export const createBoundBoxFunc = (isLineType = false) => (oldBox: Box, newBox: Box) => {
  // Line/Arrow는 한쪽 dimension이 0일 수 있음 (수평선/수직선)
  if (isLineType) {
    const maxDimension = Math.max(Math.abs(newBox.width), Math.abs(newBox.height));
    if (maxDimension < MIN_LINE_SIZE) return oldBox;
    return newBox;
  }

  if (Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE) {
    return oldBox;
  }
  return newBox;
};
