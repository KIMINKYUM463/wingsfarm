/**
 * 상세 페이지 삭제 훅
 */

import { useMutation } from '@tanstack/react-query';
import { deleteDetailPage } from '../api';

export const useDeleteDetailPage = () => {
  return useMutation({
    mutationFn: deleteDetailPage,
    onSuccess: () => {},
    onError: (error) => {
      console.error('상세 페이지 삭제 실패:', error);
    },
  });
};
