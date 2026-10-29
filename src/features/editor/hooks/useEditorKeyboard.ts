/**
 * useEditorKeyboard.ts
 * 에디터 키보드 단축키 처리
 *
 * ## 단축키 (Mac/Windows 공통)
 * | 키 조합 | 기능 |
 * |---------|------|
 * | Escape | 그룹 모드 탈출 / 선택 해제 |
 * | Delete / Backspace | 선택 요소 삭제 |
 * | Cmd/Ctrl + C | 복사 |
 * | Cmd/Ctrl + V | 붙여넣기 |
 * | Cmd/Ctrl + D | 복제 |
 * | Cmd/Ctrl + G | 그룹 생성 |
 * | Cmd/Ctrl + Shift + G | 그룹 해제 |
 * | Cmd/Ctrl + Z | Undo |
 * | Cmd/Ctrl + Shift + Z | Redo |
 * | Cmd/Ctrl + Y | Redo (Windows) |
 * | Cmd/Ctrl + ] | 레이어 앞으로 |
 * | Cmd/Ctrl + [ | 레이어 뒤로 |
 * | Cmd/Ctrl + Alt + ] | 레이어 맨 앞으로 (Canva 스타일) |
 * | Cmd/Ctrl + Alt + [ | 레이어 맨 뒤로 (Canva 스타일) |
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useSelectionStore } from '@/features/editor/store/useSelectionStore';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useModeStore } from '@/features/editor/store/useModeStore';
import { useClipboardStore } from '@/features/editor/store/useClipboardStore';
import { useHistory } from '@/features/editor/hooks/useHistory';
import { getCenteredFrameId } from '@/features/editor/lib/centered-frame';

// ============================================================
// Types
// ============================================================

interface KeyboardContext {
  isModKey: boolean;
  isShiftKey: boolean;
  isAltKey: boolean;
}

type ShortcutHandler = (ctx: KeyboardContext) => boolean;

// ============================================================
// Helpers
// ============================================================

const isInputElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
};

// ============================================================
// Hook
// ============================================================

export const useEditorKeyboard = () => {
  // Store selectors
  const groupMode = useSelectionStore((s) => s.groupMode);
  const exitGroupMode = useSelectionStore((s) => s.exitGroupMode);
  const selectedItems = useSelectionStore((s) => s.selectedItems);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const deleteElement = useElementStore((s) => s.deleteElement);
  const createGroup = useElementStore((s) => s.createGroup);
  const ungroupElements = useElementStore((s) => s.ungroupElements);
  const getElement = useElementStore((s) => s.getElement);
  const duplicateElements = useElementStore((s) => s.duplicateElements);
  const moveElementsToTop = useElementStore((s) => s.moveElementsToTop);
  const moveElementsUp = useElementStore((s) => s.moveElementsUp);
  const moveElementsDown = useElementStore((s) => s.moveElementsDown);
  const moveElementsToBottom = useElementStore((s) => s.moveElementsToBottom);
  const editingElementId = useModeStore((s) => s.editingElementId);
  const copyToClipboard = useClipboardStore((s) => s.copy);
  const { undo, redo } = useHistory();

  // Shortcut handlers
  const handleEscape = useCallback((): boolean => {
    if (groupMode.active) {
      exitGroupMode();
      return true;
    }
    if (selectedItems.length > 0) {
      clearSelection();
      return true;
    }
    return false;
  }, [groupMode.active, exitGroupMode, selectedItems.length, clearSelection]);

  const handleDelete = useCallback((): boolean => {
    if (selectedItems.length === 0) return false;
    selectedItems.forEach((item) => deleteElement(item.id));
    clearSelection();
    return true;
  }, [selectedItems, deleteElement, clearSelection]);

  const handleGroup = useCallback(
    ({ isModKey, isShiftKey }: KeyboardContext): boolean => {
      if (!isModKey) return false;

      // Cmd/Ctrl+G는 항상 브라우저 기본 동작(Find Next) 방지
      if (isShiftKey) {
        // Ungroup
        if (selectedItems.length !== 1) return true; // preventDefault만 수행
        const element = getElement(selectedItems[0].id);
        if (element?.type !== 'group') return true;
        ungroupElements(selectedItems[0].id);
        clearSelection();
        return true;
      }

      // Group
      if (selectedItems.length < 2) return true;
      // 모든 요소가 같은 프레임에 있는지 확인
      const frameIds = new Set(selectedItems.map((item) => item.rootId));
      if (frameIds.size !== 1) return true;
      const frameId = selectedItems[0]?.rootId;
      if (!frameId) return true;
      createGroup(
        frameId,
        selectedItems.map((item) => item.id),
      );
      return true;
    },
    [selectedItems, getElement, ungroupElements, clearSelection, createGroup],
  );

  const handleUndo = useCallback(
    ({ isModKey, isShiftKey }: KeyboardContext): boolean => {
      if (!isModKey) return false;
      if (isShiftKey) {
        redo();
      } else {
        undo();
      }
      return true;
    },
    [undo, redo],
  );

  const handleRedo = useCallback(
    ({ isModKey }: KeyboardContext): boolean => {
      if (!isModKey) return false;
      redo();
      return true;
    },
    [redo],
  );

  const handleCopy = useCallback(
    ({ isModKey }: KeyboardContext): boolean => {
      if (!isModKey) return false;
      if (selectedItems.length === 0) return false;

      const frameId = selectedItems[0]?.rootId;
      if (!frameId) return false;

      const elementsToCopy = selectedItems
        .map((item) => getElement(item.id))
        .filter((el): el is NonNullable<typeof el> => el !== undefined);

      if (elementsToCopy.length > 0) {
        copyToClipboard(elementsToCopy, frameId);
      }
      return true;
    },
    [selectedItems, getElement, copyToClipboard],
  );

  const handlePaste = useCallback(
    ({ isModKey }: KeyboardContext): boolean => {
      if (!isModKey) return false;

      const { copiedElements, sourceFrameId } = useClipboardStore.getState();
      if (copiedElements.length === 0) return false;

      const { selectedItems } = useSelectionStore.getState();
      // 우선순위: 선택된 요소의 프레임 → 현재 보고 있는 프레임 → 복사 원본 프레임
      const frameId = selectedItems[0]?.rootId || getCenteredFrameId() || sourceFrameId;
      if (!frameId) return false;

      useElementStore.getState().pasteElements(frameId, copiedElements);
      return true;
    },
    [],
  );

  const handleDuplicate = useCallback(
    ({ isModKey }: KeyboardContext): boolean => {
      if (!isModKey) return false;
      if (selectedItems.length === 0) return false;

      duplicateElements(selectedItems.map((item) => item.id));
      return true;
    },
    [selectedItems, duplicateElements],
  );

  // 레이어 순서 변경: Cmd+] (앞으로), Cmd+Alt+] (맨 앞으로) - Canva 스타일
  const handleLayerForward = useCallback(
    ({ isModKey, isAltKey }: KeyboardContext): boolean => {
      if (!isModKey) return false;
      if (selectedItems.length === 0) return false;

      const elementIds = selectedItems.map((item) => item.id);
      if (isAltKey) {
        moveElementsToTop(elementIds);
      } else {
        moveElementsUp(elementIds);
      }
      return true;
    },
    [selectedItems, moveElementsToTop, moveElementsUp],
  );

  // 레이어 순서 변경: Cmd+[ (뒤로), Cmd+Alt+[ (맨 뒤로) - Canva 스타일
  const handleLayerBackward = useCallback(
    ({ isModKey, isAltKey }: KeyboardContext): boolean => {
      if (!isModKey) return false;
      if (selectedItems.length === 0) return false;

      const elementIds = selectedItems.map((item) => item.id);
      if (isAltKey) {
        moveElementsToBottom(elementIds);
      } else {
        moveElementsDown(elementIds);
      }
      return true;
    },
    [selectedItems, moveElementsToBottom, moveElementsDown],
  );

  // Shortcut mapping (key → handler)
  const shortcuts = useMemo<Record<string, ShortcutHandler>>(
    () => ({
      escape: () => handleEscape(),
      delete: () => handleDelete(),
      backspace: () => handleDelete(),
      c: handleCopy,
      v: handlePaste,
      d: handleDuplicate,
      g: handleGroup,
      z: handleUndo,
      y: handleRedo,
      ']': handleLayerForward,
      '[': handleLayerBackward,
    }),
    [handleEscape, handleDelete, handleCopy, handlePaste, handleDuplicate, handleGroup, handleUndo, handleRedo, handleLayerForward, handleLayerBackward],
  );

  // Event listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isModKey = e.ctrlKey || e.metaKey;

      // 브라우저 기본 동작 즉시 방지 (early return 전에 실행)
      // - Cmd+G: Find Next
      // - Cmd+[: 뒤로 가기
      // - Cmd+]: 앞으로 가기
      if ((key === 'g' || key === '[' || key === ']') && isModKey) {
        e.preventDefault();
      }

      if (editingElementId) return;
      if (isInputElement(e.target)) return;

      const handler = shortcuts[key];
      if (!handler) return;

      const ctx: KeyboardContext = {
        isModKey,
        isShiftKey: e.shiftKey,
        isAltKey: e.altKey,
      };

      if (handler(ctx)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingElementId, shortcuts]);
};
