'use client';

import clsx from 'clsx';
import { useState } from 'react';
import type { HeroMotionState } from '@/features/editor/hooks/useHeroMotion';
import { useScrollToElement } from '@/features/editor/hooks/useScrollToElement';
import { elementTopInFrame, findBlankImageSlots, findPlaceholderTexts, isImageElement } from '@/features/editor/lib/element-finder';
import { useActiveFrames } from '@/features/editor/store/useCanvasDataStore';
import { useSelectionStore } from '@/features/editor/store/useSelectionStore';
import { PLATFORMS } from '@/features/editor/lib/download-options';
import { formatCost, HERO_VIDEO_USD, MEDIA_COST } from '@/shared/lib/draftMedia';
import { Modal } from '@/shared/ui/SimpleModal';
import { STOCK_SITES } from '@/shared/constants/stockSites';
import { StockVideoPicker } from './StockVideoPicker';
import { MAX_STOCK_PICKS, motionCredits, type HeroMotionInfo } from '@/shared/types/heroMotion';
import { showToast } from '@/utils/toast';
import type { KonvaElement, KonvaFrameElement } from '@/shared/types/konva';

const chip = 'flex items-center gap-1.5 rounded-full border bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur hover:border-gray-300';

/** 페이지 맨 위 사진 자리에 사진이 있는지 — 있어야 사진으로 컷(줌·AI 영상)을 만든다 (무료 영상은 사진 없이도 된다) */
function hasHeroPhoto(frames: KonvaFrameElement[]) {
  for (const frame of frames) {
    const slot = firstImageSlot(frame.children);
    if (slot) return Boolean('assetId' in slot && slot.assetId);
  }
  return false;
}

function firstImageSlot(elements: KonvaElement[]): KonvaElement | null {
  for (const element of elements) {
    if ('children' in element && Array.isArray(element.children)) {
      const found = firstImageSlot(element.children as KonvaElement[]);
      if (found) return found;
    } else if (isImageElement(element)) return element;
  }
  return null;
}

/**
 * 에디터 위쪽 안내 칩
 * - 빈 사진 자리 / 채울 문구([입력 필요]) N곳 → 누를 때마다 다음 자리로 이동·선택
 * - 맨 위 움직이는 컷(첫 섹션 위에 따로): 만드는 중 / 미리 보고 적용 / 보기·GIF 받기 / 다시 만들기 / 무료 영상 최대 3개로 AI 컷 편집
 */
export function EditorMediaBar({
  projectId,
  hero,
  motionOpen,
  onMotionOpenChange,
}: {
  projectId: string;
  hero: HeroMotionState;
  motionOpen: boolean;
  onMotionOpenChange: (open: boolean) => void;
}) {
  const frames = useActiveFrames();
  return (
    <div className="pointer-events-none fixed top-[calc(var(--header-h)+0.75rem)] left-1/2 z-30 flex -translate-x-1/2 gap-2">
      <TodoChip frames={frames} find={findBlankImageSlots} label="빈 사진 자리" />
      <TodoChip frames={frames} find={findPlaceholderTexts} label="채울 문구" />
      <button type="button" className={clsx(chip, 'pointer-events-auto border-gray-100 text-gray-800')} onClick={() => onMotionOpenChange(true)}>
        <MotionChipLabel motion={hero.motion} stale={hero.stale} applied={hero.applied} />
      </button>
      <HeroMotionModal open={motionOpen} onClose={() => onMotionOpenChange(false)} projectId={projectId} hero={hero} canCreate={hasHeroPhoto(frames)} />
    </div>
  );
}

/** 아직 손봐야 할 자리 N곳 — 누를 때마다 다음 자리로 이동·선택 */
function TodoChip({ frames, find, label }: { frames: KonvaFrameElement[]; find: (elements: KonvaElement[]) => KonvaElement[]; label: string }) {
  const targets = frames.flatMap((frame) => find(frame.children).map((element) => ({ frame, element })));
  const [cursor, setCursor] = useState(0);
  const { scrollToPosition } = useScrollToElement();
  const setSelectedItems = useSelectionStore((state) => state.setSelectedItems);
  if (!targets.length) return null;

  const goToNext = () => {
    const target = targets[cursor % targets.length];
    const top = elementTopInFrame(target.frame.children, target.element.id) ?? 0;
    scrollToPosition(target.frame.id, 0, top + (target.element.height ?? 0) / 2);
    setSelectedItems([{ id: target.element.id, type: target.element.type, rootId: target.frame.id }]);
    setCursor((c) => c + 1);
  };

  return (
    <button type="button" className={clsx(chip, 'pointer-events-auto border-amber-200 text-amber-700')} onClick={goToNext} title="누를 때마다 다음 자리로 이동해요">
      <span className="h-2 w-2 rounded-full bg-amber-400" />
      {label} {targets.length}곳
    </button>
  );
}

function MotionChipLabel({ motion, stale, applied }: { motion: HeroMotionInfo | null; stale: boolean; applied: boolean }) {
  if (!motion) return <>▶ 맨 위 움직이는 컷 만들기</>;
  if (motion.status === 'pending')
    return (
      <>
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-(--color-point) border-t-transparent" />
        {motion.kind === 'stock' ? 'AI가 무료 영상 컷 편집 중' : `움직이는 컷 만드는 중${motion.kind === 'video' ? ' (AI 영상 1~3분)' : ''}`}
      </>
    );
  if (motion.status === 'failed') return <span className="text-red-500">움직이는 컷 실패 · 다시 만들기</span>;
  if (stale) return <span className="text-amber-700">맨 위 사진이 바뀌었어요 · 움직이는 컷 다시 만들기</span>;
  if (!applied) return <span className="text-(--color-point)">✓ 움직이는 컷 완성 · 확인하고 적용하기</span>;
  return <>▶ 움직이는 컷 바꾸기 · GIF 받기</>;
}

function MotionCredits({ motion }: { motion: HeroMotionInfo }) {
  const credits = motionCredits(motion);
  if (motion.kind !== 'stock' || !credits.length) return null;
  return (
    <p className="-mt-2 text-xs text-gray-400">
      영상:{' '}
      {credits.map((credit, i) => (
        <span key={credit.url}>
          {i > 0 && ', '}
          <a href={credit.url} target="_blank" rel="noreferrer" className="underline">
            {credit.author}
          </a>
          ({STOCK_SITES[credit.source ?? 'pexels'].label})
        </span>
      ))}{' '}
      무료 영상
    </p>
  );
}

function HeroMotionModal({
  open,
  onClose,
  projectId,
  hero,
  canCreate,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  hero: HeroMotionState;
  canCreate: boolean;
}) {
  const { motion, stale, ready, applied, start, apply, downloadGif, downloadingGif } = hero;
  const busy = motion?.status === 'pending' || start.isPending;

  const applyToTop = () =>
    apply.mutate(true, {
      onSuccess: () => {
        onClose();
        showToast.success('상세페이지 첫 섹션 위에 움직이는 컷을 넣었어요.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });

  return (
    <Modal open={open} onClose={onClose} title="맨 위 움직이는 컷" width="max-w-lg">
      <div className="flex flex-col gap-4">
        {ready && motion ? (
          <video src={motion.clipUrl!} className="max-h-[50vh] w-full rounded-lg bg-gray-900 object-contain" autoPlay loop muted playsInline />
        ) : (
          <div className="flex h-48 items-center justify-center rounded-lg bg-gray-50 px-6 text-center text-sm text-gray-500">
            {busy
              ? motion?.kind === 'stock'
                ? 'AI가 고른 영상에서 좋은 장면을 찾아 컷 편집하고 있어요 (1분 안팎). 창을 닫아도 계속 만들어요.'
                : '만드는 중이에요. 창을 닫아도 계속 만들어요.'
              : stale
                ? '맨 위 사진이 바뀌어서 다시 만들어야 해요.'
                : '맨 위 사진을 움직이는 컷으로 만들거나, 무료 영상을 골라 AI 컷 편집으로 만들어요.'}
          </div>
        )}
        {ready && motion?.summary && <p className="-mt-2 text-sm text-gray-700">✦ {motion.summary}</p>}
        {ready && motion?.captions?.length ? (
          <p className="-mt-2 text-xs text-gray-500">자막: {motion.captions.map((caption) => `“${caption}”`).join(' → ')}</p>
        ) : null}
        {motion?.notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{motion.notice}</p>}
        {ready && motion && <MotionCredits motion={motion} />}

        {ready && !applied && (
          <div className="flex flex-col gap-2 rounded-lg bg-(--color-point)/5 p-3">
            <button type="button" className="btn-primary text-sm" disabled={apply.isPending} onClick={applyToTop}>
              {apply.isPending ? '넣는 중…' : '적용 — 상세페이지 맨 위(첫 섹션 위)에 넣기'}
            </button>
            <p className="text-xs text-gray-500">
              템플릿은 그대로 두고 그 위에 영상 섹션이 하나 더 생겨요. 마음에 안 들면 아래에서 영상을 다시 골라 새로 편집하세요.
            </p>
          </div>
        )}

        {applied && (
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-gray-900">GIF 받기</div>
            <div className="flex gap-2">
              {PLATFORMS.filter((p) => p.width).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn-outline flex-1 text-xs whitespace-nowrap"
                  disabled={downloadingGif !== null}
                  onClick={() => void downloadGif(p.width!)}
                >
                  {downloadingGif === p.width ? '만드는 중…' : `${p.label.replace('네이버 ', '')} ${p.width}px`}
                </button>
              ))}
            </div>
            <p className="text-xs leading-5 text-gray-500">
              스마트스토어·쿠팡 상세 편집기에서 <b>맨 위에 이 GIF</b>를 먼저 올리고, 그 아래에 상세 이미지(JPG)를 차례로 이어 붙이세요.
            </p>
          </div>
        )}

        {(canCreate || motion) && (
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
            <div className="text-sm font-semibold text-gray-900">{motion ? '다시 만들기' : '만들기'}</div>
            <div className="flex gap-2">
              <button type="button" className="btn-outline flex-1 text-sm" disabled={busy || !canCreate} onClick={() => start.mutate({ kind: 'pan' })}>
                천천히 줌·이동 · 무료
              </button>
              <button
                type="button"
                className="btn-primary flex-1 text-sm"
                disabled={busy || !canCreate}
                onClick={() =>
                  window.confirm(`AI 영상(${MEDIA_COST.heroVideoSeconds}초)은 ${formatCost(HERO_VIDEO_USD)} 정도가 Gemini 키로 청구돼요. 만들까요?`) &&
                  start.mutate({ kind: 'video' })
                }
              >
                ✦ AI 영상 · {formatCost(HERO_VIDEO_USD)}
              </button>
            </div>
            {!canCreate && <p className="text-xs text-gray-500">맨 위 사진 자리에 사진을 먼저 넣어 주세요. (무료 영상은 사진 없이도 돼요)</p>}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
          <div className="text-sm font-semibold text-gray-900">무료 영상 최대 {MAX_STOCK_PICKS}개로 AI 컷 편집</div>
          <StockVideoPicker
            projectId={projectId}
            disabled={busy}
            onSubmit={(videos) => start.mutate({ kind: 'stock', videos: videos.map((video) => ({ source: video.source, videoId: video.id })) })}
          />
        </div>
      </div>
    </Modal>
  );
}
