'use client';

/**
 * 프로젝트 목록 조회 훅 (무한 스크롤 + 검색/정렬 상태 관리)
 */

import { useState, useMemo, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getProjectsWithPagination } from '../api';
import { queryKeys } from '@/shared/constants/queryKeys';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { ProjectFilter, ProjectSortOption, ProjectSortBy, ProjectSortOrder } from '../types';

interface UseProjectsOptions {
  /** 한 번에 가져올 프로젝트 수 */
  limit: number;
}

/**
 * UI 정렬 옵션 → API 파라미터 변환
 *
 * | UI 옵션 | sortBy | sortOrder |
 * |---------|--------|-----------|
 * | recent  | updatedAt | desc |
 * | name    | title | asc |
 */
const getSortParams = (
  sort: ProjectSortOption,
): { sortBy: ProjectSortBy; sortOrder: ProjectSortOrder } => {
  switch (sort) {
    case 'name':
      return { sortBy: 'title', sortOrder: 'asc' };
    case 'recent':
    default:
      return { sortBy: 'updatedAt', sortOrder: 'desc' };
  }
};

export const useProjects = ({ limit }: UseProjectsOptions) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<ProjectSortOption>('recent');
  const [filter, setFilter] = useState<ProjectFilter>('all');

  const debouncedSearch = useDebounce(searchQuery, 300);
  const searchParam = debouncedSearch || undefined;

  const { sortBy, sortOrder } = getSortParams(sort);

  const query = useInfiniteQuery({
    queryKey: queryKeys.PROJECTS.list({ limit, sortBy, sortOrder, search: searchParam, filter }),
    queryFn: ({ pageParam }) =>
      getProjectsWithPagination({
        cursor: pageParam,
        limit,
        sortBy,
        sortOrder,
        search: searchParam,
        filter,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // 평탄화된 projects 배열
  const projects = useMemo(
    () => query.data?.pages.flatMap((page) => page.projects) ?? [],
    [query.data],
  );

  const handleSortChange = useCallback((value: ProjectSortOption) => {
    setSort(value);
  }, []);

  /** Dropdown onChange 핸들러 (option.id → ProjectSortOption 변환) */
  const handleDropdownSortChange = useCallback((option: { id: string; label: string }) => {
    setSort(option.id as ProjectSortOption);
  }, []);

  return {
    // 데이터
    projects,
    // 로딩 상태
    isLoading: query.isLoading,
    // 무한 스크롤
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    // 검색/정렬 상태
    searchQuery,
    sort,
    filter,
    setFilter,
    setSearchQuery: (value: string) => setSearchQuery(value),
    setSort: handleSortChange,
    /** Dropdown용 핸들러 */
    handleSortChange: handleDropdownSortChange,
  };
};
