import { createShapeDefinitions } from './utils';
import { ShapeDefinitionInput } from './types';

// 도형 채우기 색상
const SHAPE_FILL_COLOR = '#2B2B2E';

/**
 * 기본 도형 데이터 (프리뷰는 ShapePreview로 자동 생성)
 * 순서: Figma 디자인 기준 (12개)
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
];

export const BASIC_SHAPES = createShapeDefinitions(BASIC_SHAPE_INPUTS);
