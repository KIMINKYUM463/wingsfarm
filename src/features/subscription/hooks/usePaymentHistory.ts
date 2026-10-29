'use client';

/**
 * 결제 내역 조회 훅 (무한 스크롤)
 */

import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getPaymentHistory } from '@/app/actions/payment';
import { queryKeys } from '@/shared/constants/queryKeys';

/** 한 번에 가져올 기본 개수 */
const DEFAULT_LIMIT = 20;

interface UsePaymentHistoryOptions {
  /** 한 번에 가져올 결제 내역 수 (기본: 20) */
  limit?: number;
}

export const usePaymentHistory = ({ limit = DEFAULT_LIMIT }: UsePaymentHistoryOptions = {}) => {
  const query = useInfiniteQuery({
    queryKey: queryKeys.PAYMENTS.history(),
    queryFn: async ({ pageParam = 0 }) => {
      return getPaymentHistory({ limit, offset: pageParam });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination.hasMore) return undefined;
      return lastPage.pagination.offset + lastPage.pagination.limit;
    },
  });

  // 평탄화된 payments 배열
  const payments = useMemo(
    () => query.data?.pages.flatMap((page) => page.payments) ?? [],
    [query.data],
  );

  // 전체 개수
  const total = query.data?.pages[0]?.pagination.total ?? 0;

  return {
    payments,
    total,
    isLoading: query.isLoading,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  };
};
