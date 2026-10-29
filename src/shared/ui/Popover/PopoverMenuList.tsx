'use client';

import Button from '@/shared/ui/Button/Button';
import Icon, { IconName } from '@/shared/ui/Icon';

export interface PopoverMenuItem {
  icon: IconName;
  label: string;
  sublabel?: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

interface PopoverMenuListProps {
  /**
   * 상단에 표시할 커스텀 컨텐츠 (사용자 정보, 파일 정보 등)
   */
  children?: React.ReactNode;
  /**
   * 메뉴 아이템 배열
   */
  menuItems: PopoverMenuItem[];
  /**
   * Popover 너비 (기본값: 21.875rem = 350px)
   */
  width?: string;
}

/**
 * Popover 내부에서 사용하는 공통 메뉴 리스트 컴포넌트
 *
 * ## 구조
 * - children (선택): 상단 커스텀 컨텐츠
 * - 구분선
 * - 메뉴 아이템 리스트
 *
 * ## 사용 예시
 * ```tsx
 * <PopoverMenuList
 *   menuItems={[
 *     { icon: 'person', label: '프로필', onClick: handleProfile }
 *   ]}
 * >
 *   <div>사용자 정보</div>
 * </PopoverMenuList>
 * ```
 */
export default function PopoverMenuList({
  children,
  menuItems,
  width = '21.875rem',
}: PopoverMenuListProps) {
  return (
    <div className="p-4" style={{ width }}>
      {/* 상단 커스텀 컨텐츠 */}
      {children && (
        <>
          {children}
          <div className="my-4 h-px bg-gray-100" />
        </>
      )}

      {/* 메뉴 아이템 리스트 */}
      <div className="flex w-full flex-col gap-1">
        {menuItems.map((item, index) => (
          <Button
            key={index}
            onClick={item.onClick}
            disabled={item.disabled}
            className={`flex w-full items-center justify-start gap-2 rounded-md px-3 py-2 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:bg-transparent ${item.className ?? ''}`}
          >
            <Icon name={item.icon} className="shrink-0 text-gray-400" />
            <div className="flex w-full justify-between">
              <span className="text-sm leading-6 font-medium tracking-[-0.28px]">{item.label}</span>
              {item.sublabel && (
                <span className="text-sm leading-6 text-gray-300">{item.sublabel}</span>
              )}
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
