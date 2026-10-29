import type { QueryClient } from '@tanstack/react-query';
import { uploadThumbnailAndInvalidate } from '@/features/editor/lib/thumbnail';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useAutoSaveStore } from '@/features/editor/store/useAutoSaveStore';
import {
  KonvaElement,
  KonvaFrameElement,
  isKonvaFrameElement,
  isKonvaGroupElement,
} from '@/shared/types/konva';

/**
 * 첫 번째 active 프레임 조회
 */
export const getFirstActiveFrame = (): KonvaFrameElement | undefined => {
  return useCanvasDataStore.getState().frames.find((f) => f.status === 'active');
};

/**
 * 첫 번째 active 프레임 ID 조회
 */
export const getFirstActiveFrameId = (): string | undefined => {
  return getFirstActiveFrame()?.id;
};

/**
 * 재귀적으로 요소와 자식들을 flatElements에 추가
 */
export const addElementsToMap = (element: KonvaElement, map: Map<string, KonvaElement>) => {
  map.set(element.id, element);
  if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) {
    element.children.forEach((child) => addElementsToMap(child, map));
  }
};

/**
 * 재귀적으로 요소와 자식들을 flatElements에서 제거
 */
export const removeElementsFromMap = (element: KonvaElement, map: Map<string, KonvaElement>) => {
  map.delete(element.id);
  if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) {
    element.children.forEach((child) => removeElementsFromMap(child, map));
  }
};

/**
 * 첫 번째 active 프레임이 변경됐을 때 썸네일 업로드
 */
export const uploadThumbnailIfFirstActiveFrameChanged = (
  projectId: string,
  queryClient: QueryClient,
  prevFirstActiveFrameId: string | undefined,
) => {
  const currentId = getFirstActiveFrameId();
  if (!currentId || prevFirstActiveFrameId === currentId) return;
  uploadThumbnailAndInvalidate(projectId, queryClient, 'FrameActions');
};

/**
 * 캔버스 스토어 상태 업데이트
 * - mutation 진행 중일 때 자동 저장은 useAutoSave에서 getMutationCache()로 감지하여 스킵
 */
export const updateStore = (updates: Partial<ReturnType<typeof useCanvasDataStore.getState>>) => {
  useCanvasDataStore.setState(updates);
};

/**
 * Mutation 시작 시 saving 상태로 변경
 */
export const startSaving = () => {
  useAutoSaveStore.getState().setSaving();
};

/**
 * Mutation 완료 시 saved 상태로 변경
 */
export const endSaving = () => {
  useAutoSaveStore.getState().setSaved();
};

/**
 * 롤백 컨텍스트 타입
 */
export interface RollbackContext {
  prevFrames: KonvaFrameElement[];
  prevFlatElements?: Map<string, KonvaElement>;
  prevFirstActiveFrameId?: string;
}

/**
 * frameOrder 기준으로 올바른 위치에 프레임 삽입
 */
export const insertFrameByOrder = (
  frames: KonvaFrameElement[],
  newFrame: KonvaFrameElement,
  frameOrder: string,
): KonvaFrameElement[] => {
  const insertIndex = frames.findIndex((f) => f.frameOrder && f.frameOrder > frameOrder);

  if (insertIndex === -1) return [...frames, newFrame];

  return [...frames.slice(0, insertIndex), newFrame, ...frames.slice(insertIndex)];
};
