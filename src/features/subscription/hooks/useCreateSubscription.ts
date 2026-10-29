'use client';

/**
 * 구독 생성 훅
 *
 * 빌링키 확인 → 구독 생성을 한 번에 처리합니다.
 * 에러는 MutationCache.onError에서 전역 처리됩니다.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { showToast } from '@/utils/toast';
import { getBillingKeys, createSubscription } from '@/app/actions/payment';
import { queryKeys } from '@/shared/constants/queryKeys';
import { ROUTES } from '@/shared/constants/routes';
import type { BillingKey, CreateSubscriptionRequest } from '@/shared/types/subscription.types';

/** 빌링키 없음 결과 */
type NoBillingKeyResult = { type: 'NO_BILLING_KEY' };

/** 성공 결과 */
type SuccessResult = { type: 'SUCCESS'; billingKey: BillingKey };

type MutationResult = NoBillingKeyResult | SuccessResult;

interface UseCreateSubscriptionOptions {
  onSuccess?: (billingKey: BillingKey) => void;
  onNoBillingKey?: () => void;
}

/**
 * 구독 생성 mutation 훅
 *
 * @example
 * const { mutate, isPending } = useCreateSubscription({
 *   onSuccess: (billingKey) => {
 *     onClose();
 *     openModal('paymentComplete', { paymentMethod: billingKey.cardName });
 *   },
 *   onNoBillingKey: () => onClose(),
 * });
 *
 * <Button isLoading={isPending} onClick={() => mutate({ planId, billingCycle: 'monthly' })}>
 *   다음
 * </Button>
 */
export const useCreateSubscription = (options?: UseCreateSubscriptionOptions) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateSubscriptionRequest): Promise<MutationResult> => {
      // 1. 빌링키(결제수단) 조회 (에러 시 throw → 전역 처리)
      const billingKeys = await getBillingKeys();

      // 2. 빌링키 없으면 결과만 반환 (에러 아님)
      if (!billingKeys.length) {
        return { type: 'NO_BILLING_KEY' };
      }

      // 3. 구독 생성 (에러 시 throw → 전역 처리)
      await createSubscription(request);

      return { type: 'SUCCESS', billingKey: billingKeys[0] };
    },
    onSuccess: (result) => {
      if (result.type === 'NO_BILLING_KEY') {
        options?.onNoBillingKey?.(); // 모달 먼저 닫기
        showToast.error('등록된 결제수단이 없습니다. 결제수단을 먼저 등록해주세요.');
        router.push(ROUTES.PRICING_METHODS);
        return;
      }

      // 결제 내역 캐시 무효화 + SSR 데이터 갱신
      queryClient.invalidateQueries({ queryKey: queryKeys.PAYMENTS.history() });
      router.refresh();

      options?.onSuccess?.(result.billingKey);
    },
  });
};
