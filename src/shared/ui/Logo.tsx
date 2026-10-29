import Link from 'next/link';
import { LogoMark } from '@/components/Logo';
import { BRAND } from '@/lib/brand';
import { ROUTES } from '@/shared/constants/routes';

type LogoColor = 'white' | 'black';

interface LogoProps {
  color?: LogoColor;
  symbolOnly?: boolean;
  symbolClassName?: string;
  logoClassName?: string;
  symbolWidth?: number;
  symbolHeight?: number;
  logoWidth?: number;
  logoHeight?: number;
}

/** 윙스팜AI 심볼 + "윙스팜AI 상세페이지" 글자 로고 (상세페이지 화면 헤더 공용) */
const Logo = ({
  color = 'black',
  symbolOnly = false,
  symbolClassName = '',
  logoClassName = '',
  symbolHeight = 20,
  logoHeight = 14,
}: LogoProps) => {
  const colorClass = color === 'white' ? 'text-white' : 'text-[#101010]';

  return (
    <Link
      href={ROUTES.PROJECTS}
      aria-label={`${BRAND} 상세페이지`}
      className="z-50 flex cursor-pointer items-center gap-1.5 pl-3"
    >
      <span className={`flex ${symbolClassName}`}>
        <LogoMark size={Math.round(symbolHeight * 1.2)} />
      </span>
      {!symbolOnly && (
        <span
          className={`font-extrabold whitespace-nowrap tracking-tight ${colorClass} ${logoClassName}`}
          style={{ fontSize: logoHeight + 2 }}
        >
          {BRAND} <span className="text-(--color-point)">상세페이지</span>
        </span>
      )}
    </Link>
  );
};

export default Logo;
