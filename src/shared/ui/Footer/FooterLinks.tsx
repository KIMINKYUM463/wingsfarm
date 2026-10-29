'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { ROUTES } from '@/shared/constants/routes';

interface FooterLinksProps {
  className?: string;
  dividerClassName?: string;
  openInNewTab?: boolean;
}

const FooterLinks = ({ className, dividerClassName, openInNewTab }: FooterLinksProps) => {
  const pathname = usePathname();
  const linkProps = openInNewTab ? { target: '_blank' as const, rel: 'noopener noreferrer' } : {};

  return (
    <div className={clsx('flex items-center gap-2 flex-wrap', className)}>
      <Link
        href={ROUTES.TERMS}
        className="hover:text-gray-400 focus-visible:text-gray-400 rounded-sm transition-colors"
        {...linkProps}
      >
        <p className={clsx(pathname === ROUTES.TERMS && 'p-bold')}>이용약관</p>
      </Link>
      <span className={dividerClassName}>|</span>
      <Link
        href={ROUTES.PRIVACY}
        className="hover:text-gray-400 rounded-sm transition-colors"
        {...linkProps}
      >
        <p className={clsx(pathname === ROUTES.PRIVACY && 'p-bold')}>개인정보처리방침</p>
      </Link>
      <span className={dividerClassName}>|</span>
      <Link
        href={ROUTES.REFUND}
        className="hover:text-gray-400 rounded-sm transition-colors"
        {...linkProps}
      >
        <p className={clsx(pathname === ROUTES.REFUND && 'p-bold')}>환불정책</p>
      </Link>
    </div>
  );
};

export default FooterLinks;
