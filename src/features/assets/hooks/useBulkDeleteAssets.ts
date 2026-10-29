/**
 * 자산 벌크 삭제 훅 (선택 상태 관리 + 낙관적 업데이트)
 */

import { useState } from 'react';
import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { bulkDeleteAssets } from '../api';
import { queryKeys } from '@/shared/constants/queryKeys';
import type { GetAssetsData } from '../types';

export const useBulkDeleteAssets = (
  options?: Pick<UseMutationOptions<number, Error, string[]>, 'onSuccess' | 'onError'>,
) => {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: (idsToDelete: string[]) => {
      // 빈 배열이면 API 호출 없이 바로 반환
      if (idsToDelete.length === 0) return Promise.resolve(0);
      return bulkDeleteAssets(idsToDelete);
    },
    onMutate: async (idsToDelete) => {
      // 빈 배열이면 낙관적 업데이트 불필요
      if (idsToDelete.length === 0) return { previousData: [], previousSelectedIds: [] };

      // 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: queryKeys.ASSETS.lists() });

      // 이전 데이터 스냅샷 저장
      const previousData = queryClient.getQueriesData<{ pages: GetAssetsData[] }>({
        queryKey: queryKeys.ASSETS.lists(),
      });

      // 선택된 ID 저장 (롤백용)
      const previousSelectedIds = [...selectedIds];

      // 낙관적 업데이트: 삭제 대상 제거
      const idsToDeleteSet = new Set(idsToDelete);
      queryClient.setQueriesData<{ pages: GetAssetsData[] }>(
        { queryKey: queryKeys.ASSETS.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => {
              const filteredAssets = page.assets.filter((asset) => !idsToDeleteSet.has(asset.id));
              // 해당 페이지에서 실제로 삭제된 개수만큼 total 감소
              const deletedCount = page.assets.length - filteredAssets.length;
              return {
                ...page,
                assets: filteredAssets,
                total: (page.total ?? 0) - deletedCount,
              };
            }),
          };
        },
      );

      // 선택 해제
      setSelectedIds([]);

      return { previousData, previousSelectedIds };
    },
    onError: (error, variables, context) => {
      // 에러 시 롤백
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      // 선택 상태 복원
      if (context?.previousSelectedIds) {
        setSelectedIds(context.previousSelectedIds);
      }
      // 토스트는 전역 MutationCache.onError에서 처리됨
      options?.onError?.(error, variables, context, undefined as never);
    },
    onSuccess: (...args) => {
      // 성공 시에만 백그라운드에서 데이터 동기화 (즉시 refetch 안 함)
      queryClient.invalidateQueries({
        queryKey: queryKeys.ASSETS.lists(),
        refetchType: 'none',
      });
      options?.onSuccess?.(...args);
    },
  });

  return {
    ...mutation,
    selectedIds,
    setSelectedIds,
    deleteSelected: () => mutation.mutate(selectedIds),
  };
};
