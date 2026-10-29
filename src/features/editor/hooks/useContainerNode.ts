import { useRef, useEffect, useImperativeHandle, useMemo, ForwardedRef } from 'react';
import Konva from 'konva';
import { useKonvaElementHandlers } from '@/features/editor/hooks/useKonvaElementHandlers';
import { useGroupMode, useIsElementSelected } from '@/features/editor/store/useSelectionStore';

interface ContainerElement {
  id: string;
  x: number;
  y: number;
  opacity?: number;
  visible?: boolean;
  rotation?: number;
  offsetX?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  shadowEnabled?: boolean;
}

interface UseContainerNodeOptions {
  element: ContainerElement;
  ref: ForwardedRef<Konva.Group>;
}

/**
 * KonvaGroup/KonvaFrame 공통 로직 훅
 *
 * - Group mode 처리
 * - 위치 동기화 (드래그 중 리렌더링 시 점프 방지)
 * - ref 동기화
 * - 이벤트 핸들러
 */
export const useContainerNode = ({ element, ref }: UseContainerNodeOptions) => {
  const { onClick, onDblClick } = useKonvaElementHandlers(element.id);
  const groupRef = useRef<Konva.Group>(null);
  const groupMode = useGroupMode();
  const isGroupSelected = useIsElementSelected(element.id);

  // 그룹 모드 또는 그룹 선택 시 내부 요소 클릭 허용
  const isInGroupMode = groupMode.active && groupMode.groupId === element.id;
  const allowInternalClick = isInGroupMode || isGroupSelected;

  // 이전 store 위치 추적 → 실제 위치 변경 감지 (undo/redo, 드래그 종료 등)
  const prevPosition = useRef<{ x: number; y: number } | null>(null);

  // store 위치가 실제로 변경된 경우에만 store 값 사용
  const storePositionChanged =
    prevPosition.current === null ||
    prevPosition.current.x !== element.x ||
    prevPosition.current.y !== element.y;

  // 이전 위치 업데이트 (렌더 후)
  useEffect(() => {
    prevPosition.current = { x: element.x, y: element.y };
  }, [element.x, element.y]);

  // store 위치가 변경되었으면 store 값 사용, 아니면 Konva 노드의 현재 위치 유지
  const currentX = storePositionChanged ? element.x : (groupRef.current?.x() ?? element.x);
  const currentY = storePositionChanged ? element.y : (groupRef.current?.y() ?? element.y);

  // ref 동기화
  useImperativeHandle(ref, () => groupRef.current!);

  // 공통 Group props (메모이제이션)
  const commonGroupProps = useMemo(
    () => ({
      opacity: element.opacity ?? 1,
      visible: element.visible !== false,
      rotation: element.rotation,
      offsetX: element.offsetX,
      offsetY: element.offsetY,
      scaleX: element.scaleX ?? 1,
      scaleY: element.scaleY ?? 1,
    }),
    [
      element.opacity,
      element.visible,
      element.rotation,
      element.offsetX,
      element.offsetY,
      element.scaleX,
      element.scaleY,
    ],
  );

  // Shadow props (메모이제이션)
  const shadowProps = useMemo(
    () => ({
      shadowColor: element.shadowColor,
      shadowBlur: element.shadowBlur,
      shadowOffsetX: element.shadowOffsetX,
      shadowOffsetY: element.shadowOffsetY,
      shadowOpacity: element.shadowOpacity,
      shadowEnabled: element.shadowEnabled,
    }),
    [
      element.shadowColor,
      element.shadowBlur,
      element.shadowOffsetX,
      element.shadowOffsetY,
      element.shadowOpacity,
      element.shadowEnabled,
    ],
  );

  return {
    groupRef,
    currentX,
    currentY,
    allowInternalClick,
    onClick: allowInternalClick ? undefined : onClick,
    onDblClick: allowInternalClick ? undefined : onDblClick,
    commonGroupProps,
    shadowProps,
  };
};
