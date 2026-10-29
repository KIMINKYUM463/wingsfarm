/**
 * 프로젝트 견적 조회 훅
 *
 * 프로젝트의 프레임별 이미지 개수와 크레딧 견적을 조회합니다.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useProjectEstimate(projectId);
 *
 * // data?.items - 프레임별 견적 항목
 * // data?.totalImageCount - 전체 이미지 수
 * // data?.totalCredit - 전체 크레딧
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { getProjectEstimate } from '../api';
import { queryKeys } from '@/shared/constants/queryKeys';

export const useProjectEstimate = (projectId: string) => {
  return useQuery({
    queryKey: queryKeys.PROJECTS.estimate(projectId),
    queryFn: () => getProjectEstimate(projectId),
    enabled: !!projectId,
    select: (response) => response.data,
    gcTime: 0,
  });
};
