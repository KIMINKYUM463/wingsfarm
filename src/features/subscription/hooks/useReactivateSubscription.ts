'use client';

/**
 * 구독 재활성화 훅
 *
 * 구독 해지 예약을 취소하고 자동 갱신을 다시 활성화합니다.
 * 에러는 MutationCache.onError에서 전역 처리됩니다.
 */

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { showToast } from '@/utils/toast';
import { reactivateSubscription } from '@/app/actions/payment';
import type { ReactivateSubscriptionData } from '@/shared/types/subscription.types';

interface UseReactivateSubscriptionOptions {
  onSuccess?: (data: ReactivateSubscriptionData) => void;
}

/**
 * 구독 재활성화 mutation 훅
 *
 * @example
 * const { mutate, isPending } = useReactivateSubscription({
 *   onSuccess: () => console.log('재활성화 완료'),
 * });
 *
 * <Button isLoading={isPending} onClick={() => mutate()}>
 *   구독해지 취소
 * </Button>
 */
export const useReactivateSubscription = (options?: UseReactivateSubscriptionOptions) => {
  const router = useRouter();

  return useMutation({
    mutationFn: reactivateSubscription,
    onSuccess: (data) => {
      showToast.success('구독이 다시 활성화되었습니다.');
      router.refresh();
      options?.onSuccess?.(data);
    },
  });
};
