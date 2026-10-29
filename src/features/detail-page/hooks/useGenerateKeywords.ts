/**
 * AI 키워드 생성 훅
 *
 * 프로젝트의 productName과 categoryId를 기반으로 AI가 키워드를 동적 생성합니다.
 * 기본적으로 캐시를 사용하며, forceRefresh 옵션으로 강제 재생성할 수 있습니다.
 *
 * @example
 * ```tsx
 * // 기본 사용 (캐시 활용)
 * const { data, isLoading, error } = useGenerateKeywords(projectId);
 *
 * // 강제 재생성
 * const { data, isLoading, error } = useGenerateKeywords(projectId, { forceRefresh: true });
 *
 * // 조건부 실행 (Step1 완료 후)
 * const { data, isLoading } = useGenerateKeywords(projectId, undefined, step >= 2);
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import httpClient from '@/shared/lib/httpClient';
import { ENDPOINTS } from '@/shared/constants/endpoints';
import { queryKeys } from '@/shared/constants/queryKeys';
import type {
  GenerateKeywordsRequest,
  GenerateKeywordsResponse,
  GenerateKeywordsData,
} from '@/shared/types/category';

interface UseGenerateKeywordsOptions {
  enabled?: boolean;
  request?: GenerateKeywordsRequest;
}

export const useGenerateKeywords = (
  projectId: string,
  options?: UseGenerateKeywordsOptions,
) => {
  const { enabled = true, request } = options || {};

  return useQuery({
    queryKey: queryKeys.PROJECTS.keyword(projectId),
    queryFn: async (): Promise<GenerateKeywordsData> => {
      const response = await httpClient.post<GenerateKeywordsResponse>(
        ENDPOINTS.PROJECTS.GENERATE_KEYWORDS(projectId),
        request,
        {
          withAuth: true,
        },
      );

      return response.data;
    },
    enabled: enabled && !!projectId,
    staleTime: 1000 * 60 * 60, // 1시간 - 동일한 productName + categoryId는 캐시 활용
    gcTime: 1000 * 60 * 60 * 24, // 24시간 - 오래 보관
  });
};
