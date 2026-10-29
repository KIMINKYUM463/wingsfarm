'use client';

/**
 * 빌링키(결제수단) 추가 훅
 *
 * 포트원 SDK로 발급받은 빌링키를 서버에 저장합니다.
 * 에러는 MutationCache.onError에서 전역 처리됩니다.
 */

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { showToast } from '@/utils/toast';
import { addBillingKey } from '@/app/actions/payment';
import type { AddBillingKeyData } from '@/shared/types/subscription.types';

interface UseAddBillingKeyOptions {
  onSuccess?: (data: AddBillingKeyData) => void;
}

/**
 * 빌링키 추가 mutation 훅
 *
 * @example
 * const { mutate, isPending } = useAddBillingKey({
 *   onSuccess: () => console.log('추가 완료'),
 * });
 *
 * // 포트원 SDK에서 빌링키 발급 후
 * mutate(response.billingKey);
 */
export const useAddBillingKey = (options?: UseAddBillingKeyOptions) => {
  const router = useRouter();

  return useMutation({
    mutationFn: addBillingKey,
    onSuccess: (data) => {
      options?.onSuccess?.(data); // 로딩 종료 등 먼저 처리
      showToast.success('결제 수단이 등록되었습니다.');
      router.refresh();
    },
  });
};
