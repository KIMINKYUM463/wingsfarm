'use client';

import React from 'react';
import Logo from '@/shared/ui/Logo';
import IconButton from '@/shared/ui/Button/IconButton';
import Popover from '../Popover/Popover';
import CustomIcon from '@/shared/ui/CustomIcon';

export function CreateDetailPageHeader() {
  // 인증 체크는 서버 컴포넌트(page.tsx)에서 requireAuth()로 처리됨

  return (
    <header className="bg-white fixed top-0 left-0 right-0 z-50 h-(--header-h) flex-center-between px-content">
      <Logo />
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
        <IconButton className="btn-primary" icon="arrow_outward" text="시작하기" />
      </div>
    </header>
  );
}
