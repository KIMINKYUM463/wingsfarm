'use client';

import React, { useMemo } from 'react';
import { Stage, Layer, Line, Arrow, Rect, Circle, Ellipse, Star, RegularPolygon, Path } from 'react-konva';

type LineProps = React.ComponentProps<typeof Line>;
type ArrowProps = React.ComponentProps<typeof Arrow>;
type RectProps = React.ComponentProps<typeof Rect>;
type CircleProps = React.ComponentProps<typeof Circle>;
type EllipseProps = React.ComponentProps<typeof Ellipse>;
type StarProps = React.ComponentProps<typeof Star>;
type RegularPolygonProps = React.ComponentProps<typeof RegularPolygon>;
type PathProps = React.ComponentProps<typeof Path>;

interface ShapePreviewProps {
  type: string;
  props: Record<string, unknown>;
  size?: number;
}

type ShapeType = 'line' | 'arrow' | 'rect' | 'circle' | 'ellipse' | 'star' | 'regularPolygon' | 'path';

const scaleLineOrArrow = (
  props: Record<string, unknown>,
  size: number,
  center: number,
  type: 'line' | 'arrow',
): Record<string, unknown> => {
  const points = props.points as number[] | undefined;
  if (!points) return {};

  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const lineScale = Math.min(size / width, size / height);
  const offsetX = center - (width * lineScale) / 2 - minX * lineScale;
  const offsetY = center - (height * lineScale) / 2 - minY * lineScale;

  const result: Record<string, unknown> = {
    points: points.map((p, i) => (i % 2 === 0 ? p * lineScale + offsetX : p * lineScale + offsetY)),
  };

  if (type === 'arrow') {
    const arrowScale = lineScale * 0.7;
    result.pointerLength = ((props.pointerLength as number) || 10) * arrowScale;
    result.pointerWidth = ((props.pointerWidth as number) || 10) * arrowScale;
  }

  return result;
};

const scaleRect = (
  props: Record<string, unknown>,
  size: number,
  center: number,
  scale: number,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {
    x: center - size / 2,
    y: center - size / 2,
    width: size,
    height: size,
  };
  if (props.cornerRadius) {
    result.cornerRadius = (props.cornerRadius as number) * scale;
  }
  return result;
};

const scaleCircle = (size: number, center: number): Record<string, unknown> => ({
  x: center,
  y: center,
  radius: size / 2,
});

const scaleStar = (props: Record<string, unknown>, scale: number, center: number): Record<string, unknown> => ({
  x: center,
  y: center,
  innerRadius: ((props.innerRadius as number) || 25) * scale,
  outerRadius: ((props.outerRadius as number) || 50) * scale,
});

const scaleRegularPolygon = (
  props: Record<string, unknown>,
  size: number,
  center: number,
): Record<string, unknown> => {
  const radius = size / 2;
  const sides = props.sides as number;
  // 삼각형(sides=3)은 무게중심과 시각적 중심이 다르므로 y 보정
  const yOffset = sides === 3 ? radius * 0.15 : 0;
  return {
    x: center,
    y: center + yOffset,
    radius,
  };
};

const scaleEllipse = (props: Record<string, unknown>, size: number, center: number): Record<string, unknown> => {
  const rx = (props.radiusX as number) || 60;
  const ry = (props.radiusY as number) || 40;
  const ellipseScale = Math.min(size / (rx * 2), size / (ry * 2));
  return {
    x: center,
    y: center,
    radiusX: rx * ellipseScale,
    radiusY: ry * ellipseScale,
  };
};

const scalePath = (scale: number, center: number): Record<string, unknown> => ({
  x: center - (100 * scale) / 2,
  y: center - (100 * scale) / 2,
  scaleX: scale,
  scaleY: scale,
});

/**
 * 실제 Konva로 도형/선을 렌더링하는 프리뷰 컴포넌트
 */
const ShapePreview: React.FC<ShapePreviewProps> = ({ type, props, size = 74 }) => {
  const scaledProps = useMemo(() => {
    const scale = size / 100;
    const center = size / 2;

    const typeScalers: Record<ShapeType, () => Record<string, unknown>> = {
      line: () => scaleLineOrArrow(props, size, center, 'line'),
      arrow: () => scaleLineOrArrow(props, size, center, 'arrow'),
      rect: () => scaleRect(props, size, center, scale),
      circle: () => scaleCircle(size, center),
      star: () => scaleStar(props, scale, center),
      regularPolygon: () => scaleRegularPolygon(props, size, center),
      ellipse: () => scaleEllipse(props, size, center),
      path: () => scalePath(scale, center),
    };

    const scaler = typeScalers[type as ShapeType];
    const typeSpecificProps = scaler ? scaler() : {};

    const strokeWidthProps = props.strokeWidth
      ? { strokeWidth: Math.max(1, (props.strokeWidth as number) * scale * 0.6) }
      : {};

    return {
      ...props,
      listening: false,
      ...typeSpecificProps,
      ...strokeWidthProps,
    };
  }, [type, props, size]);

  const renderShape = () => {
    const shapeMap: Record<ShapeType, React.ReactNode> = {
      line: <Line {...(scaledProps as LineProps)} />,
      arrow: <Arrow {...(scaledProps as ArrowProps)} />,
      rect: <Rect {...(scaledProps as RectProps)} />,
      circle: <Circle {...(scaledProps as CircleProps)} />,
      ellipse: <Ellipse {...(scaledProps as EllipseProps)} />,
      star: <Star {...(scaledProps as StarProps)} />,
      regularPolygon: <RegularPolygon {...(scaledProps as RegularPolygonProps)} />,
      path: <Path {...(scaledProps as PathProps)} />,
    };
    return shapeMap[type as ShapeType] ?? null;
  };

  return (
    <Stage width={size} height={size}>
      <Layer>{renderShape()}</Layer>
    </Stage>
  );
};

export default React.memo(ShapePreview);
