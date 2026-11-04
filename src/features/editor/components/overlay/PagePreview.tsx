'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type Konva from 'konva';
import IconButton from '@/shared/ui/Button/IconButton';
import Spinner from '@/shared/ui/Spinner/Spinner';
import ActionTooltip from '@/shared/ui/Tooltip/ActionTooltip';
import type { KonvaFrameElement } from '@/shared/types/konva';
import { CANVAS_WIDTH } from '@/features/editor/lib/download-options';
import { renderFrameJpeg } from '@/features/editor/lib/frameImage';
import { useActiveFrames } from '@/features/editor/store/useCanvasDataStore';
import { useStageRefStore } from '@/features/editor/store/useStageRefStore';
import { useHeroVideoStore } from '@/features/editor/store/useHeroVideoStore';

/** 돋보기 단계 (버튼 ± 용, 1 = 실제 크기) */
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2];
const ZOOM_MIN = ZOOM_STEPS[0];
const ZOOM_MAX = ZOOM_STEPS.at(-1)!;
/** Ctrl+휠 한 칸당 배율 변화 (0.1 = 10%p) */
const WHEEL_ZOOM_STEP = 0.1;
/** 200%까지 확대해도 흐리지 않으면서 메모리를 아끼는 배율 */
const PREVIEW_PIXEL_RATIO = 1.5;
/** 맞춤 배율을 계산할 때 좌우 여백 */
const FIT_PADDING = 64;

interface PreviewPage {
  id: string;
  url: string;
}

/** 다운로드와 같은 상태(편집 UI 숨김)로 페이지 한 장을 그려 임시 이미지 주소로 만든다 */
async function renderPage(stage: Konva.Stage, frame: KonvaFrameElement): Promise<string | null> {
  const blob = await renderFrameJpeg(frame, PREVIEW_PIXEL_RATIO, 0.9, stage);
  return blob ? URL.createObjectURL(blob) : null;
}

const nextZoom = (current: number, direction: 1 | -1) =>
  direction > 0
    ? (ZOOM_STEPS.find((z) => z > current + 0.001) ?? ZOOM_STEPS.at(-1)!)
    : ([...ZOOM_STEPS].reverse().find((z) => z < current - 0.001) ?? ZOOM_STEPS[0]);

/** 헤더 "미리보기" 버튼 — 누르면 페이지를 위아래로 이어 붙인 미리보기 창이 뜬다 */
export function PagePreviewButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon="visibility" text="미리보기" textClassName="p" className="btn-outline" onClick={() => setOpen(true)} />
      {open && <PagePreviewModal onClose={() => setOpen(false)} />}
    </>
  );
}

function PagePreviewModal({ onClose }: { onClose: () => void }) {
  const frames = useActiveFrames();
  const getStage = useStageRefStore((state) => state.getStage);
  /** 첫 섹션 위에 넣은 움직이는 컷 (실제 상세페이지에선 GIF로 올린다) */
  const heroVideo = useHeroVideoStore((state) => state.video);
  const pageWidth = frames[0]?.width || CANVAS_WIDTH;
  const heroHeight = heroVideo ? Math.round((pageWidth * heroVideo.height) / heroVideo.width) : 0;
  const totalHeight = heroHeight + frames.reduce((sum, f) => sum + (f.height || 0), 0);

  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  /** null = 창 폭에 맞춤 */
  const [zoom, setZoom] = useState<number | null>(null);
  const [fitZoom, setFitZoom] = useState(1);
  const fitZoomRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousZoom = useRef(1);

  const effectiveZoom = zoom ?? fitZoom;

  // 페이지를 차례로 그린다 (한꺼번에 그리면 화면이 멈춘다). 닫으면 만든 이미지 주소를 지운다
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      for (const [i, frame] of frames.entries()) {
        if (cancelled) return;
        const stage = getStage(frame.id);
        const url = stage ? await renderPage(stage, frame).catch(() => null) : null;
        if (url) urls.push(url);
        if (cancelled) return;
        if (url) setPages((prev) => [...prev, { id: frame.id, url }]);
        setProgress(i + 1);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [frames, getStage]);

  // 창 크기에 맞춘 배율 (100%보다 키우지 않음)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      fitZoomRef.current = Math.min(1, (el.clientWidth - FIT_PADDING) / pageWidth);
      setFitZoom(fitZoomRef.current);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageWidth]);

  // 확대·축소해도 보던 위치를 유지한다
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && previousZoom.current !== effectiveZoom) {
      el.scrollTop *= effectiveZoom / previousZoom.current;
    }
    previousZoom.current = effectiveZoom;
  }, [effectiveZoom]);

  const zoomBy = useCallback((direction: 1 | -1) => setZoom((z) => nextZoom(z ?? fitZoomRef.current, direction)), [setZoom]);

  // Esc 닫기 · +/- 확대·축소 · 0 맞춤
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') zoomBy(1);
      else if (e.key === '-') zoomBy(-1);
      else if (e.key === '0') setZoom(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, zoomBy]);

  // Ctrl(⌘) + 휠 = 10%씩 확대·축소
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.deltaY === 0) return;
      e.preventDefault();
      e.stopImmediatePropagation(); // 아래 에디터 줌 핸들러와 겹치지 않게
      const step = e.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP;
      setZoom((z) => {
        const current = z ?? fitZoomRef.current;
        return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((current + step) * 100) / 100));
      });
    };
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', onWheel, { capture: true });
  }, []);

  const skipped = done ? frames.length - pages.length : 0;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex flex-col bg-gray-950/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="상세페이지 미리보기">
      <div className="flex shrink-0 items-center justify-between gap-4 px-6 py-3 text-white">
        <div className="min-w-0">
          <p className="text-base font-semibold">미리보기</p>
          <p className="truncate text-xs text-gray-300">
            {heroVideo && '움직이는 컷(GIF) + '}페이지 {frames.length}개 · 폭 {pageWidth}px · 총 높이 {totalHeight.toLocaleString()}px
            {skipped > 0 && ` · ${skipped}개 페이지는 아직 불러오지 못해 빠졌어요`}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
          <ActionTooltip content="축소 (-)" direction="bottom">
            <IconButton icon="zoom_out" className="rounded-md p-1.5 text-white hover:bg-white/15" onClick={() => zoomBy(-1)} aria-label="축소" />
          </ActionTooltip>
          <button type="button" className="w-14 rounded-md py-1 text-sm tabular-nums hover:bg-white/15" onClick={() => setZoom(1)} title="실제 크기로">
            {Math.round(effectiveZoom * 100)}%
          </button>
          <ActionTooltip content="확대 (+)" direction="bottom">
            <IconButton icon="zoom_in" className="rounded-md p-1.5 text-white hover:bg-white/15" onClick={() => zoomBy(1)} aria-label="확대" />
          </ActionTooltip>
          <button
            type="button"
            className="rounded-md px-2.5 py-1 text-sm hover:bg-white/15 disabled:opacity-40"
            onClick={() => setZoom(null)}
            disabled={zoom === null}
          >
            화면 맞춤
          </button>
        </div>

        <IconButton icon="close" className="rounded-lg p-1.5 text-white hover:bg-white/15" onClick={onClose} aria-label="닫기" />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="mx-auto w-max py-8">
          <div className="bg-white shadow-2xl" style={{ width: pageWidth * effectiveZoom }}>
            {heroVideo && (
              <video
                src={heroVideo.url}
                className="block w-full"
                style={{ aspectRatio: `${heroVideo.width} / ${heroVideo.height}` }}
                autoPlay
                loop
                muted
                playsInline
              />
            )}
            {pages.map((page) => (
              // 페이지 사이 틈 없이 이어 붙인다 (block + 폭 100%)
              // eslint-disable-next-line @next/next/no-img-element
              <img key={page.id} src={page.url} alt="" className="block w-full" draggable={false} />
            ))}
          </div>
          {!done && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-300">
              <Spinner size={18} className="text-gray-300" />
              페이지를 그리는 중 ({progress}/{frames.length})
            </div>
          )}
        </div>
      </div>
      <p className="shrink-0 pb-2 text-center text-xs text-gray-400">Ctrl(⌘) + 휠로 확대·축소 · Esc 닫기</p>
    </div>,
    document.body,
  );
}
