import { useCallback, useRef, useState } from 'react';
import Konva from 'konva';
import { useClearSelection } from '@/features/editor/store/useSelectionStore';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { KonvaTextElement } from '@/shared/types/konva';

export const useTextEditing = (
  element: KonvaTextElement,
  konvaTextRef: React.RefObject<Konva.Text | null>,
) => {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const clearSelection = useClearSelection();
  const { updateElement } = useElementStore();

  const handleTextDblClick = useCallback(() => {
    clearSelection();
    setIsEditing(true);
    konvaTextRef.current?.getLayer()?.batchDraw();

    // Html 컴포넌트가 DOM에 렌더링된 후 textarea 포커스 및 높이 조정
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.focus();
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }, 50);
  }, [clearSelection]);

  const handleEditClose = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleAutoGrow = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  const handleTextUpdate = useCallback(
    (newText: string, areaWidth: number) => {
      // textarea의 실제 높이를 먼저 가져옴 (handleEditClose 후 unmount되기 전에)
      const newHeight = textareaRef.current?.scrollHeight;

      handleEditClose();

      updateElement(element.id, {
        text: newText,
        width: areaWidth,
        ...(newHeight && { height: newHeight }),
      });
    },
    [element.id, handleEditClose, updateElement],
  );

  return {
    isEditing,
    textareaRef,
    handleTextDblClick,
    handleEditClose,
    handleAutoGrow,
    handleTextUpdate,
  };
};
