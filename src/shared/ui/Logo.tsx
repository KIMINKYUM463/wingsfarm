import Link from 'next/link';
import { ROUTES } from '@/shared/constants/routes';
import CustomIcon from '@/shared/ui/CustomIcon';

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

const Logo = ({
  color = 'black',
  symbolOnly = false,
  symbolClassName = '',
  logoClassName = '',
  symbolWidth = 18.18,
  symbolHeight = 20,
  logoWidth = 93.62,
  logoHeight = 14,
}: LogoProps) => {
  const colorClass = color === 'white' ? 'text-white' : 'text-[#101010]';

  return (
    <Link href={ROUTES.PROJECTS} className="z-50 flex cursor-pointer items-center gap-1 pl-3">
      <CustomIcon
        name="leverpage-symbol-black"
        width={symbolWidth}
        height={symbolHeight}
        className={`${colorClass} ${symbolClassName}`}
      />
      {!symbolOnly && (
        <CustomIcon
          name="leverpage-logotype-black"
          width={logoWidth}
          height={logoHeight}
          className={`${colorClass} ${logoClassName}`}
        />
      )}
    </Link>
  );
};

export default Logo;
