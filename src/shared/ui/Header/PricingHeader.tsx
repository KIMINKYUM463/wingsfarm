'use client';

import Logo from '@/shared/ui/Logo';
import Popover from '@/shared/ui/Popover/Popover';
import IconButton from '@/shared/ui/Button/IconButton';
import CustomIcon from '@/shared/ui/CustomIcon';
import CreditButton from '@/shared/ui/Button/CreditButton';

interface PricingHeaderProps {
  isAuthenticated?: boolean;
}

const PricingHeader = ({ isAuthenticated = true }: PricingHeaderProps) => {
  return (
    <header className="px-content flex-center-between fixed top-0 right-0 left-0 z-50 h-(--header-h) bg-white shadow-[0px_8px_16px_-2px_rgba(29,53,87,0.06),0px_2px_4px_0px_rgba(29,53,87,0.06)]">
      <Logo />

      <div className="flex gap-2">
        {isAuthenticated && (
          <>
            <Popover
              contentType="userProfile"
              position="fixedRight"
              hasBackButton={false}
              trigger={
                <IconButton
                  customIcon={<CustomIcon name="profile" width={32} height={32} />}
                  className="h-(--btn-h) rounded-full p-[0.3175rem] hover:bg-gray-100 focus:bg-gray-100"
                />
              }
            />
            {/* TODO: 크레딧 잔액 버튼 임시 숨김 */}
            {/* <CreditButton /> */}
          </>
        )}
      </div>
    </header>
  );
};

export default PricingHeader;
