/**
 * 작업 내역 카드 메뉴 — 즐겨찾기 · 휴지통 · 복원 · 영구 삭제 · 사본 (목록 캐시 낙관적 업데이트)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteProject, duplicateProject, restoreProject, updateProject } from '../api';
import { queryKeys } from '@/shared/constants/queryKeys';
import type { Project, ProjectsApiResponse } from '../types';

type ProjectsData = { pages: ProjectsApiResponse['data'][] };

/** 목록 캐시를 먼저 고치고(즉시 반영), 실패하면 되돌린 뒤, 끝나면 서버 값으로 다시 맞춘다 */
function useProjectListMutation<V>(
  mutationFn: (variables: V) => Promise<unknown>,
  patchList: (projects: Project[], variables: V) => Project[],
) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.PROJECTS.lists();

  return useMutation({
    mutationFn,
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previousData = queryClient.getQueriesData<ProjectsData>({ queryKey: listKey });
      queryClient.setQueriesData<ProjectsData>({ queryKey: listKey }, (old) =>
        old && {
          ...old,
          pages: old.pages.map((page) => ({ ...page, projects: patchList(page.projects, variables) })),
        },
      );
      return { previousData };
    },
    onError: (_error, _variables, context) => {
      context?.previousData.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}

const without = (projects: Project[], id: string) => projects.filter((p) => p.id !== id);

/** 휴지통으로 옮기기 (permanent: 휴지통에서 영구 삭제) */
export const useDeleteProject = () =>
  useProjectListMutation(deleteProject, (projects, { id }: { id: string; permanent?: boolean }) => without(projects, id));

export const useRestoreProject = () => useProjectListMutation(restoreProject, without);

export const useToggleFavorite = () =>
  useProjectListMutation(
    ({ id, favorite }: { id: string; favorite: boolean }) => updateProject(id, { favorite }),
    (projects, { id, favorite }) => projects.map((p) => (p.id === id ? { ...p, favorite } : p)),
  );

export const useDuplicateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: duplicateProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.PROJECTS.lists() }),
  });
};
