import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProject } from '@/features/detail-page/api';
import { queryKeys } from '@/shared/constants/queryKeys';
import type { CreateProjectRequest, CreateProjectResponseData } from '@/features/detail-page/types';

/**
 * 프로젝트 초안 생성 훅
 *
 * 템플릿 기반으로 빈 프로젝트를 자동 생성합니다.
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useCreateProject();
 *
 * mutate(
 *   { productName: '아이폰 케이스', categoryId: 'fashion' },
 *   {
 *     onSuccess: (data) => {
 *       router.push(`/projects/${data.id}`);
 *     },
 *   }
 * );
 * ```
 */
export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateProjectRequest): Promise<CreateProjectResponseData> => {
      return createProject(request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.PROJECTS.lists() });
    },
    retry: 1,
  });
};
