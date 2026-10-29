import clsx from 'clsx';

type SkeletonVariant = 'rect' | 'circle' | 'text';
type SkeletonBg = 'gray-50' | 'gray-100' | 'gray-200';

interface SkeletonProps {
  /** 추가 CSS 클래스 */
  className?: string;
  /** 스켈레톤 형태 */
  variant?: SkeletonVariant;
  /** 배경색 (기본값: gray-200) */
  bg?: SkeletonBg;
  /** 너비 (px 또는 CSS 값) */
  width?: string | number;
  /** 높이 (px 또는 CSS 값) */
  height?: string | number;
}

const variantStyles: Record<SkeletonVariant, string> = {
  rect: 'rounded-lg',
  circle: 'rounded-full',
  text: 'rounded',
};

const bgStyles: Record<SkeletonBg, string> = {
  'gray-50': 'bg-gray-50',
  'gray-100': 'bg-gray-100',
  'gray-200': 'bg-gray-200',
};

/**
 * 기본 스켈레톤 컴포넌트
 *
 * @example
 * ```tsx
 * <Skeleton className="w-full h-40" />
 * <Skeleton variant="circle" width={48} height={48} />
 * <Skeleton variant="text" className="w-3/4 h-5" />
 * <Skeleton bg="gray-50" className="w-full h-40" />
 * ```
 */
const Skeleton = ({ className, variant = 'rect', bg = 'gray-200', width, height }: SkeletonProps) => {
  const style: React.CSSProperties = {};

  if (width !== undefined) {
    style.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }

  return (
    <div
      className={clsx('animate-pulse', bgStyles[bg], variantStyles[variant], className)}
      style={Object.keys(style).length > 0 ? style : undefined}
      aria-hidden="true"
    />
  );
};

export default Skeleton;
