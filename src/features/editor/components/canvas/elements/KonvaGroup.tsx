import { Group, Rect } from 'react-konva';
import { KonvaElementRenderer } from '@/features/editor/components/canvas/KonvaElementRenderer';
import { forwardRef, useState, useLayoutEffect } from 'react';
import Konva from 'konva';
import { KonvaElementRendererProps } from '@/shared/types/konva-editor';
import { useContainerNode } from '@/features/editor/hooks/useContainerNode';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Konva Group 컴포넌트
 *
 * ## 구조
 * ```
 * <Group ref={ref} draggable>   ← 컨테이너 (drag/transform 처리)
 *   └── Rect (overlay)          ← 그룹 모드 시 hit detection (동적 bounds)
 *   └── children                ← 자식 요소들
 * </Group>
 * ```
 *
 * ## KonvaFrame과 다른 점
 * - 배경 Rect 없음 (시각적 배경 없음)
 * - bounds를 동적으로 계산 (children 기반)
 * - shadow를 Group에 직접 적용 (제한적 지원)
 */
const KonvaGroup = forwardRef<Konva.Group, KonvaElementRendererProps>(
  (
    {
      element,
      onDragStart,
      onDragMove,
      onDragEnd,
      onTransformStart,
      onTransform,
      onTransformEnd,
      ...restProps
    },
    ref,
  ) => {
    const {
      groupRef,
      currentX,
      currentY,
      isInGroupMode,
      allowInternalClick,
      onClick,
      onDblClick,
      commonGroupProps,
      shadowProps,
    } = useContainerNode({ element, ref });

    const [bounds, setBounds] = useState<Bounds | null>(null);

    // 자식 렌더링 후 바운딩 박스 계산 → 빈 공간 hit detection용
    useLayoutEffect(() => {
      const group = groupRef.current;
      if (!group) return;

      // 약간의 지연 후 계산 (자식들이 완전히 렌더링된 후)
      requestAnimationFrame(() => {
        const rect = group.getClientRect({ relativeTo: group });
        setBounds(rect);
      });
    }, [element.children, groupRef]);

    return (
      <Group
        ref={groupRef}
        key={element.id}
        id={element.id}
        name={`data-group ${element.name || ''}`}
        x={currentX}
        y={currentY}
        {...commonGroupProps}
        {...shadowProps}
        // 그룹 모드에선 컨테이너 자체 드래그 끄고, 자식만 움직이게 함
        draggable={!isInGroupMode}
        onClick={onClick}
        onDblClick={onDblClick}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onTransformStart={onTransformStart}
        onTransform={onTransform}
        onTransformEnd={onTransformEnd}
      >
        {/* 그룹 모드 시: 오버레이 (내부 요소 이벤트 허용, 빈 공간 클릭 감지) */}
        {bounds && allowInternalClick && (
          <Rect
            name="_group-overlay"
            x={bounds.x}
            y={bounds.y}
            width={bounds.width}
            height={bounds.height}
            fill="rgba(0,0,0,0.001)"
            perfectDrawEnabled={false}
          />
        )}

        {/* 자식은 항상 드래그 가능 — 글씨 클릭·드래그 시 상자 안에서만 이동 (그룹 통째 드래그는 빈 곳) */}
        <KonvaElementRenderer
          element={element}
          {...restProps}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onTransformStart={onTransformStart}
          onTransform={onTransform}
          onTransformEnd={onTransformEnd}
        />
      </Group>
    );
  },
);
KonvaGroup.displayName = 'KonvaGroup';

export default KonvaGroup;
