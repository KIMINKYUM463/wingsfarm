'use client';

import { ComponentPropsWithoutRef, forwardRef } from 'react';
import { clsx } from 'clsx';

type ScrollAreaProps = ComponentPropsWithoutRef<'div'>;

/**
 * 커스텀 스크롤바가 적용된 스크롤 영역
 *
 * SimpleBar 대체 컴포넌트로, 네이티브 CSS 스크롤바 사용
 * - 번들 사이즈 절감 (~34KB)
 * - 더 나은 성능 (네이티브 스크롤)
 *
 * @example
 * <ScrollArea style={{ maxHeight: '400px' }}>
 *   {content}
 * </ScrollArea>
 */
const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-scroll-container
        className={clsx('overflow-y-auto', className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);

ScrollArea.displayName = 'ScrollArea';

export default ScrollArea;
