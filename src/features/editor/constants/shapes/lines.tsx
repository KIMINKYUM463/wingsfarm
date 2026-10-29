import { createShapeDefinitions } from './utils';
import { ShapeDefinitionInput } from './types';

// 선 색상
const LINE_BLACK = '#2B2B2E';

/**
 * 선 데이터 (프리뷰는 ShapePreview로 자동 생성)
 * 순서: Figma 디자인 기준 (12개, 4x3 그리드)
 */
const LINE_SHAPE_INPUTS: ShapeDefinitionInput[] = [
  // Row 1
  {
    id: 'line-solid',
    name: '실선',
    category: 'line',
    defaultProps: {
      type: 'line',
      name: '실선',
      points: [0, 0, 100, 0],
      stroke: LINE_BLACK,
      strokeWidth: 2,
      lineCap: 'round',
    },
  },
  {
    id: 'line-dashed',
    name: '점선',
    category: 'line',
    defaultProps: {
      type: 'line',
      name: '점선',
      points: [0, 0, 100, 0],
      stroke: LINE_BLACK,
      strokeWidth: 2,
      dash: [8, 8],
      lineCap: 'round',
    },
  },
  {
    id: 'arrow-single',
    name: '화살표',
    category: 'line',
    defaultProps: {
      type: 'arrow',
      name: '화살표',
      points: [0, 0, 100, 0],
      stroke: LINE_BLACK,
      fill: LINE_BLACK,
      strokeWidth: 2,
      pointerLength: 10,
      pointerWidth: 10,
      pointerAtEnding: true,
    },
  },
  // Row 2
  {
    id: 'arrow-dashed',
    name: '점선 화살표',
    category: 'line',
    defaultProps: {
      type: 'arrow',
      name: '점선 화살표',
      points: [0, 0, 100, 0],
      stroke: LINE_BLACK,
      fill: LINE_BLACK,
      strokeWidth: 2,
      dash: [8, 8],
      pointerLength: 10,
      pointerWidth: 10,
      pointerAtEnding: true,
    },
  },
  {
    id: 'arrow-double',
    name: '양방향 화살표',
    category: 'line',
    defaultProps: {
      type: 'arrow',
      name: '양방향 화살표',
      points: [0, 0, 100, 0],
      stroke: LINE_BLACK,
      fill: LINE_BLACK,
      strokeWidth: 2,
      pointerLength: 10,
      pointerWidth: 10,
      pointerAtBeginning: true,
      pointerAtEnding: true,
    },
  },
  {
    id: 'arrow-curved',
    name: '곡선 화살표',
    category: 'line',
    defaultProps: {
      type: 'arrow',
      name: '곡선 화살표',
      // 좌하단에서 시작해 위로 올라가다 우측으로
      points: [0, 80, 0, 0, 80, 0],
      stroke: LINE_BLACK,
      fill: LINE_BLACK,
      strokeWidth: 2,
      tension: 0.5,
      pointerLength: 10,
      pointerWidth: 10,
      pointerAtEnding: true,
    },
  },
  // Row 3
  {
    id: 'line-with-dots',
    name: '양끝점 실선',
    category: 'line',
    defaultProps: {
      type: 'line',
      name: '양끝점 실선',
      points: [8, 0, 92, 0],
      stroke: LINE_BLACK,
      strokeWidth: 2,
      lineCap: 'round',
    },
  },
  {
    id: 'line-right-angle',
    name: '직각선',
    category: 'line',
    defaultProps: {
      type: 'line',
      name: '직각선',
      // 위에서 아래로, 그 다음 오른쪽으로
      points: [0, 0, 0, 70, 100, 70],
      stroke: LINE_BLACK,
      strokeWidth: 2,
      lineCap: 'round',
      lineJoin: 'round',
    },
  },
  {
    id: 'line-s-curve',
    name: 'S곡선',
    category: 'line',
    defaultProps: {
      type: 'line',
      name: 'S곡선',
      // 좌상단에서 우하단으로 S자
      points: [0, 0, 0, 50, 100, 50, 100, 100],
      stroke: LINE_BLACK,
      strokeWidth: 2,
      tension: 0.5,
      lineCap: 'round',
    },
  },
  // Row 4
  {
    id: 'line-zigzag',
    name: '지그재그선',
    category: 'line',
    defaultProps: {
      type: 'line',
      name: '지그재그선',
      points: [0, 5, 9, 0, 18, 10, 27, 0, 36, 10, 45, 0, 54, 10, 63, 0, 72, 10, 81, 0, 90, 10, 100, 5],
      stroke: LINE_BLACK,
      strokeWidth: 2,
      lineCap: 'round',
      lineJoin: 'round',
    },
  },
  {
    id: 'line-diagonal',
    name: '대각선',
    category: 'line',
    defaultProps: {
      type: 'line',
      name: '대각선',
      points: [0, 100, 100, 0],
      stroke: LINE_BLACK,
      strokeWidth: 2,
      lineCap: 'round',
    },
  },
  {
    id: 'line-thin-dotted',
    name: '얇은 점선',
    category: 'line',
    defaultProps: {
      type: 'line',
      name: '얇은 점선',
      points: [0, 0, 100, 0],
      stroke: LINE_BLACK,
      strokeWidth: 1,
      dash: [4, 6],
      lineCap: 'round',
    },
  },
];

export const LINE_SHAPES = createShapeDefinitions(LINE_SHAPE_INPUTS);
