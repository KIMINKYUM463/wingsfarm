'use client';

import { useMemo } from 'react';
import { Layer, Stage, Rect, Group } from 'react-konva';
import { KonvaFrameElement } from '@/shared/types/konva';
import { KonvaElementRenderer } from '@/features/editor/components/canvas/KonvaElementRenderer';

interface MobileCanvasFrameProps {
  frame: KonvaFrameElement;
  /** 사용 가능한 캔버스 너비 (부모에서 계산하여 전달) */
  availableWidth: number;
  index?: number;
  isLastFrame?: boolean;
}

/**
 * 모바일 읽기 전용 캔버스 프레임
 * - 인터랙션 없음 (선택, 드래그, 변형 불가)
 * - 단순 렌더링만 수행
 */
const MobileCanvasFrame = ({
  frame,
  availableWidth,
  index = 0,
  isLastFrame = false,
}: MobileCanvasFrameProps) => {
  const layout = useMemo(() => {
    const frameWidth = frame.width || 860;
    const frameHeight = frame.height || 1080;

    // 모바일: 화면 너비에 맞춤 (100% fit)
    const scale = availableWidth / frameWidth;
    const scaledHeight = frameHeight * scale;

    // 간격 계산
    const gap = 24;
    const topOffset = index === 0 ? 36 : gap / 2;
    const bottomOffset = isLastFrame ? 36 : gap / 2;

    return {
      frameWidth,
      frameHeight,
      scale,
      stageWidth: availableWidth,
      stageHeight: scaledHeight + topOffset + bottomOffset,
      layerOffsetY: topOffset,
    };
  }, [availableWidth, frame.width, frame.height, index, isLastFrame]);

  return (
    <div style={{ animation: 'frame-fade-in 0.3s ease-out' }}>
      <Stage
        width={layout.stageWidth}
        height={layout.stageHeight}
        listening={false}
      >
      <Layer
        offsetY={-layout.layerOffsetY / layout.scale}
        scaleX={layout.scale}
        scaleY={layout.scale}
        listening={false}
      >
        <Group clip={{ x: 0, y: 0, width: layout.frameWidth, height: layout.frameHeight }}>
          {/* 프레임 배경 */}
          <Rect
            x={0}
            y={0}
            width={layout.frameWidth}
            height={layout.frameHeight}
            fill={frame.fill || '#FFFFFF'}
          />
          {/* 프레임 내용 (읽기 전용) */}
          <KonvaElementRenderer
            element={frame}
            transformerRef={{ current: null }}
            elementRefs={{ current: new Map() }}
            selectionRect={{ visible: false, x1: 0, y1: 0, x2: 0, y2: 0 }}
            onDragStart={() => {}}
            onDragMove={() => {}}
            onDragEnd={() => {}}
            onTransformStart={() => {}}
            onTransform={() => {}}
            onTransformEnd={() => {}}
          />
        </Group>
      </Layer>
    </Stage>
    </div>
  );
};

export default MobileCanvasFrame;
