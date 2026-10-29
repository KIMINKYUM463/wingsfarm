/**
 * useKonvaEvents.ts
 * Konva 이벤트 통합 관리 훅
 *
 * ## 책임
 * - 3개 독립 훅 통합 (선택, 드래그, 변형)
 * - Transformer/ElementRefs ref 생성
 *
 * ## 관심사 분리
 * - useKonvaSelection: 영역 선택 + 클릭 선택
 * - useKonvaDrag: 요소 드래그 이동
 * - useKonvaTransform: 크기/회전 조절
 * - useContextMenu: Context Menu (별도 훅)
 *
 * ## 최적화
 * - 선택 상태 구독 제거 → CanvasFrame 리렌더 방지
 * - Transformer 노드 동기화는 EditorTransformer에서 자체 처리
 */

import { useRef } from 'react';
import Konva from 'konva';
import { ElementRefs, TransformerRef } from '@/shared/types/konva-editor';
import { useKonvaSelection } from '@/features/editor/hooks/useKonvaSelection';
import { useKonvaDrag } from '@/features/editor/hooks/useKonvaDrag';
import { useKonvaTransform } from '@/features/editor/hooks/useKonvaTransform';

interface UseKonvaEventsOptions {
  /** 현재 프레임 ID */
  frameId?: string;
}

export const useKonvaEvents = (options: UseKonvaEventsOptions = {}) => {
  // 1. 선택 기능 (드래그 영역 선택 + 클릭 선택)
  const {
    selectionRect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleStageClick,
  } = useKonvaSelection({ frameId: options.frameId });

  // 2. 드래그 이동 기능
  const { handleDragStart, handleDragMove, handleDragEnd } = useKonvaDrag();

  // 3. 변형 기능 (크기/회전 조절)
  const { handleTransformStart, handleTransform, handleTransformEnd } = useKonvaTransform();

  // Transformer 및 ElementRefs ref만 생성 (노드 동기화는 EditorTransformer에서)
  const transformerRef: TransformerRef = useRef(null);
  const elementRefs: ElementRefs = useRef<Map<string, Konva.Node>>(new Map());

  return {
    // Selection
    selectionRect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleStageClick,

    // Drag
    handleDragStart,
    handleDragMove,
    handleDragEnd,

    // Transform
    handleTransformStart,
    handleTransform,
    handleTransformEnd,

    // Refs
    transformerRef,
    elementRefs,
  };
};
