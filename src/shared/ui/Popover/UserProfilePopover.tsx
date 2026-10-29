'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
// TODO: 플랜 뱃지 임시 숨김
// import { useMySubscription } from '@/features/payments/hooks/useMySubscription';
import { ROUTES } from '@/shared/constants/routes';
import PopoverMenuList, { PopoverMenuItem } from './PopoverMenuList';
import CustomIcon from '@/shared/ui/CustomIcon';

export default function UserProfilePopover() {
  const router = useRouter();
  const { user } = useAuthStore();
  // TODO: 플랜 뱃지 임시 숨김
  // const { plan, isPending } = useMySubscription();

  const handleProjects = () => {
    router.push(ROUTES.PROJECTS);
  };

  const handleApiKeys = () => {
    router.push(ROUTES.SETTINGS_API_KEY);
  };

  // 윙스팜AI는 로그인이 없으므로 로그아웃 대신 템플릿 관리·대시보드 이동을 둔다
  const menuItems: PopoverMenuItem[] = [
    {
      icon: 'format_list_bulleted',
      label: '프로젝트 목록',
      onClick: handleProjects,
    },
    {
      icon: 'key_vertical',
      label: 'API 키 설정',
      onClick: handleApiKeys,
    },
    {
      icon: 'dashboard_customize',
      label: '템플릿 관리 (Figma)',
      onClick: () => router.push(ROUTES.ADMIN_TEMPLATES),
    },
    {
      icon: 'home',
      label: '윙스팜AI 대시보드',
      // 메인은 루트 레이아웃이 달라 전체 페이지로 이동
      onClick: () => window.location.assign(ROUTES.HOME),
    },
  ];

  return (
    <PopoverMenuList menuItems={menuItems}>
      {/* 사용자 정보 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.25">
            <CustomIcon name="profile" width={32} height={32} />
          </div>
          <div className="flex flex-col gap-0.5">
            <p>{user?.user_metadata.full_name || '사용자'}</p>
            <span className="description text-gray-200">{user?.email || 'email@example.com'}</span>
          </div>
        </div>
        {/* TODO: 플랜 뱃지 임시 숨김 */}
        {/* {isPending ? (
          <span className="h-5 w-14 animate-pulse rounded bg-gray-100" />
        ) : (
          <Badge type={plan} />
        )} */}
      </div>
    </PopoverMenuList>
  );
}
