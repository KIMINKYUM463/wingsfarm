import type { ReactNode } from 'react';

interface SkeletonGroupProps {
  /** 반복할 스켈레톤 개수 */
  count: number;
  /** 반복할 스켈레톤 템플릿 */
  children: ReactNode;
  /** 컨테이너 CSS 클래스 (그리드/리스트 레이아웃) */
  className?: string;
  /** 각 아이템 래퍼 CSS 클래스 */
  itemClassName?: string;
}

/**
 * 스켈레톤 반복 렌더링 래퍼
 *
 * @example
 * ```tsx
 * <SkeletonGroup count={12} className="grid grid-cols-3 gap-6">
 *   <div>
 *     <Skeleton className="w-full aspect-square" />
 *     <Skeleton variant="text" className="h-5 mt-2 w-3/4" />
 *   </div>
 * </SkeletonGroup>
 * ```
 */
const SkeletonGroup = ({ count, children, className, itemClassName }: SkeletonGroupProps) => {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={itemClassName}>
          {children}
        </div>
      ))}
    </div>
  );
};

export default SkeletonGroup;
