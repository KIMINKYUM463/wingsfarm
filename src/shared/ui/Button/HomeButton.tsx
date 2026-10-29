import { clsx } from 'clsx';
import { BRAND } from '@/lib/brand';
import { ROUTES } from '@/shared/constants/routes';
import Icon from '@/shared/ui/Icon';

interface HomeButtonProps {
  /** 아이콘만 표시 (편집기 헤더는 제목 입력칸 자리 때문에 폭이 좁다) */
  compact?: boolean;
  className?: string;
}

/**
 * 상세페이지 → 윙스팜AI 메인(대시보드)으로 돌아가는 버튼
 * 메인은 루트 레이아웃이 달라 Link(클라이언트 이동)를 쓰면 Turbopack이 메인 CSS를 못 찾으므로 일반 a 태그로 이동한다
 */
const HomeButton = ({ compact = false, className }: HomeButtonProps) => (
  <a
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
  </a>
);

export default HomeButton;
