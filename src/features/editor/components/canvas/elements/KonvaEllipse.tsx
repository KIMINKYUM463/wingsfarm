'use client';

import Konva from 'konva';
import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Ellipse } from 'react-konva';
import { KonvaEllipseElement } from '@/shared/types/konva';
import { useKonvaElementHandlers } from '@/features/editor/hooks/useKonvaElementHandlers';

interface KonvaEllipseProps {
  element: KonvaEllipseElement;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
  onTransformStart?: () => void;
  onTransform?: (e: KonvaEventObject<MouseEvent>) => void;
  onTransformEnd?: (e: KonvaEventObject<MouseEvent>) => void;
}

const KonvaEllipse = forwardRef<Konva.Ellipse, KonvaEllipseProps>(
  (
    { element, onDragStart, onDragMove, onDragEnd, onTransformStart, onTransform, onTransformEnd },
    ref,
  ) => {
    const { onClick } = useKonvaElementHandlers(element.id);
    const ellipseRef = useRef<Konva.Ellipse>(null);

    useImperativeHandle(ref, () => ellipseRef.current!);

    return (
      <Ellipse
        ref={ellipseRef}
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
        // Ellipse specific props
        radiusX={element.radiusX}
        radiusY={element.radiusY}
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

KonvaEllipse.displayName = 'KonvaEllipse';

export default React.memo(KonvaEllipse);
