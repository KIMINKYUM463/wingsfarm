import { useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useAutoSaveStore } from '@/features/editor/store/useAutoSaveStore';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';
import { updateProjectFrame, type UpdateFrameOptions } from '@/features/editor/api';
import { uploadThumbnailAndInvalidate } from '@/features/editor/lib/thumbnail';
import { getFirstActiveFrameId } from '@/features/editor/hooks/frame/utils';
import type { KonvaFrameElement } from '@/shared/types/konva';
import { CustomError } from '@/shared/lib/CustomError';
import { FRAME_MUTATION_PREFIX } from '@/shared/constants/mutationKeys';

/**
 * 자동 저장 설정
 */
export interface AutoSaveConfig {
  /** 디바운스 딜레이 (기본: 3000ms) */
  debounceMs?: number;
  /** 최대 대기 시간 (기본: 30000ms) */
  maxWaitMs?: number;
  /** 자동 저장 활성화 여부 (기본: true) */
  enabled?: boolean;
  /** 서버 최초 조회 여부 (true면 초기 썸네일 업로드) */
  isFirstView?: boolean;
}

const DEFAULT_CONFIG: Required<AutoSaveConfig> = {
  debounceMs: 3000,
  maxWaitMs: 30000,
  isFirstView: false,
  enabled: true,
};

/**
 * 프레임별 마지막 저장된 필드 값 (필드별 변경 감지용)
 */
interface LastSavedFieldValues {
  frameOrder?: string;
  name?: string;
}

/**
 * 프레임별 변경 감지 결과
 */
interface FrameChanges {
  frameId: string;
  frame: KonvaFrameElement;
  changes: {
    frameOrder: boolean;
    frameName: boolean;
    frameData: boolean;
  };
}

/**
 * 자동 저장 훅
 *
 * ## 책임
 * - 캔버스 변경 감지 (frames 참조 추적)
 * - 수정된 프레임만 디바운스 후 저장
 * - 저장 상태 관리
 *
 * ## 저장 전략
 * - **수정된 프레임만 저장** (불변 업데이트로 참조 비교)
 * - 변경 후 3초 대기 (디바운스)
 * - 최대 30초마다 강제 저장 (maxWait)
 * - frame.id로 DB UUID 직접 사용
 * - 디바운스 내 여러 프레임 수정 시 병렬 저장
 * - **자동 재시도**: 실패 시 2번 재시도 (총 3번 시도)
 * - **재시도 지연**: 1초 간격
 *
 * ## Frame Mutation 중 변경 처리
 * - Frame mutation 진행 중 편집 발생 시 → 플래그 설정 후 스킵
 * - Mutation 완료 시 → MutationCache subscribe로 감지 → 저장 트리거
 * - 이를 통해 mutation 중 편집한 내용도 누락 없이 저장
 *
 * ## 사용 예시
 * ```tsx
 * useAutoSave(projectId, { debounceMs: 5000 });
 * useAutoSave(projectId, { isFirstView }); // 첫 진입 시 초기 썸네일 업로드
 * ```
 *
 * @param projectId - 프로젝트 ID
 * @param config - 자동 저장 설정 (isFirstView 포함)
 */
export const useAutoSave = (projectId: string | undefined, config?: AutoSaveConfig): void => {
  // 설정값 (객체 생성 대신 개별 값으로 분리)
  const debounceMs = config?.debounceMs ?? DEFAULT_CONFIG.debounceMs;
  const maxWaitMs = config?.maxWaitMs ?? DEFAULT_CONFIG.maxWaitMs;
  const enabled = config?.enabled ?? DEFAULT_CONFIG.enabled;
  const isFirstView = config?.isFirstView ?? DEFAULT_CONFIG.isFirstView;

  // React Query
  const queryClient = useQueryClient();

  // 상태
  const frames = useCanvasDataStore((state) => state.frames);
  const autoSaveEnabled = useAutoSaveStore((state) => state.enabled);
  const setStatus = useAutoSaveStore((state) => state.setStatus);
  const setPending = useAutoSaveStore((state) => state.setPending);
  const setSaving = useAutoSaveStore((state) => state.setSaving);
  const setSaved = useAutoSaveStore((state) => state.setSaved);

  // 마지막 저장된 frames (참조 비교 - frameData 변경 감지용)
  const lastSavedFramesMapRef = useRef<Map<string, KonvaFrameElement>>(new Map());

  // 마지막 저장된 필드 값 (필드별 변경 감지용 - frameOrder, name)
  const lastSavedFieldsMapRef = useRef<Map<string, LastSavedFieldValues>>(new Map());

  // 초기화 완료 플래그 (초기 로드 시 저장 방지)
  const isInitializedRef = useRef(false);

  // 최신 저장 함수 참조 (stale closure 방지)
  const saveRef = useRef<(() => Promise<boolean>) | undefined>(undefined);

  // 재시도 필요 플래그 (저장 중 새 변경 발생 시)
  const needsRetryRef = useRef(false);

  // Frame mutation 진행 중 변경 발생 플래그 (mutation 완료 시 저장 트리거)
  const hasPendingChangesRef = useRef(false);

  // Frame mutation 진행 중인지 확인하는 헬퍼
  const hasPendingFrameMutation = useCallback(() => {
    return queryClient
      .getMutationCache()
      .getAll()
      .some(
        (mutation) =>
          mutation.state.status === 'pending' &&
          Array.isArray(mutation.options.mutationKey) &&
          mutation.options.mutationKey[0] === FRAME_MUTATION_PREFIX,
      );
  }, [queryClient]);

  // 저장 Mutation (자동 재시도 2회)
  const saveMutation = useMutation({
    mutationFn: async (framesToSave: FrameChanges[]) => {
      if (!projectId) {
        throw new CustomError(400, 'Project ID가 없습니다');
      }

      // 변경된 필드만 API 전송 (필드별 최적화)
      await Promise.all(
        framesToSave.map(({ frameId, frame, changes }) => {
          const options: UpdateFrameOptions = {};

          if (changes.frameData) {
            options.frameData = frame;
          }
          if (changes.frameOrder && frame.frameOrder) {
            options.frameOrder = frame.frameOrder;
          }
          if (changes.frameName && frame.name) {
            options.frameName = frame.name;
          }

          return updateProjectFrame(projectId, frameId, options);
        }),
      );

      return framesToSave;
    },
    retry: 2, // 총 3번 시도 (첫 시도 + 재시도 2번)
    retryDelay: 1000, // 1초 후 재시도
    onSuccess: (savedFrameChanges) => {
      // 저장 성공 - 저장된 프레임/필드 기록 (다음 비교용)
      const newFrameMap = new Map(lastSavedFramesMapRef.current);
      const newFieldsMap = new Map(lastSavedFieldsMapRef.current);

      savedFrameChanges.forEach(({ frameId, frame, changes }) => {
        // frameData가 저장됐으면 참조 업데이트
        if (changes.frameData) {
          newFrameMap.set(frameId, frame);
        }

        // 필드별 값 업데이트
        const prevFields = newFieldsMap.get(frameId) ?? {};
        const updatedFields: LastSavedFieldValues = { ...prevFields };
        if (changes.frameOrder) {
          updatedFields.frameOrder = frame.frameOrder;
        }
        if (changes.frameName) {
          updatedFields.name = frame.name;
        }
        newFieldsMap.set(frameId, updatedFields);
      });

      lastSavedFramesMapRef.current = newFrameMap;
      lastSavedFieldsMapRef.current = newFieldsMap;

      // 첫 번째 active 프레임이 저장됐으면 썸네일 업로드
      const firstActiveId = getFirstActiveFrameId();
      const isFirstActiveSaved =
        firstActiveId && savedFrameChanges.some(({ frameId }) => frameId === firstActiveId);
      if (projectId && isFirstActiveSaved) {
        uploadThumbnailAndInvalidate(projectId, queryClient, 'AutoSave');
      }

      // 저장 중 새 변경이 있었으면 즉시 재저장
      if (needsRetryRef.current) {
        needsRetryRef.current = false;
        setPending();
        saveRef.current?.();
      } else {
        setSaved();
      }
    },
    onError: () => {
      // 에러 시 상태 리셋 (토스트는 전역 MutationCache.onError가 처리)
      useAutoSaveStore.setState({ status: 'idle', error: null });
      console.error('[AutoSave] ❌ 저장 실패');
    },
  });

  /**
   * 프레임을 refs에 등록 (새 프레임용)
   */
  const registerFrame = (frame: KonvaFrameElement) => {
    lastSavedFramesMapRef.current.set(frame.id, frame);
    lastSavedFieldsMapRef.current.set(frame.id, {
      frameOrder: frame.frameOrder,
      name: frame.name,
    });
  };

  /**
   * Active 프레임의 변경 감지
   * - frameData: 참조 비교 (불변 업데이트 감지)
   * - frameOrder, frameName: 값 비교
   */
  const detectActiveFrameChanges = (frame: KonvaFrameElement): FrameChanges | null => {
    // CRUD 완료된 프레임 → refs 업데이트 후 스킵 (중복 저장 방지)
    const frameToRegister = useAutoSaveStore.getState().frameToRegister;
    if (frameToRegister?.id === frame.id) {
      registerFrame(frame);
      useAutoSaveStore.setState({ frameToRegister: null });
      return null;
    }

    const prevFields = lastSavedFieldsMapRef.current.get(frame.id);
    const prevFrame = lastSavedFramesMapRef.current.get(frame.id);

    // 새 프레임 → refs 등록 후 스킵 (CRUD에서 이미 저장됨)
    if (!prevFrame) {
      registerFrame(frame);
      return null;
    }

    const changes = {
      frameOrder: prevFields?.frameOrder !== frame.frameOrder,
      frameName: prevFields?.name !== frame.name,
      frameData: prevFrame !== frame,
    };

    const hasChanges = changes.frameOrder || changes.frameName || changes.frameData;
    return hasChanges ? { frameId: frame.id, frame, changes } : null;
  };

  /**
   * Ghost 프레임의 변경 감지
   * - frameOrder만 체크 (frameData/frameName 제외)
   */
  const detectGhostFrameChanges = (frame: KonvaFrameElement): FrameChanges | null => {
    const prevFields = lastSavedFieldsMapRef.current.get(frame.id);

    // 새 ghost → refs 등록 후 스킵
    if (!prevFields) {
      registerFrame(frame);
      return null;
    }

    // frameOrder 변경 시에만 저장
    const hasOrderChanged = prevFields.frameOrder !== frame.frameOrder;
    if (!hasOrderChanged) return null;

    return {
      frameId: frame.id,
      frame,
      changes: { frameOrder: true, frameName: false, frameData: false },
    };
  };

  /**
   * 삭제된 프레임 refs 정리
   * - CRUD 진행 중에는 스킵 (롤백 시 복구 프레임의 변경사항 유실 방지)
   */
  const cleanupDeletedFrameRefs = (currentFrameIds: Set<string>) => {
    if (hasPendingFrameMutation()) return;

    for (const frameId of lastSavedFramesMapRef.current.keys()) {
      if (currentFrameIds.has(frameId)) continue;
      lastSavedFramesMapRef.current.delete(frameId);
      lastSavedFieldsMapRef.current.delete(frameId);
    }
  };

  // 저장 함수 (성공 여부 반환)
  const saveAllFrames = async (): Promise<boolean> => {
    // 이미 저장 중이면 플래그 설정 후 스킵 (저장 완료 시 재시도)
    if (saveMutation.isPending) {
      needsRetryRef.current = true;
      return false;
    }

    // 최신 frames 가져오기 (stale closure 방지)
    const currentFrames = useCanvasDataStore.getState().frames;

    // 필수 데이터 체크
    if (!projectId || currentFrames.length === 0) {
      setStatus('idle');
      return false;
    }

    // 활성화 체크
    if (!enabled || !autoSaveEnabled) {
      setStatus('idle');
      return false;
    }

    // 변경된 프레임 수집
    const changedFrames: FrameChanges[] = [];
    const currentFrameIds = new Set<string>();

    for (const frame of currentFrames) {
      if (!frame.id) continue;
      currentFrameIds.add(frame.id);

      const isGhost = frame.status === 'ghost';
      const changes = isGhost ? detectGhostFrameChanges(frame) : detectActiveFrameChanges(frame);

      if (changes) {
        changedFrames.push(changes);
      }
    }

    cleanupDeletedFrameRefs(currentFrameIds);

    if (changedFrames.length === 0) {
      setSaved();
      return false;
    }

    // Mutation 실행
    setSaving();
    await saveMutation.mutateAsync(changedFrames);
    return true;
  };

  // 최신 저장 함수를 ref에 저장 (stale closure 방지)
  saveRef.current = saveAllFrames;

  // 수동 저장용 콜백 (외부에서 호출 가능, 항상 최신 함수 실행)
  const manualSave = useCallback(async (): Promise<boolean> => {
    const result = await saveRef.current?.();
    return result ?? false;
  }, []);

  // 디바운스된 저장 함수
  const debouncedSave = useDebouncedCallback(saveAllFrames, {
    delay: debounceMs,
    maxWait: maxWaitMs,
  });

  // 수동 저장 콜백 등록 (FileUploadPopover 등에서 사용)
  const setSaveCallback = useAutoSaveStore((state) => state.setSaveCallback);

  useEffect(() => {
    setSaveCallback(manualSave);
    return () => setSaveCallback(null);
  }, [setSaveCallback, manualSave]);

  // 초기화 (frames 로드 시)
  useEffect(() => {
    if (frames.length === 0) return;
    if (!isInitializedRef.current) {
      // 프레임 참조 및 필드 값 초기화
      lastSavedFramesMapRef.current = new Map(frames.map((f) => [f.id, f]));
      lastSavedFieldsMapRef.current = new Map(
        frames.map((f) => [f.id, { frameOrder: f.frameOrder, name: f.name }]),
      );
      isInitializedRef.current = true;

      // 첫 진입 시 썸네일 업로드 (브라우저 렌더 사이클 2회 대기 후 실행)
      if (isFirstView && projectId) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            uploadThumbnailAndInvalidate(projectId, queryClient, 'InitialUpload');
          });
        });
      }
    }
  }, [frames, isFirstView, projectId, queryClient]);

  // 동기적 변경 감지 (Zustand subscribe)
  useEffect(() => {
    const unsubscribe = useCanvasDataStore.subscribe((state, prevState) => {
      // 초기화 전이면 스킵
      if (!isInitializedRef.current) return;
      // frames가 변경되지 않았으면 스킵
      if (state.frames === prevState.frames) return;

      // frame mutation 진행 중이면 플래그만 설정 (mutation 완료 시 저장)
      if (hasPendingFrameMutation()) {
        hasPendingChangesRef.current = true;
        setPending();
        return;
      }

      // 변경 감지 → 디바운스 저장 예약
      setPending();
      debouncedSave();
    });

    return unsubscribe;
  }, [hasPendingFrameMutation, setPending, debouncedSave]);

  // MutationCache subscribe: frame mutation 완료 시 저장 트리거
  useEffect(() => {
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      // mutation 완료/에러 이벤트만 처리
      if (event.type !== 'updated') return;
      if (event.mutation.state.status !== 'success' && event.mutation.state.status !== 'error')
        return;

      // frame mutation인지 확인
      const mutationKey = event.mutation.options.mutationKey;
      if (!Array.isArray(mutationKey) || mutationKey[0] !== FRAME_MUTATION_PREFIX) return;

      // mutation 진행 중 변경이 있었으면 저장 트리거
      if (hasPendingChangesRef.current) {
        hasPendingChangesRef.current = false;
        // 다른 frame mutation이 아직 진행 중이면 대기
        if (hasPendingFrameMutation()) return;
        debouncedSave();
      }
    });

    return unsubscribe;
  }, [queryClient, hasPendingFrameMutation, debouncedSave]);
};
