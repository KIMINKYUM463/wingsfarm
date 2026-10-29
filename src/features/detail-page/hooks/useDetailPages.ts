/**
 * 상세 페이지 목록 조회 훅
 */

import { useQuery } from '@tanstack/react-query';
import { getDetailPages } from '../api';
import { queryKeys } from '@/shared/constants/queryKeys';

export const useDetailPages = () => {
  return useQuery({
    queryKey: queryKeys.DETAIL_PAGE.lists(),
    queryFn: getDetailPages,
  });
};
