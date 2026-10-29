/**
 * 상세 페이지 생성 훅
 */

import { useMutation } from '@tanstack/react-query';
import { createDetailPage } from '../api';

export const useCreateDetailPage = () => {
  return useMutation({
    mutationFn: createDetailPage,
    onSuccess: () => {},
    onError: (error) => {
      console.error('상세 페이지 생성 실패:', error);
    },
  });
};
