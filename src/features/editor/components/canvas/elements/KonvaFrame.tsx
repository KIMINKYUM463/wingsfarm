import { Group, Rect } from 'react-konva';
import { KonvaElementRenderer } from '@/features/editor/components/canvas/KonvaElementRenderer';
import { forwardRef, useMemo, memo } from 'react';
import Konva from 'konva';
import { KonvaNestedFrameElement } from '@/shared/types/konva';
import { KonvaElementRendererProps } from '@/shared/types/konva-editor';
import { useContainerNode } from '@/features/editor/hooks/useContainerNode';

/**
 * 중첩 Frame Props (rootId 필수)
 */
interface KonvaFrameProps extends Omit<KonvaElementRendererProps, 'element'> {
  element: KonvaNestedFrameElement;
}

/**
 * 중첩 Frame 컴포넌트 - Wrapper Group 구조
 *
 * ## 구조
 * ```
 * <Group ref={ref} draggable>   ← 컨테이너 (drag/transform 처리)
 *   └── Rect                    ← 배경 + shadow
 *   └── Rect (overlay)          ← 그룹 모드 시 hit detection
 *   └── children                ← 자식 요소들
 * </Group>
 * ```
 *
 * ## 왜 이 구조인가
 * - Group: drag/transform/selection 처리, elementRefs 등록
 * - Rect: 배경 + shadow 렌더링 (Group은 shadow 미지원)
 *
 * ## KonvaGroup과 동일한 동작
 * - 더블클릭으로 내부 진입
 * - 선택 시 내부 요소 클릭 허용
 * - 중첩 Frame/Group 지원
 */
const KonvaFrame = forwardRef<Konva.Group, KonvaFrameProps>(
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
      allowInternalClick,
      onClick,
      onDblClick,
      commonGroupProps,
      shadowProps,
    } = useContainerNode({ element, ref });

    // Fill props (메모이제이션) - fill 없으면 transparent로 hit detection 보장
    const fillProps = useMemo(
      () => ({
        fill: element.fill ?? 'transparent',
        fillPriority: element.fillPriority,
        fillLinearGradientStartPoint: element.fillLinearGradientStartPoint,
        fillLinearGradientEndPoint: element.fillLinearGradientEndPoint,
        fillLinearGradientColorStops: element.fillLinearGradientColorStops,
        fillRadialGradientStartPoint: element.fillRadialGradientStartPoint,
        fillRadialGradientEndPoint: element.fillRadialGradientEndPoint,
        fillRadialGradientStartRadius: element.fillRadialGradientStartRadius,
        fillRadialGradientEndRadius: element.fillRadialGradientEndRadius,
        fillRadialGradientColorStops: element.fillRadialGradientColorStops,
      }),
      [
        element.fill,
        element.fillPriority,
        element.fillLinearGradientStartPoint,
        element.fillLinearGradientEndPoint,
        element.fillLinearGradientColorStops,
        element.fillRadialGradientStartPoint,
        element.fillRadialGradientEndPoint,
        element.fillRadialGradientStartRadius,
        element.fillRadialGradientEndRadius,
        element.fillRadialGradientColorStops,
      ],
    );

    // Stroke props (메모이제이션)
    const strokeProps = useMemo(
      () => ({
        stroke: element.stroke,
        strokeWidth: element.strokeWidth,
      }),
      [element.stroke, element.strokeWidth],
    );

    return (
      <Group
        ref={groupRef}
        key={element.id}
        id={element.id}
        name={`data-frame ${element.name || ''}`}
        x={currentX}
        y={currentY}
        {...commonGroupProps}
        draggable
        onClick={onClick}
        onDblClick={onDblClick}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onTransformStart={onTransformStart}
        onTransform={onTransform}
        onTransformEnd={onTransformEnd}
      >
        {/* Frame 배경 + shadow */}
        <Rect
          width={element.width}
          height={element.height}
          cornerRadius={element.cornerRadius}
          perfectDrawEnabled={false}
          {...fillProps}
          {...strokeProps}
          {...shadowProps}
        />

        {/* 그룹 모드 시: 오버레이 (내부 요소 이벤트 허용, 빈 공간 클릭 감지) */}
        {allowInternalClick && (
          <Rect
            name="_frame-overlay"
            width={element.width}
            height={element.height}
            fill="rgba(0,0,0,0.001)"
            perfectDrawEnabled={false}
          />
        )}

        {/* Frame 자식 요소들 */}
        <KonvaElementRenderer
          element={element}
          {...restProps}
          onTransformStart={onTransformStart}
          onTransform={onTransform}
          onTransformEnd={onTransformEnd}
        />
      </Group>
    );
  },
);
KonvaFrame.displayName = 'KonvaFrame';

export default memo(KonvaFrame);
