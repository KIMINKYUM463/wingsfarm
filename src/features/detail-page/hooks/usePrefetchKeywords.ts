/**
 * AI 키워드 프리페치 훅
 *
 * 버튼 클릭 시 수동으로 키워드를 생성하고 React Query 캐시에 저장합니다.
 * 이후 Step에서 useGenerateKeywords 훅으로 캐시된 데이터를 즉시 사용할 수 있습니다.
 *
 * @example
 * ```tsx
 * const { mutate: prefetchKeywords, isPending } = usePrefetchKeywords();
 *
 * const handleStart = () => {
 *   prefetchKeywords(projectId, {
 *     onSuccess: () => {
 *       openModal('productInfo', { projectId });
 *     },
 *   });
 * };
 * ```
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateKeywords } from '../api';
import { queryKeys } from '@/shared/constants/queryKeys';
import type { GenerateKeywordsResponseData } from '../types';

export const usePrefetchKeywords = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string): Promise<GenerateKeywordsResponseData> => {
      return generateKeywords(projectId);
    },
    onSuccess: (data, projectId) => {
      // React Query 캐시에 저장 (useGenerateKeywords에서 사용)
      queryClient.setQueryData(queryKeys.PROJECTS.keyword(projectId), data);
    },
  });
};
