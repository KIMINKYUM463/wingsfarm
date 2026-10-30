'use client';

import dynamic from 'next/dynamic';
import useIsMobile from '@/shared/hooks/useIsMobile';
import { EditorHeader } from '@/shared/ui/Header/EditorHeader';
import EditorFooter from '@/shared/ui/Footer/EditorFooter';
import { FrameLoadingPlaceholder } from '@/features/editor/components/FrameLoadingPlaceholder';
import { AssistantBot } from '@/features/editor/components/assistant/AssistantBot';

/** 데스크톱 로딩 UI - KonvaEditor 내부와 동일한 레이아웃 */
const DesktopLoadingFallback = () => (
  <main className="flex-1 bg-gray-50">
    <div className="relative z-0 flex-1 overflow-hidden pb-(--footer-h) pl-(--w-left-sidebar) pr-[calc(var(--right-sidebar-w)+var(--right-sidebar-gap))]">
      <FrameLoadingPlaceholder isToolPanelOpen={false} />
    </div>
  </main>
);

/** 모바일 로딩 UI - MobileEditorView 내부와 동일한 레이아웃 */
const MobileLoadingFallback = () => (
  <>
    {/* 모바일 헤더 플레이스홀더 */}
    <header className="px-content fixed top-0 right-0 left-0 z-50 flex h-(--header-h) items-center bg-white" />
    {/* 프레임 로딩 플레이스홀더 - variant="mobile"로 반응형 너비 자동 계산 */}
    <main className="flex-1 bg-gray-50">
      <div className="mx-auto px-4.5">
        <FrameLoadingPlaceholder variant="mobile" />
      </div>
    </main>
  </>
);

/**
 * Konva 컴포넌트 동적 import (ssr: false)
 * - Konva는 클라이언트 전용 라이브러리
 * - 서버 번들에서 제외하여 "Several Konva instances detected" 경고 방지
 * - loading: 동적 로드 중 동일한 로딩 UI 표시 (깜빡임 방지)
 */
const KonvaEditor = dynamic(
  () => import('@/features/editor/components/KonvaEditor').then((mod) => mod.KonvaEditor),
  {
    ssr: false,
    loading: DesktopLoadingFallback,
  },
);

const MobileEditorView = dynamic(
  () => import('@/features/editor/components/mobile/MobileEditorView').then((mod) => mod.MobileEditorView),
  {
    ssr: false,
    loading: MobileLoadingFallback,
  },
);

interface EditorPageClientProps {
  projectId: string;
  productName: string;
  isFirstView: boolean;
  shouldTriggerAiGeneration: boolean;
  isDraftCreation: boolean;
}

/**
 * 에디터 페이지 클라이언트 래퍼
 * - useIsMobile 훅이 마운트 상태 관리 (null → 마운트 전)
 * - 마운트 후 뷰포트 기반 모바일/데스크톱 분기
 */
export function EditorPageClient({
  projectId,
  productName,
  isFirstView,
  shouldTriggerAiGeneration,
  isDraftCreation,
}: EditorPageClientProps) {
  const isMobile = useIsMobile();

  // SSR/hydration 중: null 반환 (모바일/데스크톱 레이아웃 시프트 방지)
  // FCP는 dynamic import의 loading 옵션에서 처리
  if (isMobile === null) {
    return null;
  }

  // 모바일: 읽기 전용 뷰
  if (isMobile) {
    return <MobileEditorView projectId={projectId} />;
  }

  // 데스크톱: 전체 에디터
  return (
    <>
      <EditorHeader productName={productName} />
      <KonvaEditor
        projectId={projectId}
        isFirstView={isFirstView}
        shouldTriggerAiGeneration={shouldTriggerAiGeneration}
        isDraftCreation={isDraftCreation}
      />
      <EditorFooter />
      <AssistantBot />
    </>
  );
}
