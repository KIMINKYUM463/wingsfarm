'use client';

import { Rect } from 'react-konva';
import { useHoveredElement } from '@/features/editor/store/useHoverStore';
import { useSelectedIds } from '@/features/editor/store/useSelectionStore';
import { BORDER_STYLES } from '@/shared/constants/border';

interface HoverOutlineProps {
  frameId: string;
}

/**
 * HoverOutline - clip-group 내부에서 렌더링되는 hover 테두리
 *
 * ## 왜 별도 컴포넌트인가?
 * - 각 요소 내부에서 stroke 렌더링 시 클리핑이 안 됨
 * - clip-group 직접 자식으로 렌더링해야 클리핑 적용됨
 */
export const HoverOutline = ({ frameId }: HoverOutlineProps) => {
  const hoveredElement = useHoveredElement();
  const selectedIds = useSelectedIds();

  // 호버된 요소가 없거나 다른 프레임이면 렌더링 안 함
  if (!hoveredElement || hoveredElement.frameId !== frameId) {
    return null;
  }

  // 선택된 요소는 hover 표시 안 함
  if (selectedIds.includes(hoveredElement.id)) {
    return null;
  }

  return (
    <Rect
      name="_hover-outline"
      x={hoveredElement.x}
      y={hoveredElement.y}
      width={hoveredElement.width}
      height={hoveredElement.height}
      rotation={hoveredElement.rotation}
      offsetX={hoveredElement.offsetX}
      offsetY={hoveredElement.offsetY}
      fill="rgba(0,0,0,0.001)"
      stroke={BORDER_STYLES.HOVER.color}
      strokeWidth={BORDER_STYLES.HOVER.width}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
};
