'use client';

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

const sortOptions = [
  { id: 'recent', label: '최신항목' },
  { id: 'name', label: '이름순' },
] as const;

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
    setSearchQuery,
    handleSortChange,
  } = useProjects({ limit: PROJECTS_PAGE_SIZE });
  const { openModal } = useDialog();

  const handleAiDraftClick = () => {
    openModal(MODAL_TYPES.PROJECT_SETUP);
  };

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
              <h1 className="tablet:block hidden">
                오늘도 AI와 함께
                <br className="desktop:hidden" /> 상세페이지를 만들어볼까요?
              </h1>
            </div>
            <div className="desktop:flex hidden items-end gap-2">
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
            <h3 className="h3-bold">내 프로젝트</h3>
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
