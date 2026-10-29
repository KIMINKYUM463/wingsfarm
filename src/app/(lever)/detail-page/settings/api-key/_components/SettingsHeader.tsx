'use client';

import Logo from '@/shared/ui/Logo';
import Popover from '@/shared/ui/Popover/Popover';
import IconButton from '@/shared/ui/Button/IconButton';
import HomeButton from '@/shared/ui/Button/HomeButton';
import CustomIcon from '@/shared/ui/CustomIcon';

const SettingsHeader = () => {
  return (
    <header className="flex-center-between px-content fixed top-0 right-0 left-0 z-50 h-(--header-h) bg-white">
      <Logo />
      <div className="flex items-center gap-2">
        <HomeButton />
        <Popover
          contentType="userProfile"
          position="alignRight"
          hasBackButton={false}
          trigger={
            <IconButton
              customIcon={<CustomIcon name="profile" width={32} height={32} />}
              className="h-(--btn-h) rounded-full p-[0.3175rem] hover:bg-gray-100 focus:bg-gray-100"
            />
          }
        />
      </div>
    </header>
  );
};

export default SettingsHeader;
