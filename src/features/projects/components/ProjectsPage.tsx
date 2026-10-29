'use client';

import { useSyncExternalStore } from 'react';
import clsx from 'clsx';
import ProjectsHeader from '@/shared/ui/Header/ProjectsHeader';
import IconInputField from '@/shared/ui/Input/IconInputField';
import Dropdown from '@/shared/ui/Dropdown';
import CustomIcon from '@/shared/ui/CustomIcon';
import IconButton from '@/shared/ui/Button/IconButton';
import ProjectList from './ProjectList';
import ProjectListSkeleton from './ProjectListSkeleton';
import { useProjects } from '../hooks';
import { PROJECTS_PAGE_SIZE } from '../constants';
import { useDialog } from '@/shared/ui/Dialog/useDialog';
import { MODAL_TYPES } from '@/shared/ui/Dialog/Modal';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants/routes';
import type { ProjectFilter } from '../types';

const sortOptions = [
  { id: 'recent', label: '최신항목' },
  { id: 'name', label: '이름순' },
] as const;

const FILTER_TABS: { id: ProjectFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'favorite', label: '즐겨찾기' },
  { id: 'trash', label: '휴지통' },
];

/** 시작 화면 인사말은 시간대마다 바뀐다 (서버 렌더에서는 기본 문구) */
const greetingFor = (hour: number | null) => {
  if (hour === null) return '오늘도 AI와 함께 상세페이지를 만들어볼까요?';
  if (hour >= 5 && hour < 11) return '좋은 아침이에요. 오늘 소개할 상품을 준비해볼까요?';
  if (hour >= 11 && hour < 17) return '오늘도 AI와 함께 상세페이지를 만들어볼까요?';
  if (hour >= 17 && hour < 22) return '하루를 마무리하며 내일 소개할 상품을 준비해볼까요?';
  return '늦은 시간에도 편하게, 초안은 AI가 먼저 만들어둘게요.';
};
const subscribeNothing = () => () => {};

interface ProjectsPageProps {
  userName: string;
}

const ProjectsPage = ({ userName }: ProjectsPageProps) => {
  const {
    projects,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    searchQuery,
    sort,
    filter,
    setFilter,
    setSearchQuery,
    handleSortChange,
  } = useProjects({ limit: PROJECTS_PAGE_SIZE });
  const { openModal } = useDialog();
  const hour = useSyncExternalStore(subscribeNothing, () => new Date().getHours(), () => null);

  const router = useRouter();
  const handleAiDraftClick = () => router.push(ROUTES.DRAFT_CREATE);
  /** 기존 방식: 템플릿 구성으로 바로 시작 (키워드 선택 → AI 문구) */
  const handleTemplateStartClick = () => openModal(MODAL_TYPES.PROJECT_SETUP);

  return (
    <>
      <ProjectsHeader />
      <div className={clsx('flex-1 bg-gray-50 pb-18', 'px-4', 'tablet:px-16', 'desktop:px-30')}>
        <main className="mx-auto w-full max-w-360">
          {/* 환영 메시지 섹션 */}
          <div
            className={clsx('flex justify-between py-9 sm:py-18', 'flex-col', 'desktop:flex-row')}
          >
            <div className={clsx('mb-4', 'desktop:mb-0')}>
              <h1 className="mb-[0.075rem]">
                <span className="text-(--color-point)">{userName}</span>님,
              </h1>
              <h1 className="tablet:hidden block">
                멋진 아이디어가 떠올랐나요?
                <br />
                PC에서 바로 제작해보세요!
              </h1>
              <h1 className="tablet:block hidden">{greetingFor(hour)}</h1>
            </div>
            <div className="desktop:flex hidden items-end gap-2">
              <button type="button" className="btn-outline title-1-medium" onClick={handleTemplateStartClick}>
                템플릿으로 빠르게 시작
              </button>
              <IconButton
                className="btn-primary"
                customIcon={
                  <CustomIcon name="ai-star-24" className="text-white" width={24} height={24} />
                }
                text="AI로 초안 만들기"
                textClassName="title-1-medium"
                onClick={handleAiDraftClick}
              />
            </div>
          </div>

          {/* 검색/정렬 섹션 */}
          <div className={clsx('mb-6 flex justify-between gap-4', 'flex-col', 'desktop:flex-row')}>
            <div className="flex items-center gap-5">
              <h3 className="h3-bold">내 프로젝트</h3>
              <div className="flex rounded-lg bg-white p-1" role="tablist">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === tab.id}
                    className={clsx(
                      'rounded-md px-3 py-1.5 text-sm font-medium',
                      filter === tab.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900',
                    )}
                    onClick={() => setFilter(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <IconInputField
                wrapClassName="desktop:w-125 tool-search-input flex-1"
                placeholder="프로젝트를 검색하세요."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Dropdown
                options={[...sortOptions]}
                initialId={sort}
                onChangeOption={handleSortChange}
                dropdownListClassName="dropdown-list w-full"
                buttonTextClassName="p"
                buttonClassName="hidden sm:flex min-w-[7rem] justify-start"
              />
            </div>
          </div>

          {/* 프로젝트 목록 */}
          {isLoading ? (
            <ProjectListSkeleton />
          ) : (
            <ProjectList
              projects={projects}
              filter={filter}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={fetchNextPage}
              isSearching={!!searchQuery}
            />
          )}
        </main>
      </div>
    </>
  );
};

export default ProjectsPage;
