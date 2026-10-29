'use client';

import Konva from 'konva';
import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Rect, Group } from 'react-konva';
import useImage from 'use-image';
import { useShallow } from 'zustand/react/shallow';
import { KonvaRectElement } from '@/shared/types/konva';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useKonvaElementHandlers } from '@/features/editor/hooks/useKonvaElementHandlers';
import { useImagePattern } from '@/features/editor/hooks/useImagePattern';
import { ImageControlOverlay } from '@/features/editor/components/canvas/layout/ImageHoverLayout';
import { isImageElement, hasAssetImage } from '@/features/editor/lib/element-finder';
import SlotPlaceholder from './SlotPlaceholder';

interface KonvaRectProps {
  element: KonvaRectElement;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
  onTransformStart?: () => void;
  onTransform?: (e: KonvaEventObject<MouseEvent>) => void;
  onTransformEnd?: (e: KonvaEventObject<MouseEvent>) => void;
}

const KonvaRect = forwardRef<Konva.Rect, KonvaRectProps>(
  ({ element, onDragStart, onDragMove, onDragEnd, onTransformStart, onTransform, onTransformEnd }, ref) => {
    const { onClick } = useKonvaElementHandlers(element.id);
    const rectRef = useRef<Konva.Rect>(null);
    const isImage = isImageElement(element); // 이미지 교체 UI용 (_image만)
    const hasAsset = hasAssetImage(element); // 이미지 렌더링용 (_image, _graphic 모두)

    // store에서 직접 assetId와 imageUrl 구독 (중첩 프레임에서 props 업데이트 지연 문제 해결)
    // 하나의 selector로 합쳐서 타이밍 문제 방지, useShallow로 객체 비교 최적화
    const { storeAssetId, imageUrl } = useCanvasDataStore(
      useShallow((state) => {
        if (!hasAsset) return { storeAssetId: undefined, imageUrl: undefined };
        const el = state.flatElements.get(element.id);
        const aid = el && 'assetId' in el ? (el as { assetId?: string }).assetId : undefined;
        return {
          storeAssetId: aid,
          imageUrl: aid ? state.assetUrls[aid] : undefined,
        };
      }),
    );
    const [image] = useImage(imageUrl || '', 'anonymous');

    // ref 동기화
    useImperativeHandle(ref, () => rectRef.current!);

    const imagePattern = useImagePattern({ ...element, image: imageUrl ? image : undefined });

    // 이미지 요소 플레이스홀더 표시 조건 (이미지만, 그래픽은 항상 assetId 존재):
    // 1. assetId가 없는 경우 (이미지 미지정)
    // 2. assetId는 있지만 assetUrl이 아직 없는 경우 (템플릿 적용 직후 등)
    const showPlaceholder = isImage && (!storeAssetId || !imageUrl);

    return (
      <ImageControlOverlay element={element} elementRef={rectRef} onDragStart={onDragStart} onDragMove={onDragMove}>
          <Group>
            <Rect
              ref={rectRef}
              draggable={!!onDragEnd}
              onClick={onClick}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              onTransformStart={onTransformStart}
              onTransform={onTransform}
              onTransformEnd={onTransformEnd}
              // Common props
              id={element.id}
              name={element.name}
              x={element.x}
              y={element.y}
              opacity={element.opacity ?? 1}
              visible={element.visible !== false}
              rotation={element.rotation}
              // Offset props (회전 기준점 - Figma 중심점 회전 지원)
              offsetX={element.offsetX}
              offsetY={element.offsetY}
              // Scale props
              scaleX={element.scaleX ?? 1}
              scaleY={element.scaleY ?? 1}
              // Rect specific props
              width={element.width}
              height={element.height}
              cornerRadius={element.cornerRadius}
              // Fill props - imageUrl이 있으면 이미지 패턴 사용, 플레이스홀더면 #eaeaea
              fill={showPlaceholder ? '#eaeaea' : imageUrl ? undefined : element.fill}
              fillPriority={imageUrl ? undefined : element.fillPriority}
              fillLinearGradientStartPoint={
                imageUrl ? undefined : element.fillLinearGradientStartPoint
              }
              fillLinearGradientEndPoint={
                imageUrl ? undefined : element.fillLinearGradientEndPoint
              }
              fillLinearGradientColorStops={
                imageUrl ? undefined : element.fillLinearGradientColorStops
              }
              fillRadialGradientStartPoint={
                imageUrl ? undefined : element.fillRadialGradientStartPoint
              }
              fillRadialGradientEndPoint={
                imageUrl ? undefined : element.fillRadialGradientEndPoint
              }
              fillRadialGradientStartRadius={
                imageUrl ? undefined : element.fillRadialGradientStartRadius
              }
              fillRadialGradientEndRadius={
                imageUrl ? undefined : element.fillRadialGradientEndRadius
              }
              fillRadialGradientColorStops={
                imageUrl ? undefined : element.fillRadialGradientColorStops
              }
              // 사진 채우기 (맞춤·확대·위치·반전·흑백)
              {...imagePattern}
              // Stroke props
              stroke={element.stroke}
              strokeWidth={element.strokeWidth}
              // Shadow props
              shadowColor={element.shadowColor}
              shadowBlur={element.shadowBlur}
              shadowOffsetX={element.shadowOffsetX}
              shadowOffsetY={element.shadowOffsetY}
              shadowOpacity={element.shadowOpacity}
              shadowEnabled={element.shadowEnabled}
              // Performance: fill+stroke 동시 사용 시 2x draw 방지
              perfectDrawEnabled={false}
            />
            {showPlaceholder && (
              <SlotPlaceholder x={element.x} y={element.y} width={element.width} height={element.height} blank={!storeAssetId} />
            )}
          </Group>
      </ImageControlOverlay>
    );
  },
);

KonvaRect.displayName = 'KonvaRect';

export default React.memo(KonvaRect);
