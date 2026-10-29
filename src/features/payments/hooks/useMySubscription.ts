/**
 * 내 구독 정보 조회 훅 (클라이언트용)
 */

import { useQuery } from '@tanstack/react-query';
import { getMySubscription } from '../api';
import { queryKeys } from '@/shared/constants/queryKeys';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

export type PlanType = 'free' | 'pro';

export const useMySubscription = () => {
  const isSignin = useAuthStore((state) => state.isSignin);

  const query = useQuery({
    queryKey: queryKeys.SUBSCRIPTION.me(),
    queryFn: getMySubscription,
    enabled: isSignin,
    staleTime: 1000 * 60, // 1분
    gcTime: 1000 * 60 * 5, // 5분
  });

  const plan: PlanType = query.data?.hasSubscription ? 'pro' : 'free';

  return {
    ...query,
    plan,
  };
};
