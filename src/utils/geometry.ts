import { KonvaElement } from '@/shared/types/konva';

/**
 * 각도를 도에서 라디안으로 변환
 */
export const degToRad = (angle: number): number => (angle / 180) * Math.PI;

/**
 * 회전된 사각형의 특정 꼭지점 좌표 계산
 */
export const getCorner = (
  pivotX: number,
  pivotY: number,
  diffX: number,
  diffY: number,
  angle: number,
): { x: number; y: number } => {
  const distance = Math.sqrt(diffX * diffX + diffY * diffY);
  angle += Math.atan2(diffY, diffX);
  const x = pivotX + distance * Math.cos(angle);
  const y = pivotY + distance * Math.sin(angle);
  return { x, y };
};

/**
 * 요소 타입에 따른 크기 및 기준점 오프셋 계산 (스케일 적용 전)
 *
 * ## 좌표 체계
 * - Rect/Text/Path: x,y가 좌상단 → baseOffset = (0, 0)
 * - Circle/Star/RegularPolygon: x,y가 중심점 → baseOffset = (radius, radius)
 * - Ellipse: x,y가 중심점 → baseOffset = (radiusX, radiusY)
 * - Line/Arrow: x,y가 로컬 좌표 원점 → baseOffset = (minX, minY) of points
 *
 * @returns width, height: 요소의 크기
 * @returns baseOffsetX, baseOffsetY: x,y 위치에서 좌상단까지의 오프셋
 */
const getElementBounds = (
  element: KonvaElement,
): { width: number; height: number; baseOffsetX: number; baseOffsetY: number } => {
  const el = element as KonvaElement & {
    width?: number;
    height?: number;
    radius?: number;
    radiusX?: number;
    radiusY?: number;
    outerRadius?: number;
    points?: number[];
  };

  switch (element.type) {
    case 'circle': {
      const r = el.radius ?? 0;
      return { width: r * 2, height: r * 2, baseOffsetX: r, baseOffsetY: r };
    }
    case 'ellipse': {
      const rx = el.radiusX ?? 0;
      const ry = el.radiusY ?? 0;
      return { width: rx * 2, height: ry * 2, baseOffsetX: rx, baseOffsetY: ry };
    }
    case 'star': {
      const r = el.outerRadius ?? 0;
      return { width: r * 2, height: r * 2, baseOffsetX: r, baseOffsetY: r };
    }
    case 'regularPolygon': {
      const r = el.radius ?? 0;
      return { width: r * 2, height: r * 2, baseOffsetX: r, baseOffsetY: r };
    }
    case 'line':
    case 'arrow': {
      const points = el.points ?? [];
      if (points.length < 2) return { width: 0, height: 0, baseOffsetX: 0, baseOffsetY: 0 };
      const xs = points.filter((_, i) => i % 2 === 0);
      const ys = points.filter((_, i) => i % 2 === 1);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return {
        width: Math.max(...xs) - minX,
        height: Math.max(...ys) - minY,
        baseOffsetX: minX,
        baseOffsetY: minY,
      };
    }
    default:
      return {
        width: el.width ?? 0,
        height: el.height ?? 0,
        baseOffsetX: 0,
        baseOffsetY: 0,
      };
  }
};

/**
 * 회전된 Konva 요소의 경계 상자(bounding box) 계산
 * scaleX/scaleY, offsetX/offsetY를 고려
 * 모든 shape 타입 지원 (circle, ellipse, star, regularPolygon, line, arrow 등)
 *
 * @param element - Konva 요소
 * @returns 회전/스케일을 고려한 실제 경계 상자
 */
export const getClientRect = (
  element: KonvaElement,
): { x: number; y: number; width: number; height: number } => {
  const {
    x,
    y,
    rotation = 0,
    scaleX = 1,
    scaleY = 1,
    offsetX = 0,
    offsetY = 0,
  } = element as KonvaElement & {
    scaleX?: number;
    scaleY?: number;
    offsetX?: number;
    offsetY?: number;
  };

  // 요소 타입에 따른 크기 및 기준점 오프셋 계산
  const { width, height, baseOffsetX, baseOffsetY } = getElementBounds(element);

  // 총 오프셋 = 요소 타입별 기준점 오프셋 + Konva offset
  // 예: Circle은 baseOffset=(radius, radius)이고 offsetX=0이면 총 offset은 radius
  const totalOffsetX = baseOffsetX + offsetX;
  const totalOffsetY = baseOffsetY + offsetY;

  const pivotX = x;
  const pivotY = y;

  const rad = degToRad(rotation);

  // 4개 꼭지점 계산 (회전 중심 기준 상대 좌표)
  // 좌상단은 (x - totalOffset * scale), 우하단은 (x + (width - totalOffset) * scale)
  const p1 = getCorner(pivotX, pivotY, -totalOffsetX * scaleX, -totalOffsetY * scaleY, rad);
  const p2 = getCorner(
    pivotX,
    pivotY,
    (width - totalOffsetX) * scaleX,
    -totalOffsetY * scaleY,
    rad,
  );
  const p3 = getCorner(
    pivotX,
    pivotY,
    (width - totalOffsetX) * scaleX,
    (height - totalOffsetY) * scaleY,
    rad,
  );
  const p4 = getCorner(
    pivotX,
    pivotY,
    -totalOffsetX * scaleX,
    (height - totalOffsetY) * scaleY,
    rad,
  );

  const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
  const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
  const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
  const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};