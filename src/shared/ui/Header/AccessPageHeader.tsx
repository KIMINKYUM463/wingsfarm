import IconButton from '@/shared/ui/Button/IconButton';
import CustomIcon from '@/shared/ui/CustomIcon';
import Logo from '@/shared/ui/Logo';
import Popover from '@/shared/ui/Popover/Popover';
import React from 'react';

const AccessPageHeader = () => {
  return (
    <header className="bg-white fixed top-0 left-0 right-0 z-50 h-(--header-h) flex-center-between px-content">
      <Logo />
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
    </header>
  );
};

export default AccessPageHeader;
