import { createShapeDefinitions } from './utils';
import { ShapeDefinitionInput } from './types';

// 도형 채우기 색상
const SHAPE_FILL_COLOR = '#2B2B2E';

/**
 * 기본 도형 데이터 (프리뷰는 ShapePreview로 자동 생성)
 * 순서: 앞 12개는 Figma 디자인 기준, 그 뒤는 상세페이지에 자주 쓰는 도형
 */
const BASIC_SHAPE_INPUTS: ShapeDefinitionInput[] = [
  // Row 1
  {
    id: 'rect',
    name: '사각형',
    category: 'shape',
    defaultProps: {
      type: 'rect',
      name: '사각형',
      width: 100,
      height: 100,
      fill: SHAPE_FILL_COLOR,
    },
  },
  {
    id: 'triangle',
    name: '삼각형',
    category: 'shape',
    defaultProps: {
      type: 'regularPolygon',
      name: '삼각형',
      sides: 3,
      radius: 50,
      fill: SHAPE_FILL_COLOR,
    },
  },
  {
    id: 'circle',
    name: '원',
    category: 'shape',
    defaultProps: {
      type: 'circle',
      name: '원',
      radius: 50,
      fill: SHAPE_FILL_COLOR,
    },
  },
  // Row 2
  {
    id: 'rounded-rect',
    name: '둥근 사각형',
    category: 'shape',
    defaultProps: {
      type: 'rect',
      name: '둥근 사각형',
      width: 100,
      height: 100,
      cornerRadius: 16,
      fill: SHAPE_FILL_COLOR,
    },
  },
  {
    id: 'speech-bubble',
    name: '말풍선',
    category: 'shape',
    defaultProps: {
      type: 'path',
      name: '말풍선',
      data: 'M4 8C4 5.79086 5.79086 4 8 4H92C94.2091 4 96 5.79086 96 8V68C96 70.2091 94.2091 72 92 72H56L40 92L36 72H8C5.79086 72 4 70.2091 4 68V8Z',
      fill: SHAPE_FILL_COLOR,
    },
  },
  {
    id: 'heart',
    name: '하트',
    category: 'shape',
    defaultProps: {
      type: 'path',
      name: '하트',
      data: 'M50 90L43.45 84.09C23.2 65.66 10 53.64 10 38.75C10 26.73 19.73 17 31.75 17C38.49 17 44.95 20.14 50 25.3C55.05 20.14 61.51 17 68.25 17C80.27 17 90 26.73 90 38.75C90 53.64 76.8 65.66 56.55 84.12L50 90Z',
      fill: SHAPE_FILL_COLOR,
    },
  },
  // Row 3
  {
    id: 'diamond',
    name: '다이아몬드',
    category: 'shape',
    defaultProps: {
      type: 'regularPolygon',
      name: '다이아몬드',
      sides: 4,
      radius: 50,
      rotation: 45,
      fill: SHAPE_FILL_COLOR,
    },
  },
  {
    id: 'pentagon',
    name: '오각형',
    category: 'shape',
    defaultProps: {
      type: 'regularPolygon',
      name: '오각형',
      sides: 5,
      radius: 50,
      fill: SHAPE_FILL_COLOR,
    },
  },
  {
    id: 'hexagon',
    name: '육각형',
    category: 'shape',
    defaultProps: {
      type: 'regularPolygon',
      name: '육각형',
      sides: 6,
      radius: 50,
      fill: SHAPE_FILL_COLOR,
    },
  },
  // Row 4
  {
    id: 'star',
    name: '별',
    category: 'shape',
    defaultProps: {
      type: 'star',
      name: '별',
      numPoints: 5,
      innerRadius: 25,
      outerRadius: 50,
      fill: SHAPE_FILL_COLOR,
    },
  },
  {
    id: 'star-4',
    name: '4각 별',
    category: 'shape',
    defaultProps: {
      type: 'star',
      name: '4각 별',
      numPoints: 4,
      innerRadius: 10,
      outerRadius: 50,
      fill: SHAPE_FILL_COLOR,
    },
  },
  {
    id: 'arrow-shape',
    name: '화살표',
    category: 'shape',
    defaultProps: {
      type: 'path',
      name: '화살표',
      data: 'M50 5L85 45L65 45L65 95L35 95L35 45L15 45L50 5Z',
      fill: SHAPE_FILL_COLOR,
    },
  },
  {
    id: 'ellipse',
    name: '타원',
    category: 'shape',
    keywords: '타원형 동그라미',
    defaultProps: { type: 'ellipse', name: '타원', radiusX: 60, radiusY: 40, fill: SHAPE_FILL_COLOR },
  },
  {
    id: 'octagon',
    name: '팔각형',
    category: 'shape',
    defaultProps: { type: 'regularPolygon', name: '팔각형', sides: 8, radius: 50, fill: SHAPE_FILL_COLOR },
  },
  {
    id: 'burst',
    name: '버스트',
    category: 'shape',
    keywords: '폭발 강조 세일 뱃지',
    defaultProps: { type: 'star', name: '버스트', numPoints: 12, innerRadius: 40, outerRadius: 50, fill: SHAPE_FILL_COLOR },
  },
  {
    id: 'seal',
    name: '씰',
    category: 'shape',
    keywords: '인증 도장 뱃지 톱니',
    defaultProps: { type: 'star', name: '씰', numPoints: 24, innerRadius: 45, outerRadius: 50, fill: SHAPE_FILL_COLOR },
  },
  ...pathShapes([
    ['half-circle', '반원', 'M5 75A45 45 0 0 1 95 75Z', '반달'],
    ['arch', '아치', 'M15 95V50A35 35 0 0 1 85 50V95Z', '문 창문'],
    ['ring', '링', 'M50 5A45 45 0 1 1 49.9 5ZM50 25A25 25 0 1 0 50.1 25Z', '도넛 원 테두리'],
    ['plus', '십자', 'M38 5H62V38H95V62H62V95H38V62H5V38H38Z', '더하기 플러스'],
    ['chevron', '쉐브론', 'M10 10H60L90 50L60 90H10L40 50Z', '화살 단계 진행'],
    ['label-tag', '가격표', 'M5 25H70L95 50L70 75H5Z', '태그 라벨 가격'],
    ['ribbon-banner', '리본 배너', 'M0 25H100L88 50L100 75H0L12 50Z', '배너 띠 제목'],
    ['parallelogram', '평행사변형', 'M25 20H95L75 80H5Z', '사선 기울기'],
    ['trapezoid', '사다리꼴', 'M25 20H75L95 80H5Z', ''],
    ['shield', '방패', 'M50 5L90 20V48C90 72 72 88 50 95C28 88 10 72 10 48V20Z', '안심 보장 인증'],
    ['drop', '물방울', 'M50 5C50 5 15 45 15 65A35 35 0 0 0 85 65C85 45 50 5 50 5Z', '수분 촉촉 물'],
    ['leaf', '잎', 'M90 10C40 10 10 40 10 90C60 90 90 60 90 10Z', '나뭇잎 자연'],
    ['cloud', '구름', 'M28 80A20 20 0 0 1 26 40A26 26 0 0 1 74 34A23 23 0 0 1 76 80Z', '날씨 말풍선'],
    [
      'round-bubble',
      '둥근 말풍선',
      'M50 8C74 8 92 23 92 42C92 61 74 76 50 76C44 76 39 75 34 73L14 86L20 66C12 60 8 51 8 42C8 23 26 8 50 8Z',
      '대화 후기 채팅',
    ],
  ]),
];

/** [id, 이름, 100×100 path, 검색어] → path 도형 */
function pathShapes(rows: [string, string, string, string][]): ShapeDefinitionInput[] {
  return rows.map(([id, name, data, keywords]) => ({
    id,
    name,
    category: 'shape',
    keywords,
    defaultProps: { type: 'path', name, data, fill: SHAPE_FILL_COLOR },
  }));
}

export const BASIC_SHAPES = createShapeDefinitions(BASIC_SHAPE_INPUTS);
