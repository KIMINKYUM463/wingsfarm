/**
 * 자산 목록 조회 훅 (무한 스크롤)
 */

import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getAssets } from '../api';
import { queryKeys } from '@/shared/constants/queryKeys';
import type { AssetStatus } from '../types';

interface UseAssetsOptions {
  /** 자산 상태 필터 */
  status?: AssetStatus;
  /** 한 번에 가져올 자산 수 (기본: 50) */
  limit?: number;
  /** 파일명 검색 키워드 */
  search?: string;
}

export const useAssets = ({ status, limit = 50, search }: UseAssetsOptions = {}) => {
  const query = useInfiniteQuery({
    queryKey: queryKeys.ASSETS.list({ status, limit, search }),
    queryFn: ({ pageParam }) => getAssets({ status, limit, cursor: pageParam, search }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // 평탄화된 assets 배열
  const assets = useMemo(
    () => query.data?.pages.flatMap((page) => page.assets) ?? [],
    [query.data],
  );

  // 전체 개수 (API에서 제공하면 사용, 아니면 현재 로드된 개수)
  const total = query.data?.pages[0]?.total ?? assets.length;

  return {
    assets,
    total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
};
