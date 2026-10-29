import Link from 'next/link';
import { clsx } from 'clsx';
import { BRAND } from '@/lib/brand';
import { ROUTES } from '@/shared/constants/routes';
import Icon from '@/shared/ui/Icon';

interface HomeButtonProps {
  /** 아이콘만 표시 (편집기 헤더는 제목 입력칸 자리 때문에 폭이 좁다) */
  compact?: boolean;
  className?: string;
}

/** 상세페이지 → 윙스팜AI 메인(대시보드)으로 돌아가는 버튼 */
const HomeButton = ({ compact = false, className }: HomeButtonProps) => (
  <Link
    href={ROUTES.HOME}
    title={`${BRAND} 메인으로`}
    aria-label={`${BRAND} 메인으로`}
    className={clsx(
      'btn-outline flex shrink-0 items-center justify-center gap-1',
      compact && 'w-(--btn-h) px-0',
      className,
    )}
  >
    <Icon name="home" width={20} />
    {!compact && <span className="p whitespace-nowrap">{BRAND} 메인</span>}
  </Link>
);

export default HomeButton;
