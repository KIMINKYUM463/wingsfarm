'use client';

import clsx from 'clsx';
import { useState } from 'react';
import LeftSideBar from '@/shared/ui/Sidebar/LeftSideBar';
import FrameListPanel from '@/features/editor/components/panel/frame/FrameListPanel';
import CanvasFrame from '@/features/editor/components/canvas/CanvasFrame';
import { useProjectDetail } from '@/features/editor/hooks/useProjectDetail';
import { AiChatPanel } from '@/features/editor/components/chat/AiChatPanel';
import { useIsToolPanelOpen } from '@/features/editor/store/useToolPanelStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useEditorInitialization } from '@/features/editor/hooks/useEditorInitialization';
import { useTemplateInitialization } from '@/features/editor/hooks/useTemplateInitialization';
import { useAutoGenerateImages } from '@/features/editor/hooks/useAutoGenerateImages';
import { useAutoSave } from '@/features/editor/hooks/useAutoSave';
import { useBeforeUnload } from '@/features/editor/hooks/useBeforeUnload';
import { useAiGuideModal } from '@/features/editor/hooks/useAiGuideModal';
import { useEditorKeyboard } from '@/features/editor/hooks/useEditorKeyboard';
import { useCtrlWheelZoom } from '@/features/editor/hooks/useCtrlWheelZoom';
import { FrameLoadingPlaceholder } from '@/features/editor/components/FrameLoadingPlaceholder';
import { TEMPLATE_COPY_LOADING } from '@/features/editor/lib/templateCopy';
import { EditorMediaBar } from '@/features/editor/components/overlay/EditorMediaBar';
import { HeroMotionSection } from '@/features/editor/components/canvas/HeroMotionSection';
import { useHeroMotion } from '@/features/editor/hooks/useHeroMotion';
import type { KonvaFrameElement } from '@/shared/types/konva';

interface KonvaEditorProps {
  projectId: string;
  /** 서버 최초 조회 여부 → 초기 썸네일 업로드 트리거 */
  isFirstView: boolean;
  /** AI 이미지 자동 생성 트리거 여부 (?ai=true + 서버 최초 조회) */
  shouldTriggerAiGeneration: boolean;
  /** 초안 만들기로 진입했는지 여부 (?draft=true) */
  isDraftCreation: boolean;
}

/**
 * Konva 에디터 컴포넌트
 *
 * ## 책임
 * - 프로젝트 데이터 조회 (서버 prefetch 활용)
 * - 에디터 상태 초기화
 * - 템플릿 데이터 초기화
 * - AI 이미지 자동 생성
 * - 자동 저장
 * - 캔버스 렌더링
 *
 * ## 캐싱 전략
 * - 서버에서 prefetch한 데이터를 HydrationBoundary로 전달받음
 * - staleTime 5분으로 캐시 유지
 * - refetchOnMount: false로 중복 요청 방지
 *
 * ## 사용처
 * - `/projects/[projectId]` 페이지
 */
export function KonvaEditor({
  projectId,
  isFirstView,
  shouldTriggerAiGeneration,
  isDraftCreation,
}: KonvaEditorProps) {
  const isToolPanelOpen = useIsToolPanelOpen();
  const storeFrames = useCanvasDataStore((state) => state.frames);
  const isInitialized = useCanvasDataStore((state) => state.isInitialized);
  const activatingFrameId = useCanvasDataStore((state) => state.activatingFrameId);

  // 프로젝트 데이터 조회 (서버 prefetch 데이터 사용)
  const { data: project } = useProjectDetail(projectId);

  // 에디터 초기화 (상태 클리어 + 초안 시 쿼리 파라미터 정리)
  useEditorInitialization();
  // 템플릿 초기화 (프로젝트 데이터 → 캔버스 데이터)
  useTemplateInitialization(project);
  // AI 이미지 자동 생성
  useAutoGenerateImages(project, shouldTriggerAiGeneration);
  // 자동 저장 + 초기 썸네일 업로드 (isFirstView일 때)
  useAutoSave(projectId, { isFirstView });
  // 저장 중 페이지 이탈 방지
  useBeforeUnload();
  // 에디터 키보드 단축키 (Escape, Delete 등)
  useEditorKeyboard();
  // Ctrl(⌘) + 휠로 화면 확대·축소
  useCtrlWheelZoom();

  // 렌더링할 프레임 데이터 (active만)
  const activeFrames = storeFrames.filter((f) => f.status === 'active');
  const isLoading = activeFrames.length === 0;

  // AI 가이드 모달 표시 (초안 만들기 + 최초 조회 + localStorage로 중복 체크)
  useAiGuideModal(isInitialized && isDraftCreation && isFirstView);

  // 맨 위 움직이는 컷: 위쪽 칩·모달과 첫 섹션 위 영상 섹션이 같은 상태를 쓴다
  const hero = useHeroMotion(projectId);
  const [motionOpen, setMotionOpen] = useState(false);

  return (
    <main className="flex-1 bg-gray-50">
      <LeftSideBar />
      <FrameListPanel />
      <AiChatPanel />
      {!isLoading && <EditorMediaBar projectId={projectId} hero={hero} motionOpen={motionOpen} onMotionOpenChange={setMotionOpen} />}
      <div
        className={clsx(
          'relative z-0 flex-1 overflow-hidden pb-(--footer-h)',
          isToolPanelOpen
            ? 'pl-[calc(var(--w-left-sidebar)+var(--tool-panel-w))]'
            : 'pl-(--w-left-sidebar)',
          'pr-[calc(var(--right-sidebar-w)+var(--right-sidebar-gap))]',
        )}
      >
        {!isLoading && <HeroMotionSection hero={hero} onEdit={() => setMotionOpen(true)} />}
        {isLoading ? (
          <FrameLoadingPlaceholder isToolPanelOpen={isToolPanelOpen} />
        ) : (
          activeFrames.map((frame: KonvaFrameElement, index: number) =>
            activatingFrameId === frame.id ? (
              <FrameLoadingPlaceholder
                key={frame.id}
                isToolPanelOpen={isToolPanelOpen}
                frameId={frame.id}
                index={index}
                isLastFrame={index === activeFrames.length - 1}
                message={TEMPLATE_COPY_LOADING}
              />
            ) : (
              <CanvasFrame
                key={frame.id}
                frame={frame}
                part2={frame.part2}
                index={index}
                isLastFrame={index === activeFrames.length - 1}
              />
            ),
          )
        )}
      </div>
    </main>
  );
}
