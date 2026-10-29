/**
 * 크레딧 잔액 조회 훅
 *
 * 캐싱 전략:
 * - staleTime: 30초 (30초간 fresh 상태 유지, 불필요한 refetch 방지)
 * - gcTime: 5분 (비활성 후 5분간 캐시 유지)
 * - refetchOnWindowFocus: true (탭 전환 시 자동 갱신)
 * - refetchOnMount: true (컴포넌트 마운트 시 갱신)
 * - retry: 1 (인증 실패 시 무한 재시도 방지)
 *
 * 크레딧 사용 후 invalidateQueries(['credits'])로 즉시 갱신
 *
 * 레이아웃 시프트 방지:
 * - 로딩/에러 시 '---' 표시 (3자리 고정폭)
 * - 버튼에 min-w-[4rem] 적용 권장
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyCredits } from '../api';
import { queryKeys } from '@/shared/constants/queryKeys';
import { useAuthStore } from '@/features/auth/store/useAuthStore';

/** 로딩/에러 시 표시할 플레이스홀더 (고정폭 유지) */
const CREDITS_PLACEHOLDER = '---';

/** 크레딧 포맷팅 (콤마 구분) */
const formatCredits = (balance: number) => balance.toLocaleString();

export const useCredits = () => {
  const isSignin = useAuthStore((state) => state.isSignin);

  const query = useQuery({
    queryKey: queryKeys.CREDITS.me(),
    queryFn: getMyCredits,
    enabled: isSignin, // 미인증 시 API 호출 방지
    staleTime: 1000 * 30, // 30초
    gcTime: 1000 * 60 * 5, // 5분
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1, // 인증 실패 시 무한 재시도 방지
  });

  const balance = query.data?.balance ?? 0;

  // 데이터 있을 때만 포맷팅, 그 외(로딩/에러/미인증/disabled)는 플레이스홀더
  const displayCredits = query.isSuccess
    ? formatCredits(balance)
    : CREDITS_PLACEHOLDER;

  return {
    ...query,
    balance,
    displayCredits,
    isSignin,
  };
};

/**
 * 크레딧 캐시 무효화 훅
 *
 * 크레딧 사용 후 호출하여 즉시 최신 잔액 반영
 */
export const useInvalidateCredits = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.CREDITS.all });
  };
};
