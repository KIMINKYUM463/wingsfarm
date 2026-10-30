'use client';

import React from 'react';
import { Group, Label, Tag, Text } from 'react-konva';
import { AI_IMAGE_LABEL } from '@/shared/lib/aiImageLabel';

interface AiImageBadgeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  offsetX?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
}

/**
 * AI 사진 왼쪽 아래 "AI 연출 이미지" 배지.
 * 다운로드에서도 숨기지 않는다(네이버쇼핑 AI 활용 표시 기준) → `_ai-label`은 EXPORT_HIDDEN에 넣지 말 것.
 */
const AiImageBadge = React.memo<AiImageBadgeProps>(({ x, y, width, height, rotation, offsetX, offsetY, scaleX = 1, scaleY = 1 }) => {
  if (width <= 0 || height <= 0) return null;
  const fontSize = Math.min(20, Math.max(11, Math.round(Math.min(width, height) * 0.045)));
  const padding = Math.round(fontSize * 0.45);
  const margin = Math.round(fontSize * 0.7);
  return (
    <Group name="_ai-label" listening={false} x={x} y={y} rotation={rotation} offsetX={offsetX} offsetY={offsetY} scaleX={scaleX} scaleY={scaleY}>
      <Label x={margin} y={height - margin - fontSize - padding * 2}>
        <Tag fill="rgba(17,24,39,0.62)" cornerRadius={fontSize} />
        <Text text={AI_IMAGE_LABEL} fontSize={fontSize} fontFamily="Pretendard" fontStyle="600" fill="#FFFFFF" padding={padding} />
      </Label>
    </Group>
  );
});

AiImageBadge.displayName = 'AiImageBadge';

export default AiImageBadge;
