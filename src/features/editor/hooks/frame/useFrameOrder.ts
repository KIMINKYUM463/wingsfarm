import { useCallback, useRef } from 'react';
import { generateKeyBetween } from 'fractional-indexing';
import { useCanvasDataStore, recordHistoryIfNeeded } from '@/features/editor/store/useCanvasDataStore';
import { useAutoSaveStore } from '@/features/editor/store/useAutoSaveStore';
import { useScrollToElement } from '@/features/editor/hooks/useScrollToElement';

interface UseFrameOrderParams {
  projectId: string;
  frameId?: string;
}

/**
 * 프레임 순서 관련 작업 (이동, 재정렬)
 *
 * ## 저장 전략
 * - Store만 업데이트 (불변성 유지)
 * - useAutoSave가 frameOrder 변경 감지 → 디바운스 저장
 * - 더 이상 직접 API 호출하지 않음
 */
export const useFrameOrder = ({ projectId, frameId }: UseFrameOrderParams) => {
  // 연속 클릭 방지용 ref (디바운싱)
  const isProcessingRef = useRef(false);
  const { scrollToFrameById } = useScrollToElement();

  // 프레임 위로 이동 (ghost 프레임 건너뛰고 다음 active 프레임과 교체)
  const handleMoveUp = useCallback(
    (targetFrameId?: string) => {
      const id = targetFrameId || frameId;
      if (!id || !projectId) return;

      // 연속 클릭 방지
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 100);

      const { frames } = useCanvasDataStore.getState();
      const currentIndex = frames.findIndex((f) => f.id === id);

      if (currentIndex <= 0) return;

      // 위쪽 첫 번째 active 프레임 찾기
      let targetIndex = -1;
      for (let i = currentIndex - 1; i >= 0; i--) {
        if (frames[i].status === 'active') {
          targetIndex = i;
          break;
        }
      }

      // active 프레임이 없으면 이동 불가
      if (targetIndex === -1) return;

      const targetFrame = frames[targetIndex];
      const beforeTargetFrame = frames[targetIndex - 1];

      const a = beforeTargetFrame?.frameOrder ?? null;
      const b = targetFrame.frameOrder ?? null;

      if (a !== null && b !== null && a >= b) {
        console.warn('[handleMoveUp] frameOrder 순서 오류 - 이동 불가:', { a, b });
        return;
      }

      const newFrameOrder = generateKeyBetween(a, b);

      // 히스토리 저장 (undo/redo 지원)
      recordHistoryIfNeeded();

      // 불변성 유지: 새 객체 생성
      const movedFrame = { ...frames[currentIndex], frameOrder: newFrameOrder };
      const newFrames = [...frames];
      newFrames.splice(currentIndex, 1);
      newFrames.splice(targetIndex, 0, movedFrame);

      // Store 업데이트 → useAutoSave가 감지 → 디바운스 저장
      useCanvasDataStore.setState({ frames: newFrames });
      useAutoSaveStore.getState().setPending();

      // 이동된 프레임으로 스크롤 (DOM 업데이트 후 실행, 위로 올라가는 느낌)
      requestAnimationFrame(() => {
        scrollToFrameById(id, { behavior: 'smooth', block: 'start' });
      });
    },
    [frameId, projectId, scrollToFrameById],
  );

  // 프레임 아래로 이동 (ghost 프레임 건너뛰고 다음 active 프레임과 교체)
  const handleMoveDown = useCallback(
    (targetFrameId?: string) => {
      const id = targetFrameId || frameId;
      if (!id || !projectId) return;

      // 연속 클릭 방지
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 100);

      const { frames } = useCanvasDataStore.getState();
      const currentIndex = frames.findIndex((f) => f.id === id);

      if (currentIndex === -1 || currentIndex >= frames.length - 1) return;

      // 아래쪽 첫 번째 active 프레임 찾기
      let targetIndex = -1;
      for (let i = currentIndex + 1; i < frames.length; i++) {
        if (frames[i].status === 'active') {
          targetIndex = i;
          break;
        }
      }

      // active 프레임이 없으면 이동 불가
      if (targetIndex === -1) return;

      const targetFrame = frames[targetIndex];
      const afterTargetFrame = frames[targetIndex + 1];

      const a = targetFrame.frameOrder ?? null;
      const b = afterTargetFrame?.frameOrder ?? null;

      if (a !== null && b !== null && a >= b) {
        console.warn('[handleMoveDown] frameOrder 순서 오류 - 이동 불가:', { a, b });
        return;
      }

      const newFrameOrder = generateKeyBetween(a, b);

      // 히스토리 저장 (undo/redo 지원)
      recordHistoryIfNeeded();

      // 불변성 유지: 새 객체 생성
      const movedFrame = { ...frames[currentIndex], frameOrder: newFrameOrder };
      const newFrames = [...frames];
      newFrames.splice(currentIndex, 1);
      newFrames.splice(targetIndex, 0, movedFrame);

      // Store 업데이트 → useAutoSave가 감지 → 디바운스 저장
      useCanvasDataStore.setState({ frames: newFrames });
      useAutoSaveStore.getState().setPending();

      // 이동된 프레임으로 스크롤 (DOM 업데이트 후 실행)
      requestAnimationFrame(() => {
        scrollToFrameById(id, { behavior: 'smooth', block: 'start' });
      });
    },
    [frameId, projectId, scrollToFrameById],
  );

  // 프레임 재정렬 (드래그 앤 드롭)
  const handleReorder = useCallback(
    (targetFrameId: string, oldIndex: number, newIndex: number) => {
      if (!projectId || oldIndex === newIndex) return;

      // 연속 호출 방지
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 100);

      const { frames } = useCanvasDataStore.getState();

      const movingDown = newIndex > oldIndex;
      const a = movingDown
        ? (frames[newIndex]?.frameOrder ?? null)
        : (frames[newIndex - 1]?.frameOrder ?? null);
      const b = movingDown
        ? (frames[newIndex + 1]?.frameOrder ?? null)
        : (frames[newIndex]?.frameOrder ?? null);

      if (a !== null && b !== null && a >= b) {
        console.warn('[handleReorder] ❌ frameOrder 순서 오류 - 재정렬 불가:', { a, b });
        return;
      }

      const newFrameOrder = generateKeyBetween(a, b);

      // 히스토리 저장 (undo/redo 지원)
      recordHistoryIfNeeded();

      // 불변성 유지: 새 객체 생성
      const movedFrame = { ...frames[oldIndex], frameOrder: newFrameOrder };
      const reorderedFrames = [...frames];
      reorderedFrames.splice(oldIndex, 1);
      reorderedFrames.splice(newIndex, 0, movedFrame);

      // Store 업데이트 → useAutoSave가 감지 → 디바운스 저장
      useCanvasDataStore.setState({ frames: reorderedFrames });
      useAutoSaveStore.getState().setPending();

      // 이동된 프레임으로 스크롤 (DOM 업데이트 후 실행)
      requestAnimationFrame(() => {
        scrollToFrameById(targetFrameId, { behavior: 'smooth', block: 'center' });
      });
    },
    [projectId, scrollToFrameById],
  );

  return {
    handleMoveUp,
    handleMoveDown,
    handleReorder,
  };
};
