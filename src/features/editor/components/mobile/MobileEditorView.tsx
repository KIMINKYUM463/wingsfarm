'use client';

import { useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Icon from '@/shared/ui/Icon';
import IconButton from '@/shared/ui/Button/IconButton';
import { ROUTES } from '@/shared/constants/routes';
import { getProjectDetail } from '@/features/editor/api';
import { queryKeys } from '@/shared/constants/queryKeys';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useTemplateInitialization } from '@/features/editor/hooks/useTemplateInitialization';
import useWindowSize from '@/shared/hooks/useWindowSize';
import { useDialog } from '@/shared/ui/Dialog/useDialog';
import MobileCanvasFrame from './MobileCanvasFrame';
import { FrameLoadingPlaceholder } from '@/features/editor/components/FrameLoadingPlaceholder';
import type { KonvaFrameElement } from '@/shared/types/konva';

/** 모바일 콘텐츠 패딩 (px-4.5 = 18px) */
const MOBILE_CONTENT_PADDING = 18;

interface MobileEditorViewProps {
  projectId: string;
}

/** 태블릿 브레이크포인트 (useIsMobile과 동일) */
const TABLET_BREAKPOINT = 758;

/** 알럿 아이콘 (정적 컴포넌트) */
const AlertIcon = (
  <div className="size-12 rounded-full bg-(--color-bg-point) p-3">
    <Icon name="edit_off" className="p-0.5 text-(--color-point)" />
  </div>
);

/**
 * 모바일 에디터 뷰 (읽기 전용)
 * - 단순 헤더 (뒤로가기만)
 * - 프레임 세로 스크롤 표시
 * - 에디터 기능 없음 (사이드바, 푸터, 인터랙션 없음)
 */

export function MobileEditorView({ projectId }: MobileEditorViewProps) {
  const storeFrames = useCanvasDataStore((state) => state.frames);
  const { width: viewportWidth } = useWindowSize(100);
  const openAlert = useDialog((state) => state.openAlert);
  const resolveAlert = useDialog((state) => state.resolveAlert);
  const hasShownAlert = useRef(false);

  // 데스크톱으로 전환 시 (언마운트) 알럿 자동 닫기
  useEffect(() => {
    return () => {
      if (window.innerWidth >= TABLET_BREAKPOINT) {
        resolveAlert();
      }
    };
  }, [resolveAlert]);

  // 모바일 진입 시 미리보기 안내 알럿 표시 (컴포넌트 마운트 시 1회)
  useEffect(() => {
    if (!hasShownAlert.current) {
      hasShownAlert.current = true;
      openAlert({
        title: '지금은 미리보기만 가능합니다.',
        description:
          '모바일 환경에서는 편집 기능을 지원하지 않습니다.\n전체 기능은 PC 웹에서 이용해주세요.',
        confirmText: '확인했어요',
        icon: AlertIcon,
      });
    }
  }, [openAlert]);

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
