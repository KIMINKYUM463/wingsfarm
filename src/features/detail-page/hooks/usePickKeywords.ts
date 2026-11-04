/**
 * AI 키워드 자동 선정 (「AI 판단」)
 * 후보 그룹에서 이 상품에 맞는 키워드만 골라 반환한다.
 */

import { useMutation } from '@tanstack/react-query';
import { pickKeywords } from '../api';
import type { GenerateKeywordsResponseData } from '../types';

export const usePickKeywords = () => {
  return useMutation({
    mutationFn: async (projectId: string): Promise<GenerateKeywordsResponseData> => {
      return pickKeywords(projectId);
    },
  });
};
