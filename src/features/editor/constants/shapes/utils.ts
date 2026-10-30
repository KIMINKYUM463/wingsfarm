import React from 'react';
import ShapePreview from '@/features/editor/components/shared/ShapePreview';
import PathPreview from '@/features/editor/components/shared/PathPreview';
import { ShapeDefinition, ShapeDefinitionInput } from './types';

/** 테두리 없는 path는 SVG로, 나머지는 Konva로 미리보기를 그린다 */
const previewOf = ({ type, data, fill, stroke }: ShapeDefinitionInput['defaultProps'] & { data?: string; fill?: unknown }) =>
  type === 'path' && data && !stroke
    ? React.createElement(PathPreview, { data, fill: typeof fill === 'string' ? fill : undefined })
    : null;

/**
 * ShapeDefinitionInput에서 ShapeDefinition 생성 (preview 자동 생성)
 */
export const createShapeDefinition = (input: ShapeDefinitionInput): ShapeDefinition => ({
  ...input,
  preview:
    previewOf(input.defaultProps) ??
    React.createElement(ShapePreview, {
      type: input.defaultProps.type,
      props: input.defaultProps as Record<string, unknown>,
    }),
});

/**
 * 여러 ShapeDefinitionInput을 ShapeDefinition 배열로 변환
 */
export const createShapeDefinitions = (inputs: ShapeDefinitionInput[]): ShapeDefinition[] =>
  inputs.map(createShapeDefinition);

/** 처음 나온 순서를 지키며 묶는다 */
export const groupInOrder = <T>(items: T[], keyOf: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups].map(([key, grouped]) => ({ key, items: grouped }));
};
