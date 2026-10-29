'use client';

import { useMemo, useCallback } from 'react';
import clsx from 'clsx';
import ProductImageCard from '@/features/editor/components/shared/ProductImageCard';
import Empty from '@/shared/ui/Empty';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Dropdown from '@/shared/ui/Dropdown';
import IconButton from '@/shared/ui/Button/IconButton';
import Icon from '@/shared/ui/Icon';
import { useInfiniteScroll } from '@/shared/hooks/useInfiniteScroll';
import { ROUTES } from '@/shared/constants/routes';
import { useDialog } from '@/shared/ui/Dialog/useDialog';
import { toProductImageItem } from '../utils';
import { useDeleteProject } from '../hooks/useDeleteProject';
import type { ProductImageItem } from '@/features/editor/store/useToolPanelStore';
import type { Project } from '../types';

interface ProjectListProps {
  projects: Project[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  /** 검색 중 여부 (빈 결과 메시지 분기용) */
  isSearching?: boolean;
}

const ProjectList = ({
  projects,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  isSearching = false,
}: ProjectListProps) => {
  const items = useMemo(() => projects.map(toProductImageItem), [projects]);

  const { openConfirm } = useDialog();
  const { mutate: deleteProject } = useDeleteProject();

  const scrollRef = useInfiniteScroll({
    hasNextPage: hasNextPage && !!onLoadMore,
    isFetchingNextPage,
    fetchNextPage: onLoadMore ?? (() => {}),
  });

  const handleProjectClick = useCallback((item: ProductImageItem) => {
    window.open(ROUTES.PROJECT(item.id), '_blank');
  }, []);

  if (items.length === 0) {
    return (
      <Empty
        texts={
          isSearching
            ? ['검색 결과가 없습니다.']
            : ['아직 프로젝트가 없습니다.', '새 프로젝트를 만들어보세요.']
        }
        textClassName="h3"
        className="min-h-58"
      />
    );
  }

  return (
    <>
      <Empty
        texts={[
          '모바일에서는 프로젝트를 생성 할 수 없습니다.',
          '데스크톱 웹으로 접속해 시작해보세요.',
        ]}
        textClassName="h3"
        className="tablet:hidden block min-h-58"
      />
      <div
        className={clsx(
          'tablet:grid gap-x-6 gap-y-9',
          'hidden',
          'tablet:grid-cols-2',
          'desktop:grid-cols-3',
          'wide:grid-cols-5',
        )}
      >
        {items.map((item, index) => (
          <div key={item.id} className="relative">
            <ProductImageCard
              item={item}
              onClick={handleProjectClick}
              priority={index < 5}
              textClassName="title-1-medium pt-2"
            />
            <p className="description mt-1 text-gray-300">{item.updatedAt}</p>
            {/* 더보기 메뉴 - 제목 라인에 맞춤 */}
            <Dropdown
              options={[{ id: 'delete', label: '삭제하기' }]}
              onSelect={async (id) => {
                if (id !== 'delete') return;

                const confirmed = await openConfirm({
                  title: '프로젝트 삭제',
                  description: '프로젝트를 삭제하시겠어요?\n삭제된 프로젝트는 복구할 수 없습니다.',
                });

                if (confirmed) {
                  deleteProject(item.id);
                }
              }}
              className="absolute right-0 bottom-3"
              dropdownListClassName="dropdown-list w-[208px] right-0 desktop:right-auto desktop:left-1/2 desktop:-translate-x-1/2"
              disableRelative
              renderButton={(_, isOpen) => (
                <IconButton
                  icon="more_vert"
                  iconWidth={20}
                  iconHeight={20}
                  className={clsx('btn-icon', isOpen && 'bg-gray-50')}
                  aria-label="더보기"
                />
              )}
              renderOption={(option) => (
                <div className="flex items-center gap-1">
                  <Icon name="delete" width={24} height={24} />
                  <span className="p">{option.label}</span>
                </div>
              )}
            />
          </div>
        ))}
      </div>

      {/* 무한 스크롤 감지 영역 */}
      <div ref={scrollRef} className="h-10" />

      {/* 로딩 인디케이터 */}
      {isFetchingNextPage && (
        <div className="flex justify-center pt-8">
          <Spinner size={20} className="text-(--color-point)" />
        </div>
      )}
    </>
  );
};

export default ProjectList;
