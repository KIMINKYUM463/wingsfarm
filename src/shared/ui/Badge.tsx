import { clsx } from 'clsx';
import { ReactNode } from 'react';

type BadgeType = 'ai' | 'required';

interface BadgeProps {
  type: BadgeType;
  className?: string;
  children?: ReactNode;
}

const badgeStyles: Record<BadgeType, string> = {
  ai: 'bg-(--color-primary-100) text-(--color-point) border border-[rgba(93,173,236,0.2)]',
  required: 'bg-[#fff2f2] text-[#e65050] border border-[rgba(230,80,80,0.2)]',
};

const defaultLabels: Record<BadgeType, string> = {
  ai: 'AI',
  required: '필수',
};

/**
 * 통합 뱃지 컴포넌트
 * - type에 따라 스타일 적용, children으로 커스텀 텍스트 가능
 * - children 없으면 기본 라벨 사용
 */
const Badge = ({ type, className, children }: BadgeProps) => {
  return (
    <span
      className={clsx(
        'description flex h-5 items-center justify-center rounded-sm px-1',
        badgeStyles[type],
        className,
      )}
    >
      {children ?? defaultLabels[type]}
    </span>
  );
};

export default Badge;
