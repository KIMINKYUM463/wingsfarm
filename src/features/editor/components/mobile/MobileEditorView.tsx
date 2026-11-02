'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import IconButton from '@/shared/ui/Button/IconButton';
import { ROUTES } from '@/shared/constants/routes';
import { getProjectDetail } from '@/features/editor/api';
import { queryKeys } from '@/shared/constants/queryKeys';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useHeroMotion } from '@/features/editor/hooks/useHeroMotion';
import { useTemplateInitialization } from '@/features/editor/hooks/useTemplateInitialization';
import { useHeroVideoStore } from '@/features/editor/store/useHeroVideoStore';
import useWindowSize from '@/shared/hooks/useWindowSize';
import MobileCanvasFrame from './MobileCanvasFrame';
import { FrameLoadingPlaceholder } from '@/features/editor/components/FrameLoadingPlaceholder';
import type { KonvaFrameElement } from '@/shared/types/konva';

/** 모바일 콘텐츠 패딩 (px-4.5 = 18px) */
const MOBILE_CONTENT_PADDING = 18;

interface MobileEditorViewProps {
  projectId: string;
}

/**
 * 모바일 에디터 뷰 (읽기 전용)
 * - 단순 헤더 (뒤로가기만)
 * - 맨 위 움직이는 컷 + 프레임을 화면 너비에 맞춰 세로로 보여 준다
 * - 글자·사진 수정은 PC 에디터에서 한다
 */

export function MobileEditorView({ projectId }: MobileEditorViewProps) {
  const storeFrames = useCanvasDataStore((state) => state.frames);
  const { width: viewportWidth } = useWindowSize(100);
  useHeroMotion(projectId);
  const heroVideo = useHeroVideoStore((state) => state.video);

  // 캔버스 사용 가능 너비 계산 (좌우 패딩 18px씩 = 36px)
  const availableWidth = useMemo(() => viewportWidth - MOBILE_CONTENT_PADDING * 2, [viewportWidth]);

  // 프로젝트 데이터 조회 (서버 prefetch 데이터 사용)
  const { data: projectData } = useQuery({
    queryKey: queryKeys.EDITOR.projectDetail(projectId),
    queryFn: () => getProjectDetail(projectId),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // 템플릿 초기화 (프로젝트 데이터 → 캔버스 데이터)
  useTemplateInitialization(projectData?.data);

  // 렌더링할 프레임 데이터 (active만, 메모이제이션)
  const activeFrames = useMemo(
    () => storeFrames.filter((f) => f.status === 'active'),
    [storeFrames],
  );
  const isLoading = activeFrames.length === 0;

  return (
    <>
      {/* 모바일 헤더 */}
      <header className="px-content fixed top-0 right-0 left-0 z-50 flex h-(--header-h) items-center bg-white">
        <Link href={ROUTES.PROJECTS}>
          <IconButton
            icon="arrow_back_ios_new"
            className="btn-icon text-gray-300"
            iconWidth={20}
            iconHeight={20}
          />
        </Link>
      </header>

      {/* 프레임 리스트 */}
      <main className="flex-1 bg-gray-50">
        <div className="mx-auto pb-6" style={{ width: availableWidth }}>
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            미리보기예요. 글자와 사진을 고치려면 PC에서 열어 주세요.
          </p>
          {heroVideo && (
            <video
              src={heroVideo.url}
              className="mt-4 block w-full bg-gray-900"
              style={{ height: Math.round((availableWidth * heroVideo.height) / heroVideo.width) }}
              autoPlay
              loop
              muted
              playsInline
            />
          )}
          {isLoading ? (
            <FrameLoadingPlaceholder width={availableWidth} />
          ) : (
            activeFrames.map((frame: KonvaFrameElement, index: number) => (
              <MobileCanvasFrame
                key={frame.id}
                frame={frame}
                availableWidth={availableWidth}
                index={index}
                isLastFrame={index === activeFrames.length - 1}
              />
            ))
          )}
        </div>
      </main>
    </>
  );
}
