import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateKeyBetween } from 'fractional-indexing';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useAutoSaveStore } from '@/features/editor/store/useAutoSaveStore';
import { useScrollToElement } from '@/features/editor/hooks/useScrollToElement';
import { cloneElement } from '@/features/editor/lib/element-cloner';
import { injectRootIdToFrame } from '@/features/editor/lib/rootId-utils';
import { KonvaFrameElement, isKonvaFrameElement } from '@/shared/types/konva';
import {
  addTemplateFrame,
  applyTemplateToFrame,
  deleteProjectFrame,
  duplicateProjectFrame,
} from '@/features/editor/api';
import type {
  AddTemplateFrameResponse,
  ApplyTemplateMode,
  ApplyTemplateResponse,
  DuplicateFrameResponse,
  ProjectFrame,
} from '@/features/editor/types';
import {
  addElementsToMap,
  removeElementsFromMap,
  uploadThumbnailIfFirstActiveFrameChanged,
  getFirstActiveFrameId,
  insertFrameByOrder,
  updateStore,
  startSaving,
  endSaving,
  type RollbackContext,
} from './utils';
import { useDialog } from '@/shared/ui/Dialog';
import { mutationKeys } from '@/shared/constants/mutationKeys';

interface UseFrameCrudParams {
  projectId: string;
  frameId?: string;
}

/**
 * 프레임 CRUD 작업 (추가, 삭제, 복제)
 */
export const useFrameCrud = ({ projectId, frameId }: UseFrameCrudParams) => {
  const queryClient = useQueryClient();
  const { scrollToFrameById } = useScrollToElement();
  const { openAlert } = useDialog();

  // 템플릿 기반 프레임 추가 mutation (ghost 활성화 또는 새 프레임 생성)
  const addTemplateFrameMutation = useMutation<
    AddTemplateFrameResponse,
    Error,
    { part2: string; frameOrder: string; ghostId?: string },
    RollbackContext
  >({
    mutationKey: mutationKeys.FRAME.add,
    mutationFn: ({ part2, frameOrder }) =>
      addTemplateFrame(projectId, { part2, frame_order: frameOrder }),
    retry: false, // 중복 생성 방지
    onMutate: ({ ghostId }) => {
      useAutoSaveStore.getState().setSaving();
      const { frames, flatElements } = useCanvasDataStore.getState();
      const context: RollbackContext = {
        prevFrames: frames,
        prevFlatElements: new Map(flatElements),
      };

      // 스켈레톤 표시만 (캔버스에 빈 프레임 방지 - 서버 응답 후 active로 전환)
      if (ghostId) {
        useCanvasDataStore.getState().setActivatingFrameId(ghostId);
      }

      return context;
    },
    onSuccess: (response, { ghostId }) => {
      const { frames, flatElements, assetUrls } = useCanvasDataStore.getState();
      const serverFrame = response.data;

      // 중복 방지: 이미 해당 ID의 프레임이 있으면 스킵
      if (frames.some((f) => f.id === serverFrame.id && f.id !== ghostId)) {
        return;
      }

      // 템플릿의 assetUrls를 store에 병합
      if (serverFrame.assetUrls && Object.keys(serverFrame.assetUrls).length > 0) {
        useCanvasDataStore.setState({
          assetUrls: { ...assetUrls, ...serverFrame.assetUrls },
        });
      }

      // rootId 주입 (백엔드 응답에 rootId 없을 수 있음)
      const frameData = serverFrame.frameData as KonvaFrameElement;
      const frameWithRootIds = injectRootIdToFrame(frameData, serverFrame.id);
      const newFrame: KonvaFrameElement = {
        ...frameWithRootIds,
        id: serverFrame.id,
        frameOrder: serverFrame.frameOrder,
        part2: serverFrame.part2,
        // frameName이 null이면 빈 문자열 사용 (템플릿 이름으로 덮어쓰지 않음)
        // frameData.name은 Konva 렌더링용 템플릿 이름이고, frameName은 사용자가 지정한 프레임 이름
        name: serverFrame.frameName ?? '',
        status: 'active',
      };

      let updatedFrames: KonvaFrameElement[];
      const updatedFlatElements = new Map(flatElements);

      if (ghostId) {
        // ghost → active 교체
        const ghostFrame = flatElements.get(ghostId);
        if (ghostFrame) {
          removeElementsFromMap(ghostFrame, updatedFlatElements);
        }
        updatedFrames = frames.map((f) => (f.id === ghostId ? newFrame : f));
      } else {
        // 새 프레임 삽입 (올바른 위치에)
        const insertIndex = frames.findIndex(
          (f) => f.frameOrder && f.frameOrder > serverFrame.frameOrder,
        );
        updatedFrames =
          insertIndex === -1
            ? [...frames, newFrame]
            : [...frames.slice(0, insertIndex), newFrame, ...frames.slice(insertIndex)];
      }

      addElementsToMap(newFrame, updatedFlatElements);
      updateStore({ frames: updatedFrames, flatElements: updatedFlatElements });

      scrollToFrameById(newFrame.id, { behavior: 'smooth', block: 'start' });
    },
    onError: (_error, _variables, context) => {
      if (context) {
        useCanvasDataStore.setState({
          frames: context.prevFrames,
          flatElements: context.prevFlatElements,
        });
      }
    },
    onSettled: (_data, _error, { ghostId }) => {
      // 현재 activatingFrameId가 이 mutation의 ghostId와 같을 때만 해제
      // (다른 ghost 클릭으로 변경된 경우 유지)
      if (ghostId && useCanvasDataStore.getState().activatingFrameId === ghostId) {
        useCanvasDataStore.getState().setActivatingFrameId(null);
      }
      useAutoSaveStore.getState().setSaved();
    },
  });

  // 특정 템플릿 적용 mutation (새 프레임 생성 또는 기존 프레임 덮어쓰기)
  const applyTemplateFrameMutation = useMutation<
    ApplyTemplateResponse,
    Error,
    { templateId: string; mode: ApplyTemplateMode; frameOrder?: string; frameId?: string; part2?: string; tempId?: string },
    RollbackContext
  >({
    mutationKey: mutationKeys.FRAME.applyTemplate,
    mutationFn: ({ templateId, mode, frameOrder, frameId: targetFrameId }) =>
      applyTemplateToFrame(projectId, templateId, {
        mode,
        frame_order: frameOrder,
        frame_id: targetFrameId,
      }),
    retry: false,
    onMutate: ({ frameId: targetFrameId, part2, tempId, frameOrder }) => {
      startSaving();
      const { frames, flatElements } = useCanvasDataStore.getState();

      // overwrite 모드: 기존 프레임에 로딩 상태 + part2 낙관적 업데이트
      if (targetFrameId) {
        useCanvasDataStore.getState().setActivatingFrameId(targetFrameId);

        if (typeof part2 === 'string') {
          const updatedFrames = frames.map((f) =>
            f.id === targetFrameId ? { ...f, part2 } : f,
          );
          useCanvasDataStore.setState({ frames: updatedFrames });

          return {
            prevFrames: frames,
            prevFlatElements: new Map(flatElements),
          };
        }
      }

      // create 모드: 임시 스켈레톤 프레임 추가
      if (tempId && typeof part2 === 'string' && frameOrder) {
        const tempFrame: KonvaFrameElement = {
          type: 'frame',
          id: tempId,
          name: '',
          x: 0,
          y: 0,
          children: [],
          status: 'active',
          frameOrder,
          part2,
        };

        const updatedFrames = insertFrameByOrder(frames, tempFrame, frameOrder);
        useCanvasDataStore.setState({ frames: updatedFrames });
        useCanvasDataStore.getState().setActivatingFrameId(tempId);

        return {
          prevFrames: frames,
          prevFlatElements: new Map(flatElements),
        };
      }

      return {
        prevFrames: frames,
        prevFlatElements: new Map(flatElements),
      };
    },
    onSuccess: (response, { mode, frameId: targetFrameId, tempId }) => {
      const { frames, flatElements, assetUrls } = useCanvasDataStore.getState();
      const serverFrame = response.data;

      // 템플릿의 assetUrls를 store에 병합
      if (serverFrame.assetUrls && Object.keys(serverFrame.assetUrls).length > 0) {
        useCanvasDataStore.setState({
          assetUrls: { ...assetUrls, ...serverFrame.assetUrls },
        });
      }

      const frameData = serverFrame.frameData as KonvaFrameElement;
      const frameWithRootIds = injectRootIdToFrame(frameData, serverFrame.id);
      const newFrame: KonvaFrameElement = {
        ...frameWithRootIds,
        id: serverFrame.id,
        frameOrder: serverFrame.frameOrder,
        part2: serverFrame.part2,
        // 템플릿 적용 시 항상 빈 문자열 (사용자가 직접 입력하도록)
        name: '',
        status: 'active',
      };

      const updatedFlatElements = new Map(flatElements);
      const isOverwrite = mode === 'overwrite' && targetFrameId;
      const isCreate = mode === 'create' && tempId;

      // 제거할 프레임 ID 목록
      // - 기존 프레임: overwrite면 targetFrameId, create면 tempId
      // - 같은 part2의 모든 ghost 프레임 (part2당 active 1개만 허용)
      const idsToRemove = new Set<string>();
      if (isOverwrite && targetFrameId) idsToRemove.add(targetFrameId);
      if (isCreate) idsToRemove.add(tempId);

      // 같은 part2를 가진 ghost 프레임 모두 제거
      frames
        .filter((f) => f.part2 === serverFrame.part2 && f.status === 'ghost')
        .forEach((f) => idsToRemove.add(f.id));

      // flatElements에서 제거할 프레임의 요소들 정리
      for (const id of idsToRemove) {
        const frameToRemove = frames.find((f) => f.id === id);
        if (frameToRemove) {
          removeElementsFromMap(frameToRemove, updatedFlatElements);
        }
      }

      // 기존 프레임들 제거 후 새 프레임 삽입
      const filteredFrames = frames.filter((f) => !idsToRemove.has(f.id));
      const updatedFrames = insertFrameByOrder(filteredFrames, newFrame, serverFrame.frameOrder);

      addElementsToMap(newFrame, updatedFlatElements);
      updateStore({ frames: updatedFrames, flatElements: updatedFlatElements });

      // autoSave refs에 등록하여 중복 PATCH 방지
      useAutoSaveStore.getState().registerSavedFrame(newFrame);

      scrollToFrameById(newFrame.id, { behavior: 'smooth', block: 'start' });
    },
    onError: (_error, _variables, context) => {
      if (!context) return;

      useCanvasDataStore.setState({
        frames: context.prevFrames,
        flatElements: context.prevFlatElements,
      });
    },
    onSettled: (_data, _error, { frameId: targetFrameId, tempId }) => {
      const activatingId = targetFrameId || tempId;
      if (activatingId && useCanvasDataStore.getState().activatingFrameId === activatingId) {
        useCanvasDataStore.getState().setActivatingFrameId(null);
      }
      endSaving();
    },
  });

  // 프레임 삭제 mutation
  type DeleteSource = 'canvas' | 'panel';
  type DeleteParams = { frameId: string; source: DeleteSource };

  const deleteFrameMutation = useMutation<ProjectFrame | null, Error, DeleteParams, RollbackContext>(
    {
      mutationKey: mutationKeys.FRAME.delete,
      mutationFn: ({ frameId }) => deleteProjectFrame(projectId, frameId),
      onMutate: ({ frameId }) => {
        startSaving();

        const { frames, flatElements } = useCanvasDataStore.getState();
        const context: RollbackContext = {
          prevFrames: frames,
          prevFlatElements: new Map(flatElements),
          prevFirstActiveFrameId: getFirstActiveFrameId(),
        };

        const frameToDelete = frames.find((f) => f.id === frameId);
        if (!frameToDelete) return context;

        const newFlatElements = new Map(flatElements);
        removeElementsFromMap(frameToDelete, newFlatElements);

        // 해당 part2의 마지막 active → ghost 전환 (깜빡임 방지)
        const isLastActiveInPart =
          frames.filter((f) => f.status === 'active' && f.part2 === frameToDelete.part2).length ===
          1;

        if (isLastActiveInPart) {
          const newFrames = frames.map((f) =>
            f.id === frameId ? { ...f, status: 'ghost' as const, children: [] } : f,
          );
          updateStore({ frames: newFrames, flatElements: newFlatElements });
          return context;
        }

        // 일반 삭제 (해당 part2에 다른 active 프레임이 있는 경우)
        const newFrames = frames.filter((f) => f.id !== frameId);
        updateStore({ frames: newFrames, flatElements: newFlatElements });
        return context;
      },
      onSuccess: (serverGhost, { frameId }, context) => {
        // 204 응답: 일반 삭제 완료
        if (!serverGhost) {
          if (context?.prevFirstActiveFrameId) {
            uploadThumbnailIfFirstActiveFrameChanged(projectId, queryClient, context.prevFirstActiveFrameId);
          }
          return;
        }

        // 200 응답: ghost 프레임 처리
        const { frames, flatElements } = useCanvasDataStore.getState();
        const serverGhostKonva: KonvaFrameElement = {
          type: 'frame',
          id: serverGhost.id,
          name: serverGhost.frameName ?? '',
          x: 0,
          y: 0,
          children: [],
          status: 'ghost',
          frameOrder: serverGhost.frameOrder,
          part2: serverGhost.part2,
        };

        const existingGhost = frames.find((f) => f.id === frameId && f.status === 'ghost');

        // 낙관적 ghost가 있으면 동기화, 없으면 올바른 위치에 삽입
        const getNewFrames = () => {
          if (existingGhost) {
            return frames.map((f) => (f.id === frameId ? serverGhostKonva : f));
          }
          const idx = frames.findIndex((f) => f.frameOrder && f.frameOrder > serverGhost.frameOrder);
          if (idx === -1) return [...frames, serverGhostKonva];
          return [...frames.slice(0, idx), serverGhostKonva, ...frames.slice(idx)];
        };

        updateStore({ frames: getNewFrames(), flatElements });

        if (context?.prevFirstActiveFrameId) {
          uploadThumbnailIfFirstActiveFrameChanged(projectId, queryClient, context.prevFirstActiveFrameId);
        }
      },
      onError: (_error, _variables, context) => {
        if (!context) return;

        useCanvasDataStore.setState({
          frames: context.prevFrames,
          flatElements: context.prevFlatElements,
        });
      },
      onSettled: endSaving,
    },
  );

  // 프레임 복제 mutation
  const duplicateFrameMutation = useMutation<
    DuplicateFrameResponse,
    Error,
    { sourceFrameId: string; tempId: string; frameOrder: string },
    RollbackContext
  >({
    mutationKey: mutationKeys.FRAME.duplicate,
    mutationFn: ({ sourceFrameId, frameOrder }) =>
      duplicateProjectFrame(projectId, sourceFrameId, { frameOrder }),
    onMutate: ({ tempId }) => {
      startSaving();
      useCanvasDataStore.getState().setDuplicatingFrameId(tempId);
      const { frames, flatElements } = useCanvasDataStore.getState();
      return { prevFrames: frames, prevFlatElements: new Map(flatElements) };
    },
    onSuccess: (response, { tempId }) => {
      const { frames, flatElements, assetUrls } = useCanvasDataStore.getState();
      const serverId = response.data.id;

      // 프레임의 assetUrls를 store에 병합
      if (response.data.assetUrls && Object.keys(response.data.assetUrls).length > 0) {
        useCanvasDataStore.setState({
          assetUrls: { ...assetUrls, ...response.data.assetUrls },
        });
      }

      // rootId 주입 (백엔드 응답에 rootId 없을 수 있음)
      const frameData = response.data.frameData as KonvaFrameElement;
      const frameWithRootIds = injectRootIdToFrame(frameData, serverId);
      const actualFrame: KonvaFrameElement = {
        ...frameWithRootIds,
        id: serverId,
        frameOrder: response.data.frameOrder,
        part2: response.data.part2,
        // 복제된 프레임도 frameName이 null이면 빈 문자열 사용
        name: response.data.frameName ?? '',
        status: 'active',
      };

      const updatedFrames = frames.map((f) => (f.id === tempId ? actualFrame : f));
      const updatedFlatElements = new Map(flatElements);
      const tempFrame = flatElements.get(tempId);
      if (tempFrame) {
        removeElementsFromMap(tempFrame, updatedFlatElements);
      }
      addElementsToMap(actualFrame, updatedFlatElements);

      updateStore({ frames: updatedFrames, flatElements: updatedFlatElements });
    },
    onError: (_error, _variables, context) => {
      if (context) {
        useCanvasDataStore.setState({
          frames: context.prevFrames,
          flatElements: context.prevFlatElements,
        });
      }
    },
    onSettled: () => {
      useCanvasDataStore.getState().setDuplicatingFrameId(null);
      endSaving();
    },
  });

  // 프레임 삭제 핸들러
  const handleDelete = useCallback(
    ({ frameId: targetFrameId, source }: { frameId?: string; source: 'canvas' | 'panel' }) => {
      const id = targetFrameId || frameId;
      if (!id || !projectId) return;

      // 연속 클릭 방지
      if (deleteFrameMutation.isPending) return;

      // 마지막 active 프레임은 삭제 불가
      const { frames } = useCanvasDataStore.getState();
      const activeFrameCount = frames.filter((f) => f.status === 'active').length;
      if (activeFrameCount <= 1) {
        openAlert({
          title: '프레임을 삭제할 수 없습니다',
          description: '최소 1개의 프레임이 필요합니다.',
        });
        return;
      }

      deleteFrameMutation.mutate({ frameId: id, source });
    },
    [frameId, projectId, deleteFrameMutation, openAlert],
  );

  // 프레임 복제 핸들러
  const handleDuplicate = useCallback(
    (targetFrameId?: string) => {
      const id = targetFrameId || frameId;
      if (!id || !projectId) return null;

      // 연속 클릭 방지
      if (duplicateFrameMutation.isPending) return null;

      const { frames, flatElements } = useCanvasDataStore.getState();
      const frameIndex = frames.findIndex((frame) => frame.id === id);

      if (frameIndex === -1) {
        return null;
      }

      const frameToDuplicate = frames[frameIndex];
      const nextFrame = frames[frameIndex + 1];
      const newFrameOrder = generateKeyBetween(
        frameToDuplicate.frameOrder ?? null,
        nextFrame?.frameOrder ?? null,
      );

      const clonedFrame = cloneElement(frameToDuplicate);
      if (!isKonvaFrameElement(clonedFrame)) {
        return null;
      }

      // 낙관적 업데이트용 rootId 주입 (children이 새 프레임 ID 참조하도록)
      const tempId = clonedFrame.id;
      const duplicatedFrame = injectRootIdToFrame(clonedFrame, tempId);
      duplicatedFrame.frameOrder = newFrameOrder;
      duplicatedFrame.name = '';

      // 낙관적 업데이트
      const newFrames = [
        ...frames.slice(0, frameIndex + 1),
        duplicatedFrame,
        ...frames.slice(frameIndex + 1),
      ];
      const newFlatElements = new Map(flatElements);
      addElementsToMap(duplicatedFrame, newFlatElements);
      updateStore({ frames: newFrames, flatElements: newFlatElements });

      scrollToFrameById(duplicatedFrame.id, { behavior: 'smooth', block: 'start' });

      duplicateFrameMutation.mutate({
        sourceFrameId: id,
        tempId,
        frameOrder: newFrameOrder,
      });

      return duplicatedFrame.id;
    },
    [frameId, projectId, scrollToFrameById, duplicateFrameMutation],
  );

  // Ghost 프레임 활성화 핸들러 (패널에서 비활성 프레임 클릭 시)
  const handleActivateGhost = useCallback(
    (ghostFrameId: string) => {
      if (!projectId) return;

      // 이미 활성화 중인 ghost면 중복 요청 방지
      if (useCanvasDataStore.getState().activatingFrameId === ghostFrameId) return;

      const { frames } = useCanvasDataStore.getState();
      const ghostFrame = frames.find((f) => f.id === ghostFrameId && f.status === 'ghost');

      if (!ghostFrame) {
        return;
      }

      addTemplateFrameMutation.mutate({
        part2: ghostFrame.part2 ?? '',
        frameOrder: ghostFrame.frameOrder ?? '',
        ghostId: ghostFrameId,
      });
    },
    [projectId, addTemplateFrameMutation],
  );

  // 특정 템플릿 적용 핸들러
  interface ApplyTemplateParams {
    templateId: string;
    mode: ApplyTemplateMode;
    frameOrder?: string;
    targetFrameId?: string;
    /** 낙관적 업데이트용 part2 */
    part2?: string;
    /** create 모드 낙관적 업데이트용 임시 ID */
    tempId?: string;
  }

  const handleApplyTemplate = useCallback(
    ({ templateId, mode, frameOrder, targetFrameId, part2, tempId }: ApplyTemplateParams) => {
      if (!projectId) return;
      if (applyTemplateFrameMutation.isPending) return;

      applyTemplateFrameMutation.mutate({
        templateId,
        mode,
        frameOrder,
        frameId: targetFrameId,
        part2,
        tempId,
      });
    },
    [projectId, applyTemplateFrameMutation],
  );

  return {
    handleDelete,
    handleDuplicate,
    handleActivateGhost,
    handleApplyTemplate,
    isApplyingTemplate: applyTemplateFrameMutation.isPending,
  };
};
