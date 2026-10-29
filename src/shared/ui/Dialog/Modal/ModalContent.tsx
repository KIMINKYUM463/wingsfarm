'use client';

import { ReactNode, MouseEvent } from 'react';
import { clsx } from 'clsx';
import { CloseButton } from '../shared';

type ModalWidth = 'sm' | 'md' | 'lg';

// Tailwind가 빌드 시 감지할 수 있도록 정적 클래스 매핑
const WIDTH_CLASSES: Record<ModalWidth, string> = {
  sm: 'max-w-(--max-w-modal-sm)',
  md: 'max-w-(--max-w-modal-md)',
  lg: 'max-w-(--max-w-modal-lg)',
};

interface ModalContentProps {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  showCloseButton?: boolean;
  /** 모달 최대 너비 (sm: 24rem, md: 35rem, lg: 42rem) */
  maxW?: ModalWidth;
}

/**
 * ModalContent - 모달 컨텐츠 컨테이너
 * - 스타일, 닫기 버튼 제공
 * - 이벤트 버블링 방지
 */
const ModalContent = ({
  children,
  onClose,
  className,
  showCloseButton = true,
  maxW = 'sm',
}: ModalContentProps) => {
  const handleContentClick = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={clsx('relative z-10 w-full', WIDTH_CLASSES[maxW], className)}
      onClick={handleContentClick}
    >
      {children}
      {showCloseButton && <CloseButton onClick={onClose} />}
    </div>
  );
};

export default ModalContent;
