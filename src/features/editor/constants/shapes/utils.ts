import React from 'react';
import ShapePreview from '@/features/editor/components/shared/ShapePreview';
import { ShapeDefinition, ShapeDefinitionInput } from './types';

/**
 * ShapeDefinitionInput에서 ShapeDefinition 생성 (preview 자동 생성)
 */
export const createShapeDefinition = (input: ShapeDefinitionInput): ShapeDefinition => ({
  ...input,
  preview: React.createElement(ShapePreview, {
    type: input.defaultProps.type,
    props: input.defaultProps as Record<string, unknown>,
  }),
});

/**
 * 여러 ShapeDefinitionInput을 ShapeDefinition 배열로 변환
 */
export const createShapeDefinitions = (inputs: ShapeDefinitionInput[]): ShapeDefinition[] =>
  inputs.map(createShapeDefinition);
