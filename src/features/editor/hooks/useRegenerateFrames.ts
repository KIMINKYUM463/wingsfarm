/**
 * 프레임 전체 재생성 훅
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { regenerateProjectFrames } from '@/features/editor/api';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useDialog } from '@/shared/ui/Dialog';
import { useLoadingStore } from '@/shared/ui/Loading';
import { queryKeys } from '@/shared/constants/queryKeys';
import { mutationKeys } from '@/shared/constants/mutationKeys';
import { uploadThumbnailAndInvalidate } from '@/features/editor/lib/thumbnail';
import type { ProjectDetailResponse } from '@/features/editor/types';

const MAX_FRAMES_FOR_REGENERATE = 50;

/**
 * 프로젝트의 모든 프레임을 새로운 템플릿으로 재생성하는 훅
 *
 * 동작 방식:
 * - 프레임 개수 제한 체크 (50개 이상 시 Alert)
 * - 사용자 확인 다이얼로그 (Confirm)
 * - 서버에서 프레임 재생성 및 자동 저장
 * - 현재 프레임 ID는 유지하고 내용만 업데이트
 * - 각 프레임의 part2 내에서 새로운 템플릿 랜덤 선택
 * - 현재 사용 중인 템플릿은 재선택에서 제외 (중복 방지)
 * - frameOrder, frameName 등 기존 속성은 유지
 * - POST 응답 데이터로 캐시를 직접 업데이트 (GET 요청 방지)
 *
 * @returns { handleRegenerateAll, isPending }
 */
export const useRegenerateFrames = () => {
  const params = useParams();
  const projectId = params?.id as string;
  const queryClient = useQueryClient();
  const { openAlert, openConfirm } = useDialog();
  const { show: showLoading, hide: hideLoading } = useLoadingStore();

  const { mutateAsync, isPending } = useMutation({
    mutationKey: mutationKeys.FRAME.regenerate,
    mutationFn: () => regenerateProjectFrames(projectId),
    onSuccess: (response) => {
      const { initializeTemplate } = useCanvasDataStore.getState();

      // 기존 캐시에서 productName, categoryName 가져오기
      const cachedData = queryClient.getQueryData<ProjectDetailResponse>(
        queryKeys.EDITOR.projectDetail(projectId),
      );
      const productName = cachedData?.data.productName ?? '';
      const categoryName = cachedData?.data.categoryName ?? '';

      // 재생성된 프레임으로 캔버스 데이터 업데이트
      initializeTemplate(
        response.data.frames,
        response.data.assetUrls ?? {},
        productName,
        categoryName,
      );

      // POST 응답 데이터로 프로젝트 캐시 직접 업데이트 (GET 요청 방지)
      queryClient.setQueryData<ProjectDetailResponse>(
        queryKeys.EDITOR.projectDetail(projectId),
        (oldData) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            data: {
              ...oldData.data,
              frames: response.data.frames,
            },
          };
        },
      );

      // 재생성 후 썸네일 업로드 (mutationKey로 자동 저장 스킵됨, 썸네일은 직접 호출)
      uploadThumbnailAndInvalidate(projectId, queryClient, 'RegenerateFrames');
    },
  });

  // 전체 재생성 핸들러 (프레임 개수 체크 + 확인 다이얼로그 포함)
  const handleRegenerateAll = useCallback(async () => {
    const frameCount = useCanvasDataStore.getState().frames.length;

    // 프레임 개수 제한 체크
    if (frameCount > MAX_FRAMES_FOR_REGENERATE) {
      await openAlert({
        title: '템플릿 개수 초과',
        description: `템플릿은 최대 ${MAX_FRAMES_FOR_REGENERATE}개까지만 만들 수 있어요.`,
        confirmText: '적용 취소',
      });
      return;
    }

    // 확인 다이얼로그
    const confirmed = await openConfirm({
      title: '전체 초안이 다시 생성됩니다.',
      description: '현재 작성된 모든 내용이 지워집니다. 계속하시겠습니까?',
      confirmText: '생성하기',
      cancelText: '취소',
    });

    if (confirmed) {
      showLoading('템플릿 재생성 중...');
      try {
        await mutateAsync();
      } finally {
        hideLoading();
      }
    }
  }, [openAlert, openConfirm, mutateAsync, showLoading, hideLoading]);

  return { handleRegenerateAll, isPending };
};
