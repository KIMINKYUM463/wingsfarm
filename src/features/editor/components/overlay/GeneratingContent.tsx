'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LeftSideBar from '@/shared/ui/Sidebar/LeftSideBar';
import ProjectLoadingOverlay from '@/features/editor/components/overlay/ProjectLoadingOverlay';
import { useProjectGenerationJob } from '@/features/detail-page/hooks/useProjectGenerationJob';
import { useConfirmProjectGeneration } from '@/features/detail-page/hooks/useConfirmProjectGeneration';
import { useDialog } from '@/shared/ui/Dialog/useDialog';
import { useToolPanelStore } from '@/features/editor/store/useToolPanelStore';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import type { Route } from 'next';
import { ROUTES } from '@/shared/constants/routes';

interface GeneratingContentProps {
  jobId: string;
  /** @deprecated 확인 창 제거 후 미사용 — 쿼리 호환용으로만 받음 */
  sourceProjectId?: string;
  /** 예전 create 새 탭 호환 — true면 확정 API를 다시 부르지 않음 */
  isCreateMode?: boolean;
}

/**
 * 프로젝트 생성 중 컨텐츠
 * AI가 끝나면 초안 프로젝트에 덮어쓰고, completed 되면 에디터로 이동한다.
 */
export function GeneratingContent({ jobId, isCreateMode = false }: GeneratingContentProps) {
  const router = useRouter();
  const closeModal = useDialog((state) => state.closeModal);
  const setSelectedTool = useToolPanelStore((state) => state.setSelectedTool);

  useEffect(() => {
    closeModal();
    setSelectedTool(TOGGLE_STATES.NONE);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = useCallback(
    (projectId: string) => {
      const newProjectUrl = `${ROUTES.PROJECT(projectId)}?ai=true` as Route;
      router.replace(newProjectUrl);
    },
    [router],
  );

  const { status } = useProjectGenerationJob(jobId, handleComplete);

  useConfirmProjectGeneration({
    jobId,
    status,
    skipConfirm: isCreateMode,
  });

  return (
    <main className="flex-1 bg-gray-50">
      <LeftSideBar />
      <ProjectLoadingOverlay jobStatus={status} />
    </main>
  );
}
