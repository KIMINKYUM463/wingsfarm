'use client';

/**
 * 빌링키(결제수단) 삭제 훅
 *
 * 결제수단 삭제를 처리합니다.
 * 삭제 시 구독도 자동으로 해지됩니다.
 * 에러는 MutationCache.onError에서 전역 처리됩니다.
 */

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { showToast } from '@/utils/toast';
import { deleteBillingKey } from '@/app/actions/payment';
import type { DeleteBillingKeyData } from '@/shared/types/subscription.types';

interface UseDeleteBillingKeyOptions {
  onSuccess?: (data: DeleteBillingKeyData) => void;
}

/**
 * 빌링키 삭제 mutation 훅
 *
 * @example
 * const { mutate, isPending } = useDeleteBillingKey({
 *   onSuccess: () => console.log('삭제 완료'),
 * });
 *
 * <Button isLoading={isPending} onClick={() => mutate(billingKeyId)}>
 *   삭제하기
 * </Button>
 */
export const useDeleteBillingKey = (options?: UseDeleteBillingKeyOptions) => {
  const router = useRouter();

  return useMutation({
    mutationFn: deleteBillingKey,
    onSuccess: (data) => {
      showToast.success('결제 수단이 삭제되었습니다.');
      router.refresh();
      options?.onSuccess?.(data);
    },
  });
};
