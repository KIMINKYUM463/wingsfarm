'use client';

import Link from 'next/link';
import Logo from '@/shared/ui/Logo';
import IconButton from '@/shared/ui/Button/IconButton';
import Popover from '../Popover/Popover';
import CustomIcon from '@/shared/ui/CustomIcon';
import CreditButton from '@/shared/ui/Button/CreditButton';

export function ProjectSetupPageHeader() {
  return (
    <header className="bg-white shadow-none fixed top-0 left-0 right-0 z-50 h-(--header-h) flex-center-between px-content">
      <Logo />
      <nav className="absolute left-1/2 -translate-x-1/2 flex gap-6">
        <Link href="#" className="title-1">
          사용방법
        </Link>
        <Link href="#" className="title-1">
          요금제
        </Link>
      </nav>
      <div className="flex gap-3">
        <Popover
          contentType="userProfile"
          position="alignRight"
          hasBackButton={false}
          trigger={
            <IconButton
              customIcon={<CustomIcon name="profile" width={32} height={32} />}
              className="h-(--btn-h) p-[0.3175rem] rounded-full hover:bg-gray-100 focus:bg-gray-100"
            />
          }
        />
        {/* TODO: 크레딧 잔액 버튼 임시 숨김 */}
        {/* <CreditButton iconSize={28} className="gap-2" /> */}
        <IconButton className="btn-primary" icon="arrow_outward" text="시작하기" />
      </div>
    </header>
  );
}
