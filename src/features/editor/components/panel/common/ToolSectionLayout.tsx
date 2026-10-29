// ToolSectionLayout.tsx

'use client';

import React from 'react';
import { clsx } from 'clsx';
import IconButton from '@/shared/ui/Button/IconButton';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Empty from '@/shared/ui/Empty';
import ScrollArea from '@/shared/ui/ScrollArea';
import { useInfiniteScroll } from '@/shared/hooks/useInfiniteScroll';

/** 무한 스크롤 옵션 (API 호출이 있는 섹션에서만 사용) */
interface InfiniteScrollOptions {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

interface ToolSectionLayoutProps {
  body?: React.ReactNode;
  footer?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  onBack?: () => void;
  /** 초기 로딩 상태 */
  isLoading?: boolean;
  /** 빈 상태 여부 */
  isEmpty?: boolean;
  /** 빈 상태일 때 표시할 텍스트 */
  emptyTexts?: string[];
  /** 무한 스크롤 설정 (선택적 - API 호출이 있는 섹션에서만 사용) */
  infiniteScroll?: InfiniteScrollOptions;
  /** 콘텐츠 영역 커스텀 클래스 (기본: "px-6 space-y-6 pb-6") */
}

const ToolSectionLayout: React.FC<ToolSectionLayoutProps> = ({
  body,
  footer,
  title,
  subtitle,
  children,
  className = '',
  onBack,
  isLoading,
  isEmpty,
  emptyTexts,
  infiniteScroll,
}) => {
  // 무한 스크롤이 필요한 경우에만 hook 사용
  const scrollRef = useInfiniteScroll(
    infiniteScroll ?? {
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: () => {},
    },
  );
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-8">
          <Spinner className="text-(--color-point)" />
        </div>
      );
    }

    if (isEmpty) {
      return <Empty texts={emptyTexts ?? ['데이터가 없습니다.']} textClassName="description" />;
    }

    return children;
  };

  return (
    // 전체 레이아웃을 flex-col로 설정합니다.
    <section className={clsx('flex h-[calc(100vh-var(--header-h))] flex-col', className)}>
      {/* 1. 고정될 헤더 영역 */}
      <div className="px-6 pt-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            {onBack && (
              <IconButton
                type="button"
                icon="arrow_back_ios_new"
                className="btn-icon text-gray-300"
                iconWidth={16}
                iconHeight={16}
                onClick={onBack}
              />
            )}
            <h2 className="title-1-bold">{title}</h2>
          </div>
          {subtitle && <p className="mt-2 text-gray-300">{subtitle}</p>}
        </div>
        {body}
      </div>

      {/* 2. 스크롤될 콘텐츠 영역 */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-8 px-6 pb-6">
          {renderContent()}

          {/* 무한 스크롤 감지 영역 + 로딩 인디케이터 */}
          {infiniteScroll && !isLoading && !isEmpty && (
            <div ref={scrollRef} className="flex justify-center">
              {infiniteScroll.isFetchingNextPage && (
                <Spinner size={20} className="text-(--color-point)" />
              )}
            </div>
          )}
        </div>
      </ScrollArea>
      <div>{footer}</div>
    </section>
  );
};

export default ToolSectionLayout;
