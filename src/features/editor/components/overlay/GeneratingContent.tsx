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
  /** 기존 프로젝트 ID (새 프로젝트 생성 시 복귀용) */
  sourceProjectId?: string;
  /** 새 탭에서 열린 경우 (다이얼로그 스킵, 기존 탭에서 confirm API 호출됨) */
  isCreateMode?: boolean;
}

/**
 * 프로젝트 생성 중 컨텐츠 (클라이언트 컴포넌트)
 *
 * ## 책임
 * - Realtime으로 Job 상태 추적
 * - 생성 완료 시 에디터로 리다이렉트
 * - 로딩 오버레이 표시
 *
 * ## 흐름 (V2)
 * 1. jobId로 realtime 구독
 * 2. `useConfirmProjectGeneration` 훅이 자동으로 확정 다이얼로그 처리
 * 3. `completed` 시 `/projects/[projectId]`로 리다이렉트
 */
export function GeneratingContent({ jobId, sourceProjectId, isCreateMode = false }: GeneratingContentProps) {
  const router = useRouter();
  const closeModal = useDialog((state) => state.closeModal);
  const setSelectedTool = useToolPanelStore((state) => state.setSelectedTool);

  // 페이지 진입 시 모달/사이드 패널 닫기
  useEffect(() => {
    closeModal();
    setSelectedTool(TOGGLE_STATES.NONE);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Job 완료 시 에디터로 리다이렉트
  const handleComplete = useCallback(
    (projectId: string) => {
      const newProjectUrl = `${ROUTES.PROJECT(projectId)}?ai=true` as Route;
      router.replace(newProjectUrl);
    },
    [router],
  );

  // Realtime Job 상태 추적
  const { status, unsubscribe } = useProjectGenerationJob(jobId, handleComplete);

  // AI 완료 시 확정 다이얼로그 표시 (새 탭에서 열린 경우 스킵)
  useConfirmProjectGeneration({
    jobId,
    status,
    sourceProjectId,
    skipDialog: isCreateMode,
    onCreateNewProject: unsubscribe, // 구독 해제로 handleComplete 호출 방지
  });

  return (
    <main className="flex-1 bg-gray-50">
      <LeftSideBar />
      <ProjectLoadingOverlay jobStatus={status} />
    </main>
  );
}
