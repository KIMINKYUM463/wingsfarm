import { useEffect, useRef } from 'react';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useGenerateAIImages } from '@/features/editor/hooks/useGenerateAIImages';
import { isImageElement } from '@/features/editor/lib/element-finder';
import type { KonvaPathElement, KonvaRectElement } from '@/shared/types/konva';
import { type ProjectDetailData } from '@/features/editor/types';
import { confirmAiImages } from '@/shared/ui/Dialog';

/**
 * AI 이미지 자동 생성 훅
 *
 * ## 책임
 * - 새 프로젝트 생성 시 모든 이미지 자동 생성
 * - shouldTriggerAiGeneration=true일 때만 동작
 *
 * ## 동작 조건
 * 1. project 데이터가 있어야 함 (실제 프로젝트)
 * 2. flatElements가 초기화되어 있어야 함 (템플릿 로딩 완료)
 * 3. shouldTriggerAiGeneration=true (?ai=true + 서버 최초 조회)
 *
 * ## shouldTriggerAiGeneration 처리
 * - 서버 컴포넌트(page.tsx)에서 ?ai=true + isFirstView 조합으로 계산
 * - props로 직접 전달받아 HydrationBoundary 캐싱 문제 회피
 * - 새로고침/재진입 시 false → 자동 생성 스킵
 *
 * @param project - 프로젝트 데이터
 * @param shouldTriggerAiGeneration - AI 이미지 자동 생성 트리거 여부
 */
export const useAutoGenerateImages = (
  project: ProjectDetailData | undefined,
  shouldTriggerAiGeneration: boolean,
) => {
  const flatElements = useCanvasDataStore((state) => state.flatElements);
  const { mutateAsync: generateAIImages } = useGenerateAIImages();

  // 중복 생성 방지 플래그 (프로젝트당 한 번만 실행)
  const hasStartedRef = useRef(false);
  const lastProjectIdRef = useRef<string | null>(null);

  // project.id 변경 시 플래그 리셋 (덮어쓰기 후 새 프로젝트로 전환 시)
  const projectId = project?.frames?.[0]?.projectId ?? null;
  if (projectId && projectId !== lastProjectIdRef.current) {
    hasStartedRef.current = false;
    lastProjectIdRef.current = projectId;
  }

  useEffect(() => {
    // 동작 조건 체크
    if (!project || !flatElements.size) return;

    // AI 생성 트리거가 아니면 스킵 (새로고침, 재진입, 일반 프로젝트 등)
    if (!shouldTriggerAiGeneration) return;

    // 이미 시작했으면 중복 실행 방지
    if (hasStartedRef.current) return;

    // AI 생성이 필요한 이미지 요소 필터링
    const allElements = Array.from(flatElements.values());
    const withImageName = allElements.filter((el) => isImageElement(el));
    const withCorrectType = withImageName.filter(
      (el) => el.type === 'rect' || el.type === 'path',
    );

    // 새 프로젝트 생성 시 모든 이미지 재생성 (기존 assetId 무시)
    const imageElements = withCorrectType as (KonvaRectElement | KonvaPathElement)[];

    // 생성할 이미지가 없으면 정상 종료
    if (imageElements.length === 0) return;

    // 생성 시작 플래그 설정 (중복 방지 — 팝업에서 취소해도 다시 묻지 않는다)
    hasStartedRef.current = true;

    // 만들지 물어본 뒤 AI 이미지 생성 실행 (토스트는 훅 내부에서 처리)
    void confirmAiImages({
      count: imageElements.length,
      hint: '만들지 않으면 사진 자리는 비워 두고, 나중에 이미지 탭에서 직접 만들 수 있어요.',
    }).then((ok) => {
      if (ok) generateAIImages(imageElements);
    });
  }, [project, flatElements, generateAIImages, shouldTriggerAiGeneration]);
};
