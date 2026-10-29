import React from 'react';
import { clsx } from 'clsx';

interface VerticalDividerProps {
  /** 높이 (Tailwind class, 기본값: h-5 = 20px) */
  height?: string;
  /** 색상 (Tailwind class, 기본값: bg-gray-100) */
  color?: string;
  /** 추가 className */
  className?: string;
}

/**
 * 세로 구분선 컴포넌트
 * Figma 디자인의 벡터 divider를 위한 순수 컴포넌트
 *
 * ## 사용 예시
 * ```tsx
 * <VerticalDivider />
 * <VerticalDivider height="h-6" color="bg-gray-200" />
 * ```
 */
const VerticalDivider: React.FC<VerticalDividerProps> = ({
  height = 'h-3.25',
  color = 'bg-gray-100',
  className,
}) => {
  return <div className={clsx('w-px shrink-0 text-center', height, color, className)} />;
};

export default VerticalDivider;
