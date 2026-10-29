import { useEffect, useRef } from 'react';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useAutoSaveStore } from '@/features/editor/store/useAutoSaveStore';
import { useHistoryStore } from '@/features/editor/store/useHistoryStore';
import type { ProjectDetailData } from '@/features/editor/types';

/**
 * 프로젝트 데이터를 캔버스에 올린다 (최초 로드 · 버전 복원)
 * - frameOrder로 정렬 (ASCII 순서 - fractional-indexing과 일치해야 함, localeCompare는 대소문자 순서가 달라 사용 불가)
 * - 실행 취소 기록을 새로 시작한다
 */
export const loadProjectIntoCanvas = (project: ProjectDetailData) => {
  const sortedProjectFrames = [...project.frames].sort((a, b) => {
    if (a.frameOrder < b.frameOrder) return -1;
    if (a.frameOrder > b.frameOrder) return 1;
    return 0;
  });
  useCanvasDataStore
    .getState()
    .initializeTemplate(sortedProjectFrames, project.assetUrls, project.productName, project.categoryName);
  useHistoryStore.getState().initHistory(useCanvasDataStore.getState().frames);
  // 자동저장 재활성화 (overwrite로 비활성화된 경우 복구)
  useAutoSaveStore.getState().setEnabled(true);
};

/**
 * 프로젝트 데이터로 캔버스 템플릿 초기화 훅
 *
 * ## 실행 시점
 * - project 데이터가 로드되었을 때
 *
 * ## 중복 방지
 * - 같은 project로는 한 번만 초기화 (refetchOnMount로 인한 중복 방지)
 */
export const useTemplateInitialization = (project: ProjectDetailData | undefined) => {
  const initializedProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!project?.frames || project.frames.length === 0) return;

    const projectId = project.frames[0].projectId;
    if (initializedProjectIdRef.current === projectId) return;
    loadProjectIntoCanvas(project);
    initializedProjectIdRef.current = projectId;
  }, [project]);
};
