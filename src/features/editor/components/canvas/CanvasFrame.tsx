'use client';

import { useRef, useEffect } from 'react';
import { Layer, Stage, Rect, Group } from 'react-konva';
import { KonvaFrameElement } from '@/shared/types/konva';
import { useKonvaHover } from '@/features/editor/hooks/useKonvaHover';
import { useKonvaEvents } from '@/features/editor/hooks/useKonvaEvents';
import { useContextMenu } from '@/features/editor/hooks/useContextMenu';
import { useFrameLayout } from '@/features/editor/hooks/useFrameLayout';
import { useStageRefRegister } from '@/features/editor/hooks/useStageRefRegister';
import { useImageDrop } from '@/features/editor/hooks/useImageDrop';
import { KonvaElementRenderer } from '@/features/editor/components/canvas/KonvaElementRenderer';
import { EditorTransformer } from '@/features/editor/components/canvas/selection/EditorTransformer';
import { RotatingSelectionBox } from '@/features/editor/components/canvas/selection/RotatingSelectionBox';
import { SelectionRect } from '@/features/editor/components/canvas/selection/SelectionRect';
import { SelectionOverlay } from '@/features/editor/components/canvas/selection/SelectionOverlay';
import { FrameToolbox } from '@/features/editor/components/toolbox/FrameToolbox';
import { HoverOutline } from '@/features/editor/components/canvas/selection/HoverOutline';
import { SnapGuidelines } from '@/features/editor/components/canvas/selection/SnapGuidelines';
import ContextMenu from '@/features/editor/components/overlay/ContextMenu';

interface CanvasFrameProps {
  frame: KonvaFrameElement;
  part2?: string;
  index?: number;
  isLastFrame?: boolean;
}

/**
 * 프레임 배경 사각형 (인라인 컴포넌트)
 * - 프레임의 배경을 표시하는 Konva Rect
 * - 고정 속성: x=0, y=0, stroke='#CCCCCC', draggable=false
 */
const FrameBackground = ({
  id,
  width,
  height,
  fill = '#FFFFFF',
}: {
  id: string;
  width: number;
  height: number;
  fill?: string;
}) => (
  <Rect
    id={id}
    name="frame-background"
    x={0}
    y={0}
    width={width}
    height={height}
    fill={fill}
    stroke="#CCCCCC"
    draggable={false}
  />
);

const CanvasFrame = ({ frame, part2, index = 0, isLastFrame = false }: CanvasFrameProps) => {
  const stageRef = useRef<React.ComponentRef<typeof Stage>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stage ref를 전역 store에 등록 (이미지 다운로드 등에서 사용)
  useStageRefRegister(frame.id, stageRef);

  // 호버 이벤트 (frameId 전달하여 프레임별 hover 구분)
  const { handleElementMouseOver, handleElementMouseOut } = useKonvaHover(frame.id);

  // Context Menu (분리된 훅)
  const { contextMenu, handleContextMenu, closeContextMenu, openContextMenu } = useContextMenu();

  const {
    frameWidth,
    frameHeight,
    scaledFrameWidth,
    layerOffsetX,
    layerOffsetY,
    stageWidth,
    stageHeight,
    scale,
  } = useFrameLayout(frame, { index, isLastFrame });

  // Konva 이벤트 (선택, 드래그, 변형)
  const {
    selectionRect,
    transformerRef,
    elementRefs,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleTransformStart,
    handleTransform,
    handleTransformEnd,
    handleStageClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useKonvaEvents({ frameId: frame.id });

  // 프레임 간 드래그 이동을 위한 layout 정보를 DOM에 설정 (클라이언트에서만)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.dataset.layerOffsetX = String(layerOffsetX);
      containerRef.current.dataset.layerOffsetY = String(layerOffsetY);
      containerRef.current.dataset.scale = String(scale);
    }
  }, [layerOffsetX, layerOffsetY, scale]);

  // 이미지 드래그 앤 드롭 (교체/추가)
  const { handleDrop, handleDragOver, handleDragLeave } = useImageDrop({
    frameId: frame.id,
    stageRef,
    containerRef,
    layerOffsetX,
    layerOffsetY,
    scale,
    frameWidth,
    frameHeight,
  });

  return (
    <div
      ref={containerRef}
      data-frame-id={frame.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ animation: 'frame-fade-in 0.3s ease-out' }}
    >
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleStageClick}
        onContextMenu={handleContextMenu}
        onMouseOver={handleElementMouseOver}
        onMouseOut={handleElementMouseOut}
      >
        {/* FrameToolbox Layer: scale 미적용 (UI 요소이므로 원본 크기 유지) */}
        <Layer offsetX={-layerOffsetX} offsetY={-layerOffsetY} listening={false}>
          <FrameToolbox
            frameName={frame.name}
            part2={part2}
            frameY={frame.y * scale}
            frameWidth={scaledFrameWidth}
            frameHeight={frameHeight}
            frameId={frame.id}
            fill={frame.fill}
          />
        </Layer>

        {/* 메인 Layer: 반응형 스케일 적용 */}
        {/* offset을 scale로 나눔: Konva transform 순서가 offset → scale이므로, */}
        {/* scale 적용 후 원하는 위치에 배치하려면 offset을 scale로 나눠야 함 */}
        <Layer
          name="main-layer"
          offsetX={-layerOffsetX / scale}
          offsetY={-layerOffsetY / scale}
          scaleX={scale}
          scaleY={scale}
          listening={true}
        >
          {/* 클리핑 영역: 프레임 경계 밖 요소는 가려짐 */}
          <Group name="clip-group" clip={{ x: 0, y: 0, width: frameWidth, height: frameHeight }}>
            <FrameBackground
              id={frame.id}
              width={frameWidth}
              height={frameHeight}
              fill={frame.fill}
            />
            <KonvaElementRenderer
              element={frame}
              transformerRef={transformerRef}
              elementRefs={elementRefs}
              selectionRect={selectionRect}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTransformStart={handleTransformStart}
              onTransform={handleTransform}
              onTransformEnd={handleTransformEnd}
            />
            {/* Hover outline - clip-group 직접 자식으로 렌더링하여 클리핑 적용 */}
            <HoverOutline frameId={frame.id} />
          </Group>

          {/* UI 요소: 클리핑 미적용 (Transformer, SelectionRect 등) */}
          <EditorTransformer
            frameId={frame.id}
            transformerRef={transformerRef}
            elementRefs={elementRefs}
          />

          {/* 스냅 가이드라인 */}
          <SnapGuidelines frameId={frame.id} frameWidth={frameWidth} frameHeight={frameHeight} />

          {/* Selection rectangle */}
          {selectionRect.visible && (
            <SelectionRect
              x1={selectionRect.x1}
              y1={selectionRect.y1}
              x2={selectionRect.x2}
              y2={selectionRect.y2}
            />
          )}

        </Layer>

        {/* SelectionOverlay는 별도 Layer에 배치 (offset 적용 안함) */}
        {/* getClientRect()가 Stage 좌표를 반환하므로, Layer offset이 적용되면 double-counting 발생 */}
        <Layer listening={false}>
          <RotatingSelectionBox />
          <SelectionOverlay
            frameId={frame.id}
            transformerRef={transformerRef}
            elementRefs={elementRefs}
            onOpenContextMenu={openContextMenu}
          />
        </Layer>

      </Stage>

      {/* Context Menu: Portal로 body에 렌더링 (모든 요소 위에 표시) */}
      {contextMenu.visible && contextMenu.targetId && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetId={contextMenu.targetId}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};

export default CanvasFrame;
