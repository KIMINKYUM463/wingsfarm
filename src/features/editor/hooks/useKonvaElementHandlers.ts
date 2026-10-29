import { useCallback } from 'react';
import Konva from 'konva';
import { useModeStore } from '@/features/editor/store/useModeStore';
import { useElementStore } from '@/features/editor/store/useElementStore';

/**
 * Konva 요소에 필요한 모든 이벤트 핸들러를 제공하는 커스텀 훅입니다.
 *
 * 주의: onClick은 빈 핸들러입니다.
 * 선택 로직은 Stage의 handleStageClick(useKonvaSelection)에서 중앙 관리합니다.
 * 이벤트가 버블링되어 Stage까지 전달되면 handleStageClick이 단일/다중 선택을 처리합니다.
 */
export const useKonvaElementHandlers = (elementId: string) => {
  const { setHover, startEdit } = useModeStore();
  const { updateElement } = useElementStore();

  // onClick은 빈 핸들러 - 선택은 Stage의 handleStageClick에서 처리
  // 이렇게 하면 Shift/Ctrl+클릭 다중 선택이 정상 동작함
  const handleClick = useCallback(() => {
    // 의도적으로 비워둠: 선택은 useKonvaSelection.handleStageClick에서 처리
  }, []);

  const handleDragStart = useCallback(() => {
    // 드래그 시작 시 특별한 상태 변경 불필요
  }, []);

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      updateElement(elementId, {
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    [elementId, updateElement],
  );

  // 더블클릭: 텍스트 편집 진입 (그룹 내부 진입은 useKonvaSelection에서 처리)
  const handleDblClick = useCallback(() => {
    startEdit(elementId);
  }, [elementId, startEdit]);

  const handleDblTap = useCallback(() => {
    startEdit(elementId);
  }, [elementId, startEdit]);

  const handleMouseOver = useCallback(() => {
    setHover(elementId);
  }, [elementId, setHover]);

  const handleMouseOut = useCallback(() => {
    setHover(null);
  }, [setHover]);

  const handleTransform = useCallback((e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const newWidth = node.width() * scaleX;

    node.setAttrs({
      width: newWidth,
      scaleX: 1,
    });
  }, []);

  return {
    onClick: handleClick,
    onDblClick: handleDblClick,
    onDblTap: handleDblTap,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onMouseOver: handleMouseOver,
    onMouseOut: handleMouseOut,
    onTransform: handleTransform,
  };
};
