'use client';

/**
 * 구독 해지 훅
 *
 * 구독 해지 예약을 처리합니다.
 * 즉시 해지되지 않고 currentPeriodEnd까지 서비스 이용 가능합니다.
 * 에러는 MutationCache.onError에서 전역 처리됩니다.
 */

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { showToast } from '@/utils/toast';
import { cancelSubscription } from '@/app/actions/payment';
import type { CancelSubscriptionData } from '@/shared/types/subscription.types';

interface UseCancelSubscriptionOptions {
  onSuccess?: (data: CancelSubscriptionData) => void;
}

/**
 * 구독 해지 mutation 훅
 *
 * @example
 * const { mutate, isPending } = useCancelSubscription({
 *   onSuccess: () => console.log('해지 완료'),
 * });
 *
 * <Button isLoading={isPending} onClick={() => mutate()}>
 *   구독해지
 * </Button>
 */
export const useCancelSubscription = (options?: UseCancelSubscriptionOptions) => {
  const router = useRouter();

  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (data) => {
      showToast.success('구독이 해지 예약되었습니다.');
      router.refresh();
      options?.onSuccess?.(data);
    },
  });
};
