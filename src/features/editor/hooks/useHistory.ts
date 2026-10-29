/**
 * useHistory.ts
 * 에디터 Undo/Redo 통합 훅
 *
 * ## 사용법
 * - saveHistory(): 현재 상태를 히스토리에 저장 (변경 완료 시 호출)
 * - undo(): 이전 상태로 복원
 * - redo(): 다음 상태로 복원
 * - initializeHistory(): 에디터 초기화 시 호출
 */

import { useCallback } from 'react';
import { useHistoryStore } from '@/features/editor/store/useHistoryStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useSelectionStore } from '@/features/editor/store/useSelectionStore';

export const useHistory = () => {
  const historyUndo = useHistoryStore((state) => state.undo);
  const historyRedo = useHistoryStore((state) => state.redo);
  const pushHistory = useHistoryStore((state) => state.pushHistory);
  const initHistory = useHistoryStore((state) => state.initHistory);

  // 반응형 상태 구독 (함수 대신 실제 값 사용)
  const historyStep = useHistoryStore((state) => state.historyStep);
  const historyLength = useHistoryStore((state) => state.history.length);

  const frames = useCanvasDataStore((state) => state.frames);
  const restoreFromHistory = useCanvasDataStore((state) => state.restoreFromHistory);

  const clearSelection = useSelectionStore((state) => state.clearSelection);

  /** 현재 frames 상태를 히스토리에 저장 */
  const saveHistory = useCallback(() => {
    pushHistory(frames);
  }, [pushHistory, frames]);

  /** 초기 상태 저장 (에디터 로드 완료 시 호출) */
  const initializeHistory = useCallback(() => {
    initHistory(frames);
  }, [initHistory, frames]);

  /** Undo - 이전 상태로 복원 */
  const undo = useCallback(() => {
    const previousFrames = historyUndo();
    if (previousFrames) {
      restoreFromHistory(previousFrames);
      clearSelection();
    }
  }, [historyUndo, restoreFromHistory, clearSelection]);

  /** Redo - 다음 상태로 복원 */
  const redo = useCallback(() => {
    const nextFrames = historyRedo();
    if (nextFrames) {
      restoreFromHistory(nextFrames);
      clearSelection();
    }
  }, [historyRedo, restoreFromHistory, clearSelection]);

  return {
    saveHistory,
    initializeHistory,
    undo,
    redo,
    canUndo: historyStep > 0,
    canRedo: historyStep < historyLength - 1,
  };
};
