import { useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import IconInputField from '@/shared/ui/Input/IconInputField';
import { ToolSectionLayout } from '@/features/editor/components/panel/common';
import ProductImageCard from '@/features/editor/components/shared/ProductImageCard';
import { useProjects, toProductImageItem } from '@/features/projects';
import { ROUTES } from '@/shared/constants/routes';
import type { ProductImageItem } from '@/features/editor/store/useToolPanelStore';

const SIDE_PANEL_LIMIT = 6; // 2열 그리드에 맞춰 3행

const ProjectTool = () => {
  const params = useParams<{ id: string }>();
  const currentProjectId = params.id;

  const { projects, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useProjects({
    limit: SIDE_PANEL_LIMIT,
  });

  const projectItems = useMemo(() => projects.map(toProductImageItem), [projects]);

  const handleProjectClick = useCallback(
    (item: ProductImageItem) => {
      if (item.id === currentProjectId) return;
      window.open(ROUTES.PROJECT(item.id), '_blank');
    },
    [currentProjectId],
  );

  return (
    <ToolSectionLayout
      title="프로젝트"
      body={
        <IconInputField wrapClassName="tool-search-input mb-6" placeholder="검색어를 입력하세요." />
      }
      isLoading={isLoading}
      isEmpty={projectItems.length === 0}
      emptyTexts={['아직 프로젝트가 없습니다.', '새 프로젝트를 만들어보세요.']}
      infiniteScroll={{ hasNextPage, isFetchingNextPage, fetchNextPage }}
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        {projectItems.map((project) => (
          <ProductImageCard key={project.id} item={project} onClick={handleProjectClick} />
        ))}
      </div>
    </ToolSectionLayout>
  );
};

export default ProjectTool;
