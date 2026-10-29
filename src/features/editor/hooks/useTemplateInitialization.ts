import { useEffect, useRef } from 'react';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useAutoSaveStore } from '@/features/editor/store/useAutoSaveStore';
import { useHistoryStore } from '@/features/editor/store/useHistoryStore';
import type { ProjectDetailData } from '@/features/editor/types';

/**
 * 프로젝트 데이터로 캔버스 템플릿 초기화 훅
 *
 * ## 책임
 * - 프로젝트 데이터(frames) → Konva 템플릿 변환
 * - CanvasDataStore에 템플릿 데이터 저장
 *
 * ## 실행 시점
 * - project 데이터가 로드되었을 때
 * - project 변경 시
 *
 * ## 중복 방지
 * - 같은 project로는 한 번만 초기화 (refetchOnMount로 인한 중복 방지)
 */
export const useTemplateInitialization = (project: ProjectDetailData | undefined) => {
  const initializeTemplate = useCanvasDataStore((state) => state.initializeTemplate);
  const initializedProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!project?.frames || project.frames.length === 0) return;

    const projectId = project.frames[0].projectId;

    // 템플릿 초기화 (1회만)
    if (initializedProjectIdRef.current !== projectId) {
      // ProjectFrame[] frameOrder로 정렬 (ASCII 순서 - fractional-indexing과 일치해야 함)
      // Note: localeCompare는 대소문자 순서가 달라서 사용 불가
      const sortedProjectFrames = [...project.frames].sort((a, b) => {
        if (a.frameOrder < b.frameOrder) return -1;
        if (a.frameOrder > b.frameOrder) return 1;
        return 0;
      });
      initializeTemplate(
        sortedProjectFrames,
        project.assetUrls,
        project.productName,
        project.categoryName,
      );
      initializedProjectIdRef.current = projectId;

      // 히스토리 초기화 (undo/redo용)
      const frames = useCanvasDataStore.getState().frames;
      useHistoryStore.getState().initHistory(frames);

      // 자동저장 재활성화 (overwrite로 비활성화된 경우 복구)
      useAutoSaveStore.getState().setEnabled(true);
    }
  }, [project, initializeTemplate]);
};
