'use client';

import IconButton from '@/shared/ui/Button/IconButton';

interface CloseButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * CloseButton - 다이얼로그 닫기 버튼
 */
const CloseButton = ({ onClick, className = '' }: CloseButtonProps) => {
  return (
    <IconButton
      onClick={onClick}
      className={`absolute top-4 right-4 text-gray-300 hover:bg-gray-100 transition-colors rounded-lg p-1 z-20 ${className}`}
      icon="close"
      aria-label="닫기"
    />
  );
};

export default CloseButton;
