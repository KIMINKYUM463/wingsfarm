import { useCallback } from 'react';
import Konva from 'konva';
import { ElementRefs } from '@/shared/types/konva-editor';

export const useElementRef = (elementRefs: ElementRefs) => {
  const createElementRef = useCallback(
    (elementId: string) => (node: Konva.Node | null) => {
      if (node) {
        elementRefs.current.set(elementId, node);
      } else {
        elementRefs.current.delete(elementId);
      }
    },
    [elementRefs],
  );

  return createElementRef;
};
