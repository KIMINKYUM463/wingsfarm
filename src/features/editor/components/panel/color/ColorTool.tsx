'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ToolSectionLayout } from '@/features/editor/components/panel/common';
import { useProjectDetail } from '@/features/editor/hooks/useProjectDetail';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useUpdateProject } from '@/features/projects/hooks';
import { countPaletteNodes, type PaletteNode } from '@/shared/lib/palette';
import { ROUTES } from '@/shared/constants/routes';
import { PalettePanel } from '@/shared/ui/PalettePanel';
import type { DraftPalette } from '@/shared/types/draft';

/** 색 고르는 동안(컬러 피커 드래그)은 모았다가 한 번에 저장 */
const SAVE_DELAY_MS = 800;

/**
 * 색상 탭 — 색상 무드 4색 + 추천 톤
 * - 팔레트 역할(colorVar)이 연결된 바탕·배지·강조 문구를 한 번에 다시 칠한다 (실행 취소 가능)
 * - AI 초안으로 만든 페이지에서만 쓸 수 있다 (템플릿 페이지에는 역할 정보가 없음)
 */
export default function ColorTool() {
  const { id: projectId } = useParams<{ id: string }>();
  const { data: project } = useProjectDetail(projectId);
  const frames = useCanvasDataStore((state) => state.frames);
  const applyPalette = useCanvasDataStore((state) => state.applyPalette);
  const { mutate: updateProject } = useUpdateProject();

  const [edited, setEdited] = useState<DraftPalette | null>(null);
  const palette = edited ?? project?.palette ?? null;
  const linkedCount = useMemo(
    () => frames.reduce((sum, f) => sum + (f.status === 'active' ? countPaletteNodes(f as PaletteNode) : 0), 0),
    [frames],
  );

  const pending = useRef<DraftPalette | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (pending.current) updateProject({ palette: pending.current });
    pending.current = null;
  }, [updateProject]);
  useEffect(() => flush, [flush]);

  const change = (next: DraftPalette) => {
    setEdited(next);
    applyPalette(next);
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  const unavailable = !palette || linkedCount === 0;

  return (
    <ToolSectionLayout
      title="색상"
      subtitle="메인 색상 기준으로 나머지 색이 자동으로 맞춰져요"
      isLoading={!project}
    >
      {unavailable ? (
        <div className="space-y-3 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
          <p>
            색상 탭은 <b>AI 초안으로 만든 페이지</b>에서 쓸 수 있어요. 섹션마다 대표색·배경색 역할이 연결돼 있어 한 번에 바뀌어요.
          </p>
          <p>템플릿으로 만든 페이지는 요소를 선택해 색을 하나씩 바꿔주세요.</p>
          <Link href={ROUTES.DRAFT_CREATE} className="font-semibold text-(--color-point)">
            AI 초안 만들기 →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>색이 연결된 요소 {linkedCount}개</span>
            {project?.originalPalette && (
              <button type="button" className="font-semibold text-gray-600 hover:text-gray-900" onClick={() => change(project.originalPalette!)}>
                ↺ 초기화
              </button>
            )}
          </div>
          <PalettePanel palette={palette} onChange={change} />
        </div>
      )}
    </ToolSectionLayout>
  );
}
