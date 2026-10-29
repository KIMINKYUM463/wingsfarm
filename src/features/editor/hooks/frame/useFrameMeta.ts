import { useCallback, useRef } from 'react';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useAutoSaveStore } from '@/features/editor/store/useAutoSaveStore';
import { hexToRgba } from '@/features/editor/lib/color-converter';

interface UseFrameMetaParams {
  projectId: string;
  frameId?: string;
}

/**
 * 프레임 메타데이터 관련 작업 (이름 변경, 배경색 변경)
 *
 * ## 저장 전략
 * - Store만 업데이트 (불변성 유지)
 * - useAutoSave가 name/fill 변경 감지 → 디바운스 저장
 * - 더 이상 직접 API 호출하지 않음
 */
export const useFrameMeta = ({ projectId, frameId }: UseFrameMetaParams) => {
  // 연속 호출 방지용 ref
  const isProcessingRef = useRef(false);

  // 프레임 이름 변경 핸들러
  const handleRename = useCallback(
    (newName: string, targetFrameId?: string) => {
      const id = targetFrameId || frameId;
      if (!id || !projectId) return;

      // 연속 호출 방지 (리렌더로 인한 중복 blur 방지)
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 100);

      const trimmed = newName.trim().slice(0, 30);

      // 빈값이면 저장하지 않음
      if (!trimmed) return;

      const { frames } = useCanvasDataStore.getState();
      const currentFrame = frames.find((f) => f.id === id);

      // 변경 없으면 스킵
      if (currentFrame?.name === trimmed) return;

      // 불변성 유지: 새 객체 생성
      const updatedFrames = frames.map((f) => (f.id === id ? { ...f, name: trimmed } : f));

      // Store 업데이트 → useAutoSave가 감지 → 디바운스 저장
      useCanvasDataStore.setState({ frames: updatedFrames });
      useAutoSaveStore.getState().setPending();
    },
    [frameId, projectId],
  );

  // 프레임 배경색 변경 핸들러 (로컬 상태만 - 자동 저장에서 서버 동기화)
  const handleFillChange = useCallback(
    (hexColor: string, targetFrameId?: string) => {
      const id = targetFrameId || frameId;
      if (!id) return;

      const rgbaColor = hexToRgba(hexColor);
      useCanvasDataStore.getState().updateElement(id, { fill: rgbaColor });
    },
    [frameId],
  );

  // 프레임 높이 변경 핸들러
  const handleHeightChange = useCallback(
    (height: number, targetFrameId?: string) => {
      const id = targetFrameId || frameId;
      if (!id || height <= 0) return;

      useCanvasDataStore.getState().updateElement(id, { height });
      useAutoSaveStore.getState().setPending();
    },
    [frameId],
  );

  return {
    handleRename,
    handleFillChange,
    handleHeightChange,
  };
};
