import { useEffect } from 'react';
import { useAutoSaveStore } from '../store/useAutoSaveStore';
import { useImageGenerationStore } from '../store/useImageGenerationStore';
import { useTextGenerationStore } from '../store/useTextGenerationStore';

/**
 * 에디터 전용 페이지 이탈 방지 훅
 *
 * 다음 상황에서 사용자가 페이지를 떠나려 하면
 * 브라우저 기본 확인창("사이트에서 나가시겠습니까?")을 표시:
 * - 자동 저장 대기 중 (pending)
 * - 자동 저장 진행 중 (saving)
 * - AI 이미지 생성 중
 * - AI 텍스트 생성 중
 */
export const useBeforeUnload = () => {
  const status = useAutoSaveStore((s) => s.status);
  const enabled = useAutoSaveStore((s) => s.enabled);
  const imageLoadingStates = useImageGenerationStore((s) => s.imageLoadingStates);
  const textLoadingStates = useTextGenerationStore((s) => s.textLoadingStates);

  // enabled가 false면 저장 상태 무시 (AI 확정 후 페이지 이동 등)
  const isSavingOrPending = enabled && (status === 'saving' || status === 'pending');
  const isGeneratingImage = [...imageLoadingStates.values()].some(Boolean);
  const isGeneratingText = [...textLoadingStates.values()].some(Boolean);
  const shouldPrevent = isSavingOrPending || isGeneratingImage || isGeneratingText;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (shouldPrevent) {
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldPrevent]);
};
