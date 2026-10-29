import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCredits } from './useCredits';
import { useDialog } from '@/shared/ui/Dialog/useDialog';
import { ROUTES } from '@/shared/constants/routes';
import { queryKeys } from '@/shared/constants/queryKeys';
import { getMyCredits } from '../api';

/**
 * 크레딧 잔액 체크 훅
 *
 * 크레딧이 필요한 액션 실행 전 잔액을 확인하고,
 * 부족할 경우 충전 안내 다이얼로그를 표시합니다.
 *
 * @example
 * ```tsx
 * const { checkCredits } = useCreditCheck();
 *
 * const handleStart = async () => {
 *   const hasEnough = await checkCredits(requiredCredits);
 *   if (!hasEnough) return;
 *
 *   // 크레딧 충분 - 액션 실행
 *   startGeneration();
 * };
 * ```
 */
export const useCreditCheck = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { balance } = useCredits();
  const { openConfirm, closeModal } = useDialog();

  /**
   * 크레딧 잔액 체크
   *
   * 항상 서버에서 최신 잔액을 조회하여 정확한 체크를 보장합니다.
   * (캐시된 값은 충전 직후 아직 갱신되지 않았을 수 있음)
   *
   * @param requiredCredits 필요한 크레딧
   * @returns true: 잔액 충분, false: 잔액 부족 (다이얼로그 표시됨)
   */
  const checkCredits = async (requiredCredits: number): Promise<boolean> => {
    // 서버에서 최신 잔액 조회 (캐시 무시)
    const freshCredits = await queryClient.fetchQuery({
      queryKey: queryKeys.CREDITS.me(),
      queryFn: getMyCredits,
      staleTime: 0, // 항상 fresh 데이터 fetch
    });

    const currentBalance = freshCredits?.balance ?? 0;

    // 잔액 충분
    if (currentBalance >= requiredCredits) {
      return true;
    }

    // 잔액 부족 - 충전 안내 다이얼로그
    const goToCharge = await openConfirm({
      title: '크레딧 부족',
      description: '사용 가능한 크레딧이 부족해요.\n충전 후 다시 시도해 주세요.',
      cancelText: '취소',
      confirmText: '충전하기',
    });

    if (goToCharge) {
      closeModal(); // 기존 모달 닫기 (모달 안에서 호출된 경우)
      router.push(ROUTES.PRICING_CREDITS);
    }

    return false;
  };

  return { checkCredits, balance };
};
