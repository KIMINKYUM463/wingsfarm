'use client';

import Konva from 'konva';
import React, { forwardRef, useEffect, useMemo, useRef } from 'react';
import { Html } from 'react-konva-utils';
import { Text, Group, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { KonvaTextElement } from '@/shared/types/konva';
import { BORDER_STYLES } from '@/shared/constants/border';
import { useTextEditing } from '@/features/editor/hooks/useTextEditing';
import { useTextStyling } from '@/features/editor/hooks/useTextStyling';
import { useTextTransform } from '@/features/editor/hooks/useTextTransform';
import { useKonvaTextRef } from '@/features/editor/hooks/useKonvaTextRef';
import { useKonvaElementHandlers } from '@/features/editor/hooks/useKonvaElementHandlers';
import { useFontLoader } from '@/features/editor/hooks/useFontLoader';

interface KonvaTextProps {
  element: KonvaTextElement;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
  onTransformStart?: () => void;
  onTransform?: (e: KonvaEventObject<MouseEvent>) => void;
  onTransformEnd?: (e: KonvaEventObject<MouseEvent>) => void;
}

const KonvaText = forwardRef<Konva.Group, KonvaTextProps>(
  (
    { element, onDragStart, onDragMove, onDragEnd, onTransformStart, onTransform, onTransformEnd },
    ref,
  ) => {
    const { textRef, handleGroupRef, handleTextRef, groupRef } = useKonvaTextRef(ref);
    const { loadFontWithWeight } = useFontLoader();

    // 이전 store 위치 추적 → 실제 위치 변경 감지 (undo/redo, 드래그 종료 등)
    const prevPosition = useRef<{ x: number; y: number } | null>(null);

    // store 위치가 실제로 변경된 경우에만 store 값 사용
    // 텍스트 수정 등 위치 변경 없는 리렌더링에서는 Konva 노드의 현재 위치 유지
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

    // Konva fontStyle: fontStyle + fontWeight 합성 (예: 'italic 700', '500')
    const konvaFontStyle = useMemo(() => {
      const style = element.fontStyle || 'normal';
      const weight = element.fontWeight || 400;
      const hasItalic = style.includes('italic');

      if (weight === 400) return hasItalic ? 'italic' : 'normal';
      return hasItalic ? `italic ${weight}` : String(weight);
    }, [element.fontStyle, element.fontWeight]);

    // 폰트 로드 (초기 마운트, 템플릿 로드 시 필요)
    useEffect(() => {
      let isCancelled = false;

      const loadFont = async () => {
        const success = await loadFontWithWeight(element.fontFamily, element.fontWeight || 400);
        if (isCancelled || !success) return;

        // 폰트 로드 후 캔버스 갱신
        textRef.current?.getLayer()?.batchDraw();
      };

      loadFont();

      return () => {
        isCancelled = true;
      };
    }, [element.fontFamily, element.fontWeight, loadFontWithWeight]);

    const { isEditing, textareaRef, handleTextDblClick, handleAutoGrow, handleTextUpdate } =
      useTextEditing(element, textRef);
    const { getGradientStyle } = useTextStyling(element);
    const { handleTransform: handleTextTransform } = useTextTransform(textRef);
    const { onClick } = useKonvaElementHandlers(element.id);

    // Text 내부 transform 핸들러 + 외부 가이드라인 핸들러 결합
    const handleTransformCombined = (e: KonvaEventObject<Event>) => {
      handleTextTransform();
      onTransform?.(e as KonvaEventObject<MouseEvent>);
    };

    // 편집 모드에서 사용할 크기 (textRef가 있을 때만 접근)
    const textWidth = textRef.current?.width() || element.width || 100;
    const textHeight = textRef.current?.height() || element.height || 20;

    return (
      <Group
        ref={handleGroupRef}
        // ID & Name - Group에서 관리 (Transformer 연결용)
        id={element.id}
        name={element.name}
        // Transform props - Group에서 관리
        // store 위치 변경 시만 동기화, 그 외엔 Konva 노드 위치 유지
        x={currentX}
        y={currentY}
        rotation={element.rotation}
        offsetX={element.offsetX}
        offsetY={element.offsetY}
        scaleX={element.scaleX ?? 1}
        scaleY={element.scaleY ?? 1}
        opacity={element.opacity ?? 1}
        // Drag & event props
        draggable={!!onDragEnd}
        onClick={onClick}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onTransformStart={onTransformStart}
        onTransformEnd={onTransformEnd}
        onTransform={handleTransformCombined}
      >
        {/* 배경색 + hover 테두리용 Rect (useKonvaHover가 Text의 앞 형제 Rect를 찾음) */}
        <Rect
          x={0}
          y={0}
          width={element.width}
          height={element.height}
          fill={element.backgroundColor || 'transparent'}
          listening={false}
        />
        <Text
          ref={handleTextRef}
          onDblClick={handleTextDblClick}
          onDblTap={handleTextDblClick}
          visible={!isEditing}
          // Position - Group 내부에서 0,0
          x={0}
          y={0}
          // Text specific props
          text={element.text}
          fontSize={element.fontSize}
          fontFamily={element.fontFamily}
          fontStyle={konvaFontStyle}
          align={element.align}
          verticalAlign={element.verticalAlign}
          lineHeight={element.lineHeight}
          letterSpacing={element.letterSpacing}
          wrap={element.wrap}
          ellipsis={element.ellipsis}
          padding={element.padding}
          width={element.width}
          height={element.height}
          textDecoration={element.textDecoration}
          // Fill props
          fill={element.fill}
          fillPriority={element.fillPriority}
          fillLinearGradientStartPoint={element.fillLinearGradientStartPoint}
          fillLinearGradientEndPoint={element.fillLinearGradientEndPoint}
          fillLinearGradientColorStops={element.fillLinearGradientColorStops}
          fillRadialGradientStartPoint={element.fillRadialGradientStartPoint}
          fillRadialGradientEndPoint={element.fillRadialGradientEndPoint}
          fillRadialGradientStartRadius={element.fillRadialGradientStartRadius}
          fillRadialGradientEndRadius={element.fillRadialGradientEndRadius}
          fillRadialGradientColorStops={element.fillRadialGradientColorStops}
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
        {isEditing && (
          <Html
            divProps={{
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${textWidth}px`,
                height: 'auto',
              },
            }}
          >
            <textarea
              ref={textareaRef}
              defaultValue={element.text}
              onInput={handleAutoGrow}
              onKeyDown={(e) => {
                // Escape: 편집 종료
                if (e.key === 'Escape') {
                  handleTextUpdate((e.target as HTMLTextAreaElement).value, textWidth);
                }
              }}
              onBlur={(e) => {
                handleTextUpdate((e.target as HTMLTextAreaElement).value, textWidth);
              }}
              style={{
                position: 'relative',
                width: '100%',
                height: `${textHeight}px`,
                background: element.backgroundColor || 'transparent',
                border: 'none',
                outline: `${BORDER_STYLES.EDITING.width}px solid ${BORDER_STYLES.EDITING.color}`,
                resize: 'none',
                fontWeight: element.fontWeight || 400,
                fontStyle: element.fontStyle?.includes('italic') ? 'italic' : 'normal',
                fontFamily: element.fontFamily || 'Arial',
                fontSize: `${element.fontSize || 16}px`,
                lineHeight: element.lineHeight || 1.2,
                letterSpacing: `${element.letterSpacing ?? 0}px`,
                padding: `${element.padding ?? 0}px`,
                textDecoration: element.textDecoration || 'none',
                opacity: element.opacity ?? 1,
                textAlign: (element.align || 'left') as 'left' | 'center' | 'right',
                overflow: 'hidden',
                ...getGradientStyle(),
                caretColor: '#000',
              }}
            />
          </Html>
        )}
      </Group>
    );
  },
);

KonvaText.displayName = 'KonvaText';

export default React.memo(KonvaText);
