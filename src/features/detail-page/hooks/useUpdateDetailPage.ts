/**
 * 상세 페이지 업데이트 훅
 */

import { useMutation } from '@tanstack/react-query';
import { updateDetailPage } from '../api';

export const useUpdateDetailPage = () => {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateDetailPage(id, data),
    onSuccess: () => {},
    onError: (error) => {
      console.error('상세 페이지 업데이트 실패:', error);
    },
  });
};
