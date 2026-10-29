'use client';

import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import IconButton from './IconButton';
import CustomIcon from '@/shared/ui/CustomIcon';
import { useCredits, useMySubscription } from '@/features/payments';
import { ROUTES } from '@/shared/constants/routes';

interface CreditButtonProps {
  className?: string;
  iconSize?: number;
  showText?: boolean;
}

/**
 * 크레딧 버튼 컴포넌트
 *
 * 클릭 시:
 * - 구독 유저: 크레딧 충전 페이지로 이동
 * - 미구독 유저: 구독 페이지로 이동
 */
const CreditButton = ({ className, iconSize = 24, showText = true }: CreditButtonProps) => {
  const router = useRouter();
  const { displayCredits } = useCredits();
  const { plan } = useMySubscription();

  const handleClick = () => {
    router.push(plan === 'pro' ? ROUTES.PRICING_CREDITS : ROUTES.PRICING);
  };

  return (
    <IconButton
      customIcon={<CustomIcon name="credit" width={iconSize} height={iconSize} />}
      text={showText ? displayCredits : undefined}
      textClassName="p"
      className={clsx('btn-credit', className)}
      onClick={handleClick}
    />
  );
};

export default CreditButton;
