'use client';

import { Rect } from 'react-konva';
import { BORDER_STYLES } from '@/shared/constants/border';

interface SelectionRectProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * 다중 선택 시 드래그 영역을 표시하는 사각형 컴포넌트
 *
 * @description
 * - 마우스 드래그로 여러 요소를 선택할 때 표시되는 선택 영역
 * - BORDER_STYLES.SELECTION_RECT 스타일 사용
 * - 상위 컴포넌트에서 조건부 렌더링으로 표시 여부 제어
 */
export const SelectionRect = ({ x1, y1, x2, y2 }: SelectionRectProps) => {
  return (
    <Rect
      name="_selection-ui"
      x={Math.min(x1, x2)}
      y={Math.min(y1, y2)}
      width={Math.abs(x2 - x1)}
      height={Math.abs(y2 - y1)}
      fill={BORDER_STYLES.SELECTION_RECT.color}
    />
  );
};
