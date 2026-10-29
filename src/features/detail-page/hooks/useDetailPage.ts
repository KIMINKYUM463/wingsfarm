/**
 * 특정 상세 페이지 조회 훅
 */

import { useQuery } from '@tanstack/react-query';
import { getDetailPageById } from '../api';
import { queryKeys } from '@/shared/constants/queryKeys';

export const useDetailPage = (id: string) => {
  return useQuery({
    queryKey: queryKeys.DETAIL_PAGE.detail(id),
    queryFn: () => getDetailPageById(id),
    enabled: !!id,
  });
};
