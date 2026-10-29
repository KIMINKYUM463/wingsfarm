'use client';

/**
 * 프로젝트 정보 수정 훅
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { updateProject } from '../api';
import { mutationKeys } from '@/shared/constants/mutationKeys';
import { queryKeys } from '@/shared/constants/queryKeys';
import type { UpdateProjectRequest } from '../types';

/**
 * 프로젝트 정보 수정 mutation 훅
 *
 * - 낙관적 업데이트로 즉각적인 UI 반영
 * - 실패 시 자동 롤백
 * - 캐시 자동 동기화
 *
 * @example
 * const { mutate, isPending } = useUpdateProject();
 * mutate({ productName: '새 상품명' });
 */
export const useUpdateProject = () => {
  const params = useParams();
  const projectId = params?.id as string;
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.PROJECT.update,
    mutationFn: (data: UpdateProjectRequest) => updateProject(projectId, data),
    onMutate: async (newData) => {
      // 진행 중인 쿼리 취소 (낙관적 업데이트 덮어쓰기 방지)
      await queryClient.cancelQueries({ queryKey: queryKeys.EDITOR.projectDetail(projectId) });

      // 이전 데이터 스냅샷 저장 (롤백용)
      const previousData = queryClient.getQueryData(queryKeys.EDITOR.projectDetail(projectId));

      // 낙관적 업데이트
      queryClient.setQueryData(queryKeys.EDITOR.projectDetail(projectId), (oldData: unknown) => {
        if (!oldData || typeof oldData !== 'object') return oldData;
        const typed = oldData as { data: Record<string, unknown> };
        return {
          ...typed,
          data: { ...typed.data, ...newData },
        };
      });

      return { previousData };
    },
    onError: (_error, _newData, context) => {
      // 에러 시 롤백
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.EDITOR.projectDetail(projectId),
          context.previousData,
        );
      }
    },
    onSuccess: (response) => {
      // 서버 응답으로 캐시 최종 동기화 (응답은 요약 정보라 frames·palette 등 상세 필드는 유지)
      queryClient.setQueryData(queryKeys.EDITOR.projectDetail(projectId), (oldData: unknown) => {
        if (!oldData || typeof oldData !== 'object') return oldData;
        const typed = oldData as { data: Record<string, unknown> };
        return { ...typed, data: { ...typed.data, ...response.data } };
      });

      // 프로젝트 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.PROJECTS.lists() });
    },
  });
};
