'use client';

import Konva from 'konva';
import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Circle } from 'react-konva';
import { KonvaCircleElement } from '@/shared/types/konva';
import { useKonvaElementHandlers } from '@/features/editor/hooks/useKonvaElementHandlers';

interface KonvaCircleProps {
  element: KonvaCircleElement;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
  onTransformStart?: () => void;
  onTransform?: (e: KonvaEventObject<MouseEvent>) => void;
  onTransformEnd?: (e: KonvaEventObject<MouseEvent>) => void;
}

const KonvaCircle = forwardRef<Konva.Circle, KonvaCircleProps>(
  (
    { element, onDragStart, onDragMove, onDragEnd, onTransformStart, onTransform, onTransformEnd },
    ref,
  ) => {
    const { onClick } = useKonvaElementHandlers(element.id);
    const circleRef = useRef<Konva.Circle>(null);

    useImperativeHandle(ref, () => circleRef.current!);

    return (
      <Circle
        ref={circleRef}
        draggable={!!onDragEnd}
        onClick={onClick}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onTransformStart={onTransformStart}
        onTransform={onTransform}
        onTransformEnd={onTransformEnd}
        // Common props
        id={element.id}
        name={element.name}
        x={element.x}
        y={element.y}
        opacity={element.opacity ?? 1}
        visible={element.visible !== false}
        rotation={element.rotation}
        offsetX={element.offsetX}
        offsetY={element.offsetY}
        scaleX={element.scaleX ?? 1}
        scaleY={element.scaleY ?? 1}
        // Circle specific props
        radius={element.radius}
        // Fill props
        fill={element.fill}
        fillPriority={element.fillPriority}
        fillLinearGradientStartPoint={element.fillLinearGradientStartPoint}
        fillLinearGradientEndPoint={element.fillLinearGradientEndPoint}
        fillLinearGradientColorStops={element.fillLinearGradientColorStops}
        fillRadialGradientStartPoint={element.fillRadialGradientStartPoint}
        fillRadialGradientEndPoint={element.fillRadialGradientEndPoint}
        fillRadialGradientStartRadius={element.fillRadialGradientStartRadius}
        fillRadialGradientEndRadius={element.fillRadialGradientEndRadius}
        fillRadialGradientColorStops={element.fillRadialGradientColorStops}
        // Stroke props
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
        // Shadow props
        shadowColor={element.shadowColor}
        shadowBlur={element.shadowBlur}
        shadowOffsetX={element.shadowOffsetX}
        shadowOffsetY={element.shadowOffsetY}
        shadowOpacity={element.shadowOpacity}
        shadowEnabled={element.shadowEnabled}
        // Performance: fill+stroke 동시 사용 시 2x draw 방지
        perfectDrawEnabled={false}
      />
    );
  },
);

KonvaCircle.displayName = 'KonvaCircle';

export default React.memo(KonvaCircle);
