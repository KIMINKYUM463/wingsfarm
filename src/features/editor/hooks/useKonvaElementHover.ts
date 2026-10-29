import { useState, useCallback, useMemo } from 'react';

export default function useKonvaElementHover(
  elementId: string,
  defaultStroke = '#4A90E2',
  idleStroke = 'transparent',
) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const onHover = useCallback(() => {
    setHoveredId(elementId);
    document.body.style.cursor = 'move';
  }, [elementId]);

  const onLeave = useCallback(() => {
    setHoveredId(null);
    document.body.style.cursor = 'default';
  }, []);

  const isHovered = useMemo(() => hoveredId === elementId, [hoveredId, elementId]);

  const hoverProps = useMemo(
    () => ({
      stroke: isHovered ? defaultStroke : idleStroke,
      strokeWidth: 2,
      onMouseEnter: onHover,
      onMouseLeave: onLeave,
    }),
    [isHovered, defaultStroke, idleStroke, onHover, onLeave],
  );

  return {
    hoverProps,
    isHovered,
    onMouseEnter: onHover,
    onMouseLeave: onLeave,
  };
}
