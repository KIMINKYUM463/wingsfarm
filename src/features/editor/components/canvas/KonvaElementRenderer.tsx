'use client';

import {
  isKonvaGroupElement,
  isKonvaPathElement,
  isKonvaRectElement,
  isKonvaTextElement,
  isKonvaNestedFrameElement,
  isKonvaCircleElement,
  isKonvaEllipseElement,
  isKonvaStarElement,
  isKonvaRegularPolygonElement,
  isKonvaLineElement,
  isKonvaArrowElement,
  type KonvaElement,
} from '@/shared/types/konva';
import KonvaGroup from '@/features/editor/components/canvas/elements/KonvaGroup';
import KonvaFrame from '@/features/editor/components/canvas/elements/KonvaFrame';
import KonvaPath from '@/features/editor/components/canvas/elements/KonvaPath';
import KonvaRect from '@/features/editor/components/canvas/elements/KonvaRect';
import KonvaText from '@/features/editor/components/canvas/elements/KonvaText';
import KonvaCircle from '@/features/editor/components/canvas/elements/KonvaCircle';
import KonvaEllipse from '@/features/editor/components/canvas/elements/KonvaEllipse';
import KonvaStar from '@/features/editor/components/canvas/elements/KonvaStar';
import KonvaRegularPolygon from '@/features/editor/components/canvas/elements/KonvaRegularPolygon';
import KonvaLine from '@/features/editor/components/canvas/elements/KonvaLine';
import KonvaArrow from '@/features/editor/components/canvas/elements/KonvaArrow';
import React from 'react';
import { KonvaElementRendererProps } from '@/shared/types/konva-editor';
import { useKonvaRenderer } from '@/features/editor/hooks/useKonvaRenderer';

export const KonvaElementRenderer = ({
  element,
  elementRefs,
  transformerRef,
  selectionRect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTransformStart,
  onTransform,
  onTransformEnd,
}: KonvaElementRendererProps) => {
  const { createElementProps } = useKonvaRenderer({
    elementRefs,
    onDragStart,
    onDragMove,
    onDragEnd,
    onTransformStart,
    onTransform,
    onTransformEnd,
  });

  const renderElement = (element: KonvaElement) => {
    if (!element || !element.type || element.visible === false) {
      return null;
    }

    const elementProps = createElementProps(element.id);

    if (isKonvaRectElement(element)) {
      return <KonvaRect {...elementProps} element={element} />;
    }
    if (isKonvaTextElement(element)) {
      return <KonvaText {...elementProps} element={element} />;
    }
    if (isKonvaPathElement(element)) {
      return <KonvaPath {...elementProps} element={element} />;
    }
    if (isKonvaCircleElement(element)) {
      return <KonvaCircle {...elementProps} element={element} />;
    }
    if (isKonvaEllipseElement(element)) {
      return <KonvaEllipse {...elementProps} element={element} />;
    }
    if (isKonvaStarElement(element)) {
      return <KonvaStar {...elementProps} element={element} />;
    }
    if (isKonvaRegularPolygonElement(element)) {
      return <KonvaRegularPolygon {...elementProps} element={element} />;
    }
    if (isKonvaLineElement(element)) {
      return <KonvaLine {...elementProps} element={element} />;
    }
    if (isKonvaArrowElement(element)) {
      return <KonvaArrow {...elementProps} element={element} />;
    }
    if (isKonvaGroupElement(element)) {
      return (
        <KonvaGroup
          {...elementProps}
          element={element}
          elementRefs={elementRefs}
          transformerRef={transformerRef}
          selectionRect={selectionRect}
        />
      );
    }
    if (isKonvaNestedFrameElement(element)) {
      return (
        <KonvaFrame
          {...elementProps}
          element={element}
          elementRefs={elementRefs}
          transformerRef={transformerRef}
          selectionRect={selectionRect}
        />
      );
    }
    return null;
  };

  return (
    <>
      {/* Render all child elements */}
      {element.children.map((childElement) => (
        <React.Fragment key={childElement.id}>{renderElement(childElement)}</React.Fragment>
      ))}
    </>
  );
};
