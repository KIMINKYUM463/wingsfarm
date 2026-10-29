import { useCallback, useRef } from 'react';
import Konva from 'konva';

/**
 * KonvaText용 ref 관리 훅
 * Group과 Text 모두에 대한 ref를 관리
 *
 * @param externalRef - 외부에서 전달받은 Group ref (forwardRef용)
 */
export const useKonvaTextRef = (externalRef?: React.Ref<Konva.Group>) => {
  const groupRef = useRef<Konva.Group>(null);
  const textRef = useRef<Konva.Text>(null);

  // Group ref 핸들러 (외부 ref 연결)
  const handleGroupRef = useCallback(
    (node: Konva.Group | null) => {
      groupRef.current = node;
      if (typeof externalRef === 'function') {
        externalRef(node);
      } else if (externalRef && 'current' in externalRef) {
        (externalRef as React.MutableRefObject<Konva.Group | null>).current = node;
      }
    },
    [externalRef],
  );

  // Text ref 핸들러 (내부용)
  const handleTextRef = useCallback((node: Konva.Text | null) => {
    textRef.current = node;
  }, []);

  return {
    groupRef,
    textRef,
    handleGroupRef,
    handleTextRef,
  };
};
