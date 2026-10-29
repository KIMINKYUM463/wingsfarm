'use client';

import { useRef, cloneElement, ReactElement, ComponentProps } from 'react';
import Button from '@/shared/ui/Button/Button';
import { usePopover } from '@/shared/hooks/usePopover';
import CloseButton from '@/shared/ui/Dialog/shared/CloseButton';
import { useClickOutside } from '@/shared/hooks/useClickOutside';
import { PopoverContentType } from '@/shared/lib/ui';
import DownloadPopover from '@/shared/ui/Popover/DownloadPopover';
import FileUploadPopover from './FileUploadPopover';
import UserProfilePopover from './UserProfilePopover';
import clsx from 'clsx';

type ButtonElement = ReactElement<ComponentProps<typeof Button>>;

// ✅ position prop의 타입
type PopoverPosition = 'alignLeft' | 'alignRight' | 'alignCenter' | 'fixedRight';

interface PopoverContainerProps {
  trigger: ButtonElement;
  contentType: PopoverContentType;
  hasBackButton?: boolean;
  /**
   * Popover의 x축 정렬 위치를 지정합니다.
   * - `alignLeft`: 트리거의 왼쪽에 맞춰 정렬
   * - `alignRight`: 트리거의 오른쪽에 맞춰 정렬 (기본값)
   * - `alignCenter`: 트리거의 중앙에 맞춰 정렬
   * - `fixedRight`: 뷰포트 기준 오른쪽에서 8px 떨어진 위치 (헤더용)
   */
  position?: PopoverPosition;
  /**
   * 트리거와 팝오버 사이의 간격 (기본값: 0.5rem = 8px)
   */
  offset?: string;
}

/**
 * 버튼 기준 상대 위치 Popover 컨테이너
 */
export default function Popover({
  trigger,
  contentType,
  hasBackButton = true,
  position = 'alignRight',
  offset = '0.5rem',
}: PopoverContainerProps) {
  const { isOpen, open, close } = usePopover();
  const popoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(popoverRef, {
    onClickOutside: close,
    onEscape: close,
    enabled: isOpen,
  });

  const renderContent = () => {
    switch (contentType) {
      case 'download':
        return <DownloadPopover />;
      case 'fileUpload':
        return <FileUploadPopover />;
      case 'userProfile':
        return <UserProfilePopover />;
      default:
        return null;
    }
  };

  const triggerWithClick = cloneElement(trigger, {
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      open();
      const originalOnClick = trigger.props.onClick;
      if (originalOnClick) {
        originalOnClick(e);
      }
    },
  });

  return (
    <div className="relative">
      {triggerWithClick}
      {isOpen && (
        <div
          ref={popoverRef}
          className={clsx(
            'z-9999 overflow-hidden rounded-lg bg-white shadow-md',
            position === 'fixedRight' ? 'fixed top-(--header-h) right-2' : 'absolute',
            position === 'alignLeft' && 'left-0',
            position === 'alignRight' && 'right-0',
            position === 'alignCenter' && 'left-1/2 -translate-x-1/2',
          )}
          style={position !== 'fixedRight' ? { top: `calc(100% + ${offset})` } : undefined}
        >
          {hasBackButton && <CloseButton onClick={close} />}
          {renderContent()}
        </div>
      )}
    </div>
  );
}
