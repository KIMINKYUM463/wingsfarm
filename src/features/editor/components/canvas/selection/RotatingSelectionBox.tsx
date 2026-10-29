/**
 * RotatingSelectionBox.tsx
 * 다중 선택 회전 시 표시되는 회전하는 selection box overlay
 *
 * ## 역할
 * - 다중 선택 회전 중 Transformer 대신 표시
 * - 그룹처럼 전체 영역이 함께 회전하는 시각적 피드백 제공
 *
 * ## 최적화
 * - 콜백 ref로 node를 store에 저장
 * - useRotateHandle에서 node 직접 업데이트 (React 리렌더 없음)
 */

'use client';

import { useCallback } from 'react';
import { Rect } from 'react-konva';
import Konva from 'konva';
import { BORDER_STYLES } from '@/shared/constants/border';
import {
  useIsMultiSelectionRotating,
  useSetRotatingBoxNode,
} from '@/features/editor/store/useSelectionStore';

/**
 * 회전하는 Selection Box 컴포넌트
 *
 * @description
 * - 항상 렌더링 (visible로 표시 제어)
 * - 콜백 ref로 node를 store에 저장 → useRotateHandle에서 직접 조작
 */
export const RotatingSelectionBox = () => {
  const isMultiSelectionRotating = useIsMultiSelectionRotating();
  const setRotatingBoxNode = useSetRotatingBoxNode();

  // 콜백 ref: node를 store에 저장
  const handleRef = useCallback(
    (node: Konva.Rect | null) => {
      setRotatingBoxNode(node);
    },
    [setRotatingBoxNode],
  );

  return (
    <Rect
      ref={handleRef}
      name="_selection-ui"
      visible={isMultiSelectionRotating}
      stroke={BORDER_STYLES.TRANSFORMER.color}
      strokeWidth={BORDER_STYLES.TRANSFORMER.width}
      fill="transparent"
      listening={false}
    />
  );
};
