import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmProjectGeneration } from '@/features/detail-page/api';
import { useDialog } from '@/shared/ui/Dialog';
import { useAutoSaveStore } from '@/features/editor/store/useAutoSaveStore';
import { ROUTES } from '@/shared/constants/routes';
import { showToast } from '@/utils/toast';
import type {
  ConfirmProjectGenerationRequest,
  ConfirmProjectGenerationResponse,
  ProjectGenerationStatus,
} from '@/shared/types/detail-page';

interface UseConfirmProjectGenerationOptions {
  jobId: string;
  status: ProjectGenerationStatus | null;
  /** 기존 프로젝트 ID (새 프로젝트 추가 시 기존 탭 복귀용) */
  sourceProjectId?: string;
  /** 다이얼로그 스킵 (새 탭에서 열린 경우) */
  skipDialog?: boolean;
  /** 새 프로젝트 추가 선택 시 콜백 (기존 탭에서 handleComplete 비활성화용) */
  onCreateNewProject?: () => void;
}

/**
 * 프로젝트 생성 확정 훅 (비즈니스 로직 포함)
 *
 * ## 책임
 * - `ai_completed` 상태 자동 감지
 * - Figma 디자인 기반 확정 다이얼로그 자동 표시
 * - 사용자 선택에 따라 API 호출
 * - React Query 캐시 무효화
 *
 * ## 동작 흐름
 * 1. `ai_completed` 상태 감지
 * 2. 자동으로 확정 다이얼로그 표시 (Figma 디자인)
 * 3. 사용자가 "새 프로젝트 추가" 또는 "덮어쓰기" 선택
 * 4. API 호출 (`POST /projects/generation/{jobId}/confirm`)
 * 5. 성공 시 `saving_pending` 상태로 전환
 * 6. Worker가 자동으로 `saving_processing` → `completed` 진행
 *
 * @example
 * ```tsx
 * useConfirmProjectGeneration({
 *   jobId,
 *   status,
 *   sourceProjectId, // 선택사항
 * });
 *
 * // 자동으로 ai_completed 시 다이얼로그 표시
 * ```
 */
export const useConfirmProjectGeneration = ({
  jobId,
  status,
  sourceProjectId,
  skipDialog = false,
  onCreateNewProject,
}: UseConfirmProjectGenerationOptions) => {
  const queryClient = useQueryClient();
  const { openConfirm } = useDialog();
  const hasShownDialogRef = useRef(false); // 중복 표시 방지
  const userDecisionMadeRef = useRef(false); // 사용자 결정 완료 (절대 리셋 안 함)

  const { mutate: confirmGeneration, isPending } = useMutation({
    mutationFn: ({
      mode,
    }: {
      mode: ConfirmProjectGenerationRequest['mode'];
    }): Promise<ConfirmProjectGenerationResponse['data']> => {
      return confirmProjectGeneration(jobId, { mode });
    },
    onSuccess: () => {
      // Job 상태 캐시 무효화 (Realtime에서 completed 받을 때까지 대기)
      queryClient.invalidateQueries({
        queryKey: ['projectGenerationJob', jobId],
      });
    },
    onError: () => {
      // API 실패 시 다이얼로그 재표시 허용 (stuck 방지)
      userDecisionMadeRef.current = false;
      hasShownDialogRef.current = false;
      // 자동저장 재활성화
      useAutoSaveStore.getState().setEnabled(true);
      showToast.error('프로젝트 생성 확정에 실패했습니다. 다시 시도해 주세요.');
    },
    retry: 1,
  });

  // 새 탭 (create 모드): ai_completed 상태 타임아웃 감지
  useEffect(() => {
    if (!skipDialog) return;
    if (status !== 'ai_completed') return;

    const AI_COMPLETED_TIMEOUT = 60000; // 60초

    const timer = setTimeout(() => {
      showToast.error('프로젝트 생성에 문제가 발생했습니다. 페이지를 새로고침해 주세요.');
    }, AI_COMPLETED_TIMEOUT);

    return () => clearTimeout(timer);
  }, [skipDialog, status]);

  // 기존 탭: ai_completed 상태 감지 및 다이얼로그 표시
  useEffect(() => {
    if (skipDialog) return;

    // ai_completed 상태가 아니면 리셋
    if (status !== 'ai_completed') {
      hasShownDialogRef.current = false;
      return;
    }

    // 이미 사용자가 결정을 내렸거나, 표시했거나, 처리 중이면 스킵
    if (userDecisionMadeRef.current || hasShownDialogRef.current || isPending) return;

    const showConfirmDialog = async () => {
      hasShownDialogRef.current = true; // 중복 방지

      // Figma 디자인 기반 다이얼로그
      const confirmed = await openConfirm({
        title: 'AI로 상세페이지 생성 완료',
        description: '생성된 내용을 페이지에 추가하시겠습니까?',
        confirmText: '새 프로젝트 추가',
        cancelText: '덮어쓰기',
        isPending,
        // 새 프로젝트 추가 버튼 클릭 시 (사용자 제스처 컨텍스트에서 새 탭 열기)
        onConfirmClick: () => {
          // 사용자 결정 완료 - 다이얼로그 재표시 방지
          userDecisionMadeRef.current = true;
          // 자동저장 비활성화 (페이지 이탈 경고 방지)
          useAutoSaveStore.getState().setEnabled(false);
          // 기존 탭에서 handleComplete 실행 방지
          onCreateNewProject?.();
          // 새 탭에서 generating 페이지 열기 (create 플래그로 다이얼로그 스킵)
          window.open(ROUTES.PROJECT_GENERATING(jobId, { create: true }), '_blank');
          // confirm API 호출 (새 탭에서는 스킵되므로 기존 탭에서 호출)
          confirmGeneration({ mode: 'create' });
          // 기존 탭은 sourceProjectId로 복귀 (window.location 사용 - 백그라운드 탭에서도 신뢰성 있음)
          window.location.replace(sourceProjectId ? ROUTES.PROJECT(sourceProjectId) : ROUTES.PROJECTS);
        },
      });

      // 새 프로젝트 추가 선택 시 onConfirmClick에서 이미 처리됨
      if (confirmed) return;

      // 덮어쓰기 선택 - 사용자 결정 완료
      userDecisionMadeRef.current = true;
      // 자동저장 비활성화 (구 프레임 ID로 PATCH 방지)
      useAutoSaveStore.getState().setEnabled(false);
      confirmGeneration({ mode: 'overwrite' });
    };

    showConfirmDialog();
  }, [skipDialog, status, isPending, openConfirm, confirmGeneration, jobId, sourceProjectId, onCreateNewProject]);
};
