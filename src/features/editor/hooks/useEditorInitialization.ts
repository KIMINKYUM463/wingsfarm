import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToolPanelStore } from '@/features/editor/store/useToolPanelStore';
import { useImageGenerationStore } from '@/features/editor/store/useImageGenerationStore';
import { useTextGenerationStore } from '@/features/editor/store/useTextGenerationStore';
import { useDialog } from '@/shared/ui/Dialog/useDialog';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';

/**
 * 에디터 진입 시 전역 상태 초기화 훅
 *
 * ## 책임
 * - 이전 프로젝트 데이터 클리어
 * - 캔버스, 이미지, 텍스트 생성 상태 초기화
 * - 사이드 패널 닫기
 * - AI 생성 모드 진입 시 모달 닫기 및 쿼리 파라미터 정리
 *
 * ## 실행 시점
 * - 컴포넌트 마운트 시 한 번만 실행
 */
export const useEditorInitialization = () => {
  const searchParams = useSearchParams();
  const isAiGeneration = searchParams.get('ai') === 'true';

  const resetImageGeneration = useImageGenerationStore((state) => state.reset);
  const resetTextGeneration = useTextGenerationStore((state) => state.reset);
  const setSelectedTool = useToolPanelStore((state) => state.setSelectedTool);
  const closeModal = useDialog((state) => state.closeModal);

  useEffect(() => {
    // Canvas 데이터는 initializeTemplate()이 덮어쓰므로 reset 불필요
    resetImageGeneration(); // 이미지 생성 상태 초기화
    resetTextGeneration(); // 텍스트 생성 상태 초기화
    setSelectedTool(TOGGLE_STATES.NONE); // 사이드 패널 닫기 (무조건 초기화)
    closeModal(); // 에디터 진입 시 모달 닫기 (어떤 경로로 왔든)

    // AI 생성 모드 진입 시 쿼리 파라미터 정리
    if (isAiGeneration) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []); // 마운트 시 한 번만 실행
};
