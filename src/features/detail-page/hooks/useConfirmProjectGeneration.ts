import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmProjectGeneration } from '@/features/detail-page/api';
import { useAutoSaveStore } from '@/features/editor/store/useAutoSaveStore';
import { showToast } from '@/utils/toast';
import type {
  ConfirmProjectGenerationRequest,
  ConfirmProjectGenerationResponse,
  ProjectGenerationStatus,
} from '@/shared/types/detail-page';

interface UseConfirmProjectGenerationOptions {
  jobId: string;
  status: ProjectGenerationStatus | null;
  /**
   * 다이얼로그·확정 API를 건너뛴다.
   * (예전 create 새 탭 흐름 호환용 — 확정은 다른 탭에서 이미 호출된 경우)
   */
  skipConfirm?: boolean;
}

/**
 * AI 생성이 끝나면 초안 프로젝트에 바로 덮어쓴다.
 * (이미 생성용으로 만든 프로젝트라 "새 프로젝트 / 덮어쓰기" 선택이 필요 없다)
 */
export const useConfirmProjectGeneration = ({ jobId, status, skipConfirm = false }: UseConfirmProjectGenerationOptions) => {
  const queryClient = useQueryClient();
  const confirmedRef = useRef(false);

  const { mutate: confirmGeneration, isPending } = useMutation({
    mutationFn: ({
      mode,
    }: {
      mode: ConfirmProjectGenerationRequest['mode'];
    }): Promise<ConfirmProjectGenerationResponse['data']> => {
      return confirmProjectGeneration(jobId, { mode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projectGenerationJob', jobId],
      });
    },
    onError: () => {
      confirmedRef.current = false;
      useAutoSaveStore.getState().setEnabled(true);
      showToast.error('프로젝트 저장에 실패했습니다. 다시 시도해 주세요.');
    },
    retry: 1,
  });

  useEffect(() => {
    if (skipConfirm) return;
    if (status !== 'ai_completed') {
      confirmedRef.current = false;
      return;
    }
    if (confirmedRef.current || isPending) return;

    confirmedRef.current = true;
    useAutoSaveStore.getState().setEnabled(false);
    confirmGeneration({ mode: 'overwrite' });
  }, [skipConfirm, status, isPending, confirmGeneration]);
};
