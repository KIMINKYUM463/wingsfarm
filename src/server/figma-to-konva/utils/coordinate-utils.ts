/**
 * 좌표 변환 유틸리티 함수들
 */

export interface AbsolutePosition {
  x: number;
  y: number;
}

/**
 * 절대좌표를 상대좌표로 변환
 */
export function convertToRelativeCoordinates(
  absolutePosition: AbsolutePosition,
  parentAbsolutePosition?: AbsolutePosition,
): AbsolutePosition {
  if (!parentAbsolutePosition) {
    return absolutePosition;
  }

  return {
    x: absolutePosition.x - parentAbsolutePosition.x,
    y: absolutePosition.y - parentAbsolutePosition.y,
  };
}

/**
 * Frame의 좌표를 (0, 0)으로 설정
 */
export function setFrameCoordinates(): AbsolutePosition {
  return { x: 0, y: 0 };
}

/**
 * Group의 좌표를 부모 기준 상대좌표로 변환
 */
export function convertGroupCoordinates(
  groupAbsolutePosition: AbsolutePosition,
  parentAbsolutePosition?: AbsolutePosition,
): AbsolutePosition {
  return convertToRelativeCoordinates(groupAbsolutePosition, parentAbsolutePosition);
}

/**
 * Element의 좌표를 부모 기준 상대좌표로 변환
 */
export function convertElementCoordinates(
  elementAbsolutePosition: AbsolutePosition,
  parentAbsolutePosition?: AbsolutePosition,
): AbsolutePosition {
  return convertToRelativeCoordinates(elementAbsolutePosition, parentAbsolutePosition);
}

export interface NodePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  offsetX?: number;
  offsetY?: number;
}

/**
 * 노드의 Konva 배치값 (부모 기준)
 *
 * - 회전이 없으면 absoluteBoundingBox 좌상단 그대로
 * - 회전이 있으면 absoluteBoundingBox는 "회전된 외곽 박스"이므로,
 *   두 박스의 중심이 같다는 점을 이용해 중심 + offset(크기의 절반) + rotation으로 배치한다.
 *   Figma relativeTransform [[cos, sin, x], [-sin, cos, y]] → Konva rotation = atan2(m10, m00)
 */
export function placeNode(node: any, parentAbsolutePosition?: AbsolutePosition): NodePlacement {
  const box = node.absoluteBoundingBox || { x: 0, y: 0, width: 0, height: 0 };
  const parent = parentAbsolutePosition ?? { x: 0, y: 0 };
  const transform: number[][] | undefined = node.relativeTransform;
  const size: { x: number; y: number } | undefined = node.size;
  const rotation = transform ? (Math.atan2(transform[1][0], transform[0][0]) * 180) / Math.PI : 0;

  if (!size || Math.abs(rotation) < 0.01) {
    return { x: box.x - parent.x, y: box.y - parent.y, width: box.width, height: box.height };
  }

  return {
    x: box.x + box.width / 2 - parent.x,
    y: box.y + box.height / 2 - parent.y,
    width: size.x,
    height: size.y,
    rotation,
    offsetX: size.x / 2,
    offsetY: size.y / 2,
  };
}

/**
 * Figma의 rotation 값(라디안)을 Konva의 rotation 값(도)으로 변환
 */
export function convertRotationToDegrees(rotationInRadians?: number): number {
  if (rotationInRadians === undefined) {
    return 0;
  }
  return rotationInRadians * (180 / Math.PI);
}
