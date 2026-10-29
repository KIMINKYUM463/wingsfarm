import { ShapeCategory } from './types';

export * from './types';
export * from './utils';
export { BASIC_SHAPES } from './basic-shapes';
export { LINE_SHAPES } from './lines';

import { BASIC_SHAPES } from './basic-shapes';
import { LINE_SHAPES } from './lines';

/**
 * Shape 카테고리 목록
 * ShapeTool에서 사용
 */
export const SHAPE_CATEGORIES: ShapeCategory[] = [
  {
    id: 'shapes',
    title: '도형',
    items: BASIC_SHAPES,
  },
  {
    id: 'lines',
    title: '선',
    items: LINE_SHAPES,
  },
];

/**
 * ID로 ShapeDefinition 조회
 */
export const getShapeById = (id: string) => {
  return [...BASIC_SHAPES, ...LINE_SHAPES].find((shape) => shape.id === id);
};
