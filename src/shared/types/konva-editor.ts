import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { KonvaFrameElement, KonvaGroupElement } from '@/shared/types/konva';

// Element refs 타입 - Konva 노드들을 Map으로 관리
export type ElementRefs = React.MutableRefObject<Map<string, Konva.Node>>;

// Transformer ref 타입 - Konva Transformer 컴포넌트 참조
export type TransformerRef = React.RefObject<Konva.Transformer | null>;

// Selection rectangle 타입 - 선택 영역 상태
export interface SelectionRect {
  visible: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// KonvaElementRenderer props 타입
export interface KonvaElementRendererProps {
  element: KonvaFrameElement | KonvaGroupElement;
  elementRefs: ElementRefs;
  transformerRef: TransformerRef;
  selectionRect: SelectionRect;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
  onTransformStart?: () => void;
  onTransform?: (e: KonvaEventObject<MouseEvent>) => void;
  onTransformEnd?: (e: KonvaEventObject<MouseEvent>) => void;
}
