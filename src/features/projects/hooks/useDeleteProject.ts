/**
 * 프로젝트 삭제 훅 (낙관적 업데이트)
 */

import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { deleteProject } from '../api';
import { queryKeys } from '@/shared/constants/queryKeys';
import type { ProjectsApiResponse } from '../types';

type ProjectsData = { pages: ProjectsApiResponse['data'][] };

export const useDeleteProject = (
  options?: Pick<UseMutationOptions<void, Error, string>, 'onSuccess' | 'onError'>,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.PROJECTS.lists() });

      const previousData = queryClient.getQueriesData<ProjectsData>({
        queryKey: queryKeys.PROJECTS.lists(),
      });

      queryClient.setQueriesData<ProjectsData>({ queryKey: queryKeys.PROJECTS.lists() }, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            projects: page.projects.filter((project) => project.id !== projectId),
          })),
        };
      });

      return { previousData };
    },
    onError: (error, projectId, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      options?.onError?.(error, projectId, context, undefined as never);
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.PROJECTS.lists(),
        refetchType: 'none',
      });
      options?.onSuccess?.(...args);
    },
  });
};
