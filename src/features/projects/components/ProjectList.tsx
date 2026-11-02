'use client';

import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { showToast } from '@/utils/toast';
import { toProductImageItem } from '../utils';
import { useDeleteProject, useDuplicateProject, useRestoreProject, useToggleFavorite } from '../hooks';
import type { ProductImageItem } from '@/features/editor/store/useToolPanelStore';
import type { Project, ProjectFilter } from '../types';

interface ProjectListProps {
  projects: Project[];
  filter: ProjectFilter;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  /** 검색 중 여부 (빈 결과 메시지 분기용) */
  isSearching?: boolean;
}

type MenuId = 'favorite' | 'reuse' | 'duplicate' | 'trash' | 'restore' | 'purge';
interface MenuOption {
  id: MenuId;
  label: string;
  icon: string;
}

/** 카드 메뉴 (휴지통에서는 복원·영구 삭제만) */
const menuFor = (project: Project, filter: ProjectFilter): MenuOption[] =>
  filter === 'trash'
    ? [
        { id: 'restore', label: '복원하기', icon: 'restore_from_trash' },
        { id: 'purge', label: '영구 삭제', icon: 'delete_forever' },
      ]
    : [
        { id: 'favorite', label: project.favorite ? '즐겨찾기 해제' : '즐겨찾기', icon: 'star' },
        ...(project.reusable ? [{ id: 'reuse' as const, label: '이 페이지로 다른 상품 만들기', icon: 'auto_awesome' }] : []),
        { id: 'duplicate', label: '사본 만들기', icon: 'content_copy' },
        { id: 'trash', label: '휴지통으로 옮기기', icon: 'delete' },
      ];

const EMPTY_TEXTS: Record<ProjectFilter, string[]> = {
  all: ['아직 프로젝트가 없습니다.', '새 프로젝트를 만들어보세요.'],
  favorite: ['즐겨찾기한 프로젝트가 없습니다.', '카드 메뉴에서 즐겨찾기를 눌러보세요.'],
  trash: ['휴지통이 비어 있습니다.'],
};

const ProjectList = ({
  projects,
  filter,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  isSearching = false,
}: ProjectListProps) => {
  const router = useRouter();
  const items = useMemo(() => projects.map((project) => ({ project, item: toProductImageItem(project) })), [projects]);

  const { openConfirm } = useDialog();
  const { mutate: deleteProject } = useDeleteProject();
  const { mutate: restoreProject } = useRestoreProject();
  const { mutate: toggleFavorite } = useToggleFavorite();
  const { mutate: duplicateProject } = useDuplicateProject();

  const scrollRef = useInfiniteScroll({
    hasNextPage: hasNextPage && !!onLoadMore,
    isFetchingNextPage,
    fetchNextPage: onLoadMore ?? (() => {}),
  });

  const handleProjectClick = useCallback(
    (item: ProductImageItem) => {
      if (filter === 'trash') {
        showToast.info('휴지통의 프로젝트는 복원한 뒤 열 수 있어요.');
        return;
      }
      // 휴대폰은 새 창이 막히는 경우가 많아 이 화면에서 미리보기로 연다
      if (window.matchMedia('(max-width: 757px)').matches) router.push(ROUTES.PROJECT(item.id));
      else window.open(ROUTES.PROJECT(item.id), '_blank');
    },
    [filter, router],
  );

  const handleMenu = async (project: Project, id: MenuId) => {
    switch (id) {
      case 'favorite':
        return toggleFavorite({ id: project.id, favorite: !project.favorite });
      case 'reuse':
        return router.push(ROUTES.DRAFT_CREATE_FROM({ reuse: project.id }));
      case 'duplicate':
        return duplicateProject(project.id, { onSuccess: () => showToast.success('사본을 만들었어요.') });
      case 'trash':
        return deleteProject({ id: project.id }, { onSuccess: () => showToast.success('휴지통으로 옮겼어요.') });
      case 'restore':
        return restoreProject(project.id, { onSuccess: () => showToast.success('프로젝트를 복원했어요.') });
      case 'purge': {
        const confirmed = await openConfirm({
          title: '영구 삭제',
          description: '프로젝트를 영구 삭제하시겠어요?\n영구 삭제한 프로젝트는 복구할 수 없습니다.',
        });
        if (confirmed) deleteProject({ id: project.id, permanent: true });
      }
    }
  };

  if (items.length === 0) {
    return (
      <Empty
        texts={isSearching ? ['검색 결과가 없습니다.'] : EMPTY_TEXTS[filter]}
        textClassName="h3"
        className="min-h-58"
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 tablet:gap-x-6 tablet:gap-y-9 desktop:grid-cols-3 wide:grid-cols-5">
        {items.map(({ project, item }, index) => (
          <div key={item.id} className={clsx('relative', filter === 'trash' && 'opacity-70')}>
            <ProductImageCard
              item={item}
              onClick={handleProjectClick}
              priority={index < 5}
              textClassName="title-1-medium pt-2"
            />
            {project.favorite && (
              <span className="pointer-events-none absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm">
                <Icon name="star" width={18} height={18} fill color="#F5B400" />
              </span>
            )}
            <p className="description mt-1 text-gray-300">{item.updatedAt}</p>
            {/* 더보기 메뉴 - 제목 라인에 맞춤 */}
            <Dropdown
              options={menuFor(project, filter)}
              onSelect={(id) => handleMenu(project, id as MenuId)}
              className="absolute right-0 bottom-3"
              dropdownListClassName="dropdown-list w-[240px] right-0 desktop:right-auto desktop:left-1/2 desktop:-translate-x-1/2"
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
                <div className={clsx('flex items-center gap-1', option.id === 'purge' && 'text-red-500')}>
                  <Icon name={option.icon} width={24} height={24} />
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
