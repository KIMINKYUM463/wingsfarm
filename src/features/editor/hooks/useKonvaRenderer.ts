import { useMemo } from 'react';
import { KonvaEventObject } from 'konva/lib/Node';
import { useElementRef } from './useElementRef';
import { ElementRefs } from '@/shared/types/konva-editor';

interface UseKonvaRendererProps {
  elementRefs: ElementRefs;
  onDragStart?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (e: KonvaEventObject<MouseEvent>) => void;
  onTransformStart?: () => void;
  onTransform?: (e: KonvaEventObject<MouseEvent>) => void;
  onTransformEnd?: (e: KonvaEventObject<MouseEvent>) => void;
}

export const useKonvaRenderer = ({
  elementRefs,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTransformStart,
  onTransform,
  onTransformEnd,
}: UseKonvaRendererProps) => {
  const createElementRef = useElementRef(elementRefs);

  // 공통 props를 메모화
  const createElementProps = useMemo(() => {
    return (elementId: string) => ({
      ref: createElementRef(elementId),
      onDragStart,
      onDragMove,
      onDragEnd,
      onTransformStart,
      onTransform,
      onTransformEnd,
    });
  }, [createElementRef, onDragStart, onDragMove, onDragEnd, onTransformStart, onTransform, onTransformEnd]);

  return {
    createElementProps,
  };
};