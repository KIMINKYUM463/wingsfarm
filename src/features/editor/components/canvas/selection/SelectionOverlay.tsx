/**
 * SelectionOverlay.tsx
 * Transformer 상단에 표시되는 선택 UI (RotateHandle + SelectionToolbox)
 */

'use client';

import React, { useMemo, useCallback } from 'react';
import { Html } from 'react-konva-utils';
import type { TransformerRef, ElementRefs } from '@/shared/types/konva-editor';
import Button from '@/shared/ui/Button/Button';
import Icon from '@/shared/ui/Icon';
import ActionTooltip from '@/shared/ui/Tooltip/ActionTooltip';
import { useElementStore } from '@/features/editor/store/useElementStore';
import {
  useTextToggleState,
  useSetTextToggleState,
} from '@/features/editor/store/useToolPanelStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useSelectedItems, useIsDragging } from '@/features/editor/store/useSelectionStore';
import { useTransformerPosition } from '@/features/editor/hooks/useTransformerPosition';
import { useRotateHandle } from '@/features/editor/hooks/useRotateHandle';
import { findElementById, findParentFrame } from '@/features/editor/lib/element-finder';
import { isKonvaContainerElement } from '@/shared/types/konva';
import { TEXT_TOGGLE_STATES } from '@/shared/types/editor/textToggle';
import CommonIconToggleGroup from '@/shared/ui/Toggle/IconToggleGroup';
import CustomIcon from '@/shared/ui/CustomIcon';
import TextGeneratorForm from '@/features/editor/components/panel/text/TextGeneratorForm';

// ===== Constants =====
const ROTATE_BUTTON_HEIGHT = 42;
const GAP = 8;
const TOOLBOX_WIDTH = {
  DEFAULT: '126px', // 3개 버튼 (복제, 삭제, 더보기)
  WITH_EXTRA: '168px', // 4개 버튼 (그룹/언그룹 또는 AI 생성기 추가)
  GENERATOR: '524px',
} as const;

// ===== Types =====
interface SelectionOverlayProps {
  frameId: string;
  transformerRef: TransformerRef;
  elementRefs: ElementRefs;
  onOpenContextMenu?: (x: number, y: number, targetId: string) => void;
}

interface RotateButtonProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

// ===== Sub Components =====
const RotateButton = React.memo(({ onMouseDown, onTouchStart }: RotateButtonProps) => (
  <ActionTooltip content="회전" direction="top">
    <Button
      className="btn-white h-(--btn-h) w-(--btn-h) border border-gray-100 shadow-(--shadow-1)"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      style={{ cursor: 'grab', touchAction: 'none' }}
    >
      <Icon name="refresh" height={24} width={24} />
    </Button>
  </ActionTooltip>
));
RotateButton.displayName = 'RotateButton';

// ===== Main Component =====
const SelectionOverlayComponent = ({
  frameId,
  transformerRef,
  elementRefs,
  onOpenContextMenu,
}: SelectionOverlayProps) => {
  // Stores - 개별 action 선택으로 불필요한 리렌더링 방지
  const selectedItems = useSelectedItems();
  const isDragging = useIsDragging();
  const deleteElement = useElementStore((state) => state.deleteElement);
  const duplicateElement = useElementStore((state) => state.duplicateElement);
  const duplicateElements = useElementStore((state) => state.duplicateElements);
  const createGroup = useElementStore((state) => state.createGroup);
  const ungroupElements = useElementStore((state) => state.ungroupElements);
  const textToggleState = useTextToggleState();
  const setTextToggleState = useSetTextToggleState();
  const frames = useCanvasDataStore((state) => state.frames);

  // 현재 프레임의 선택된 요소 ID
  const selectedIds = useMemo(
    () => selectedItems.filter((item) => item.rootId === frameId).map((item) => item.id),
    [selectedItems, frameId],
  );

  // Early return: 선택 없으면 훅 호출 최소화
  const hasSelection = selectedIds.length > 0;
  const firstSelectedId = selectedIds[0];

  // Transformer 위치 (선택 있을 때만 유효)
  const { topY, centerX } = useTransformerPosition(transformerRef, selectedIds);

  // 회전 핸들
  const { handleRotateStart, handleTouchStart, isRotating } = useRotateHandle(
    transformerRef,
    selectedIds,
    elementRefs,
  );

  // 선택된 첫 번째 요소 정보
  const selectedElementInfo = useMemo(() => {
    if (!firstSelectedId || !frames) return null;
    const element = findElementById(frames, firstSelectedId);
    if (!element) return null;
    return {
      id: element.id,
      type: element.type,
      isGroup: isKonvaContainerElement(element),
      frameData: element.type === 'text' ? findParentFrame(frames, element.id) : null,
    };
  }, [frames, firstSelectedId]);

  // 선택 상태 플래그 (단순 계산 - 렌더링 시점에 평가)
  const isSingleText = selectedIds.length === 1 && selectedElementInfo?.type === 'text';
  const isMultiSelection = selectedIds.length >= 2;
  const isSingleGroup = selectedIds.length === 1 && selectedElementInfo?.isGroup === true;
  const isGeneratorOpen = isSingleText && textToggleState === TEXT_TOGGLE_STATES.GENERATOR;
  const showGroupButton = isMultiSelection || isSingleGroup;

  // 툴박스 너비 (메모이제이션)
  const toolboxWidth = useMemo(() => {
    if (isGeneratorOpen) return TOOLBOX_WIDTH.GENERATOR;
    if (isSingleText || showGroupButton) return TOOLBOX_WIDTH.WITH_EXTRA;
    return TOOLBOX_WIDTH.DEFAULT;
  }, [isGeneratorOpen, isSingleText, showGroupButton]);

  // 스타일 (각각 독립적으로 계산 - dependency 체인 단순화)
  const rotateHandleStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: `${topY - ROTATE_BUTTON_HEIGHT - GAP}px`,
      left: `${centerX}px`,
      transform: 'translateX(-50%)',
      pointerEvents: 'auto' as const,
    }),
    [topY, centerX],
  );

  const toolboxStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: `${topY}px`,
      left: `${centerX}px`,
      transform: 'translateX(-50%)',
      pointerEvents: 'auto' as const,
    }),
    [topY, centerX],
  );

  // 핸들러
  const handleDuplicate = useCallback(() => {
    if (selectedIds.length === 1) {
      duplicateElement(selectedIds[0]);
    } else {
      duplicateElements(selectedIds);
    }
  }, [selectedIds, duplicateElement, duplicateElements]);

  const handleDelete = useCallback(() => {
    selectedIds.forEach((id) => deleteElement(id));
  }, [selectedIds, deleteElement]);

  const handleMoreClick = useCallback(
    (_index: number, _isActive: boolean, e: React.MouseEvent) => {
      if (onOpenContextMenu && firstSelectedId) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onOpenContextMenu(rect.left + rect.width / 2, rect.bottom, firstSelectedId);
      }
    },
    [onOpenContextMenu, firstSelectedId],
  );

  const handleGroup = useCallback(() => {
    if (selectedIds.length >= 2) createGroup(frameId, selectedIds);
  }, [frameId, selectedIds, createGroup]);

  const handleUngroup = useCallback(() => {
    if (firstSelectedId && selectedElementInfo?.isGroup) ungroupElements(firstSelectedId);
  }, [firstSelectedId, selectedElementInfo?.isGroup, ungroupElements]);

  // 텍스트 생성기 토글 핸들러 (인라인 함수 방지)
  const handleOpenGenerator = useCallback(() => {
    setTextToggleState(TEXT_TOGGLE_STATES.GENERATOR);
  }, [setTextToggleState]);

  // 버튼 배열
  const buttons = useMemo(() => {
    const groupButton = isMultiSelection
      ? {
          customIcon: <CustomIcon name="group" width={24} height={24} />,
          onClick: handleGroup,
          tooltip: '그룹',
        }
      : isSingleGroup
        ? {
            customIcon: <CustomIcon name="ungroup" width={24} height={24} />,
            onClick: handleUngroup,
            tooltip: '그룹 해제',
          }
        : null;

    const baseButtons = [
      ...(groupButton ? [groupButton] : []),
      { iconName: 'library_add' as const, onClick: handleDuplicate, tooltip: '복제' },
      { iconName: 'delete' as const, onClick: handleDelete, tooltip: '삭제' },
      { iconName: 'more_horiz' as const, onClick: handleMoreClick, tooltip: '더보기' },
    ];

    if (!isSingleText) return baseButtons;

    return [
      {
        customIcon: <CustomIcon name="union" width={24} height={24} />,
        onClick: handleOpenGenerator,
        tooltip: 'AI 카피라이팅',
      },
      ...baseButtons,
    ];
  }, [
    isMultiSelection,
    isSingleGroup,
    isSingleText,
    handleGroup,
    handleUngroup,
    handleDuplicate,
    handleDelete,
    handleMoreClick,
    handleOpenGenerator,
  ]);

  // 렌더링 조건
  const shouldHide =
    !hasSelection ||
    !transformerRef.current ||
    (topY === 0 && centerX === 0) ||
    isDragging ||
    isRotating;

  if (shouldHide) return null;

  return (
    <>
      <Html divProps={{ style: rotateHandleStyle }}>
        <RotateButton onMouseDown={handleRotateStart} onTouchStart={handleTouchStart} />
      </Html>

      <Html divProps={{ style: toolboxStyle }}>
        <div style={{ width: toolboxWidth }}>
          {isGeneratorOpen && selectedElementInfo?.frameData ? (
            <TextGeneratorForm
              elementId={selectedElementInfo.id}
              frameData={selectedElementInfo.frameData}
            />
          ) : (
            <CommonIconToggleGroup className="shadow-(--shadow)" items={buttons} />
          )}
        </div>
      </Html>
    </>
  );
};

export const SelectionOverlay = React.memo(SelectionOverlayComponent);
