'use client';

import clsx from 'clsx';
import { useState } from 'react';
import { useHeroMotion } from '@/features/editor/hooks/useHeroMotion';
import { useScrollToElement } from '@/features/editor/hooks/useScrollToElement';
import { findBlankImageSlots, isImageElement } from '@/features/editor/lib/element-finder';
import { useActiveFrames } from '@/features/editor/store/useCanvasDataStore';
import { useSelectionStore } from '@/features/editor/store/useSelectionStore';
import { PLATFORMS } from '@/features/editor/lib/download-options';
import { formatCost, HERO_VIDEO_USD, MEDIA_COST } from '@/shared/lib/draftMedia';
import { Modal } from '@/shared/ui/SimpleModal';
import type { HeroMotionInfo } from '@/shared/types/heroMotion';
import type { KonvaElement, KonvaFrameElement } from '@/shared/types/konva';

const chip = 'flex items-center gap-1.5 rounded-full border bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur hover:border-gray-300';

/** 페이지 맨 위 사진 자리에 사진이 들어 있는지 (움직이는 컷을 새로 만들 수 있는지) */
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
 * - 빈 사진 자리 N곳 → 누를 때마다 다음 빈 자리로 이동·선택
 * - 맨 위 움직이는 컷: 만드는 중 / 보기·GIF 받기 / 다시 만들기
 */
export function EditorMediaBar({ projectId }: { projectId: string }) {
  const frames = useActiveFrames();
  const blanks = frames.flatMap((frame) => findBlankImageSlots(frame.children).map((element) => ({ frame, element })));
  const [cursor, setCursor] = useState(0);
  const { scrollToFrameById } = useScrollToElement();
  const setSelectedItems = useSelectionStore((state) => state.setSelectedItems);
  const hero = useHeroMotion(projectId);
  const [motionOpen, setMotionOpen] = useState(false);

  const goToNextBlank = () => {
    const target = blanks[cursor % blanks.length];
    if (!target) return;
    scrollToFrameById(target.frame.id, { block: 'start' });
    setSelectedItems([{ id: target.element.id, type: target.element.type, rootId: target.frame.id }]);
    setCursor((c) => c + 1);
  };

  const canCreate = hasHeroPhoto(frames);
  if (!blanks.length && !hero.motion && !canCreate) return null;

  return (
    <div className="pointer-events-none fixed top-[calc(var(--header-h)+0.75rem)] left-1/2 z-30 flex -translate-x-1/2 gap-2">
      {blanks.length > 0 && (
        <button type="button" className={clsx(chip, 'pointer-events-auto border-amber-200 text-amber-700')} onClick={goToNextBlank} title="누를 때마다 다음 빈 자리로 이동해요">
          <span className="h-2 w-2 rounded-full bg-amber-400" />빈 사진 자리 {blanks.length}곳
        </button>
      )}
      {(hero.motion || canCreate) && (
        <button type="button" className={clsx(chip, 'pointer-events-auto border-gray-100 text-gray-800')} onClick={() => setMotionOpen(true)}>
          <MotionChipLabel motion={hero.motion} stale={hero.stale} />
        </button>
      )}
      <HeroMotionModal open={motionOpen} onClose={() => setMotionOpen(false)} hero={hero} canCreate={canCreate} />
    </div>
  );
}

function MotionChipLabel({ motion, stale }: { motion: HeroMotionInfo | null; stale: boolean }) {
  if (!motion) return <>▶ 맨 위 움직이는 컷 만들기</>;
  if (motion.status === 'pending')
    return (
      <>
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-(--color-point) border-t-transparent" />
        움직이는 컷 만드는 중{motion.kind === 'video' ? ' (AI 영상 1~3분)' : ''}
      </>
    );
  if (motion.status === 'failed') return <span className="text-red-500">움직이는 컷 실패 · 다시 만들기</span>;
  if (stale) return <span className="text-amber-700">맨 위 사진이 바뀌었어요 · 움직이는 컷 다시 만들기</span>;
  return <>▶ 움직이는 컷 보기 · GIF 받기</>;
}

function HeroMotionModal({ open, onClose, hero, canCreate }: { open: boolean; onClose: () => void; hero: ReturnType<typeof useHeroMotion>; canCreate: boolean }) {
  const { motion, stale, start, downloadGif, downloadingGif } = hero;
  const ready = motion?.status === 'ready' && motion.clipUrl && !stale;
  const busy = motion?.status === 'pending' || start.isPending;
  return (
    <Modal open={open} onClose={onClose} title="맨 위 움직이는 컷" width="max-w-lg">
      <div className="flex flex-col gap-4">
        {ready ? (
          <video src={motion.clipUrl!} className="max-h-[50vh] w-full rounded-lg bg-gray-900 object-contain" autoPlay loop muted playsInline />
        ) : (
          <div className="flex h-48 items-center justify-center rounded-lg bg-gray-50 px-6 text-center text-sm text-gray-500">
            {busy ? '만드는 중이에요. 창을 닫아도 계속 만들어요.' : stale ? '맨 위 사진이 바뀌어서 다시 만들어야 해요.' : '맨 위 사진을 천천히 움직이는 컷으로 만들어요.'}
          </div>
        )}
        {motion?.notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{motion.notice}</p>}

        {ready && (
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-gray-900">GIF 받기 (섹션 문구까지 함께)</div>
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
              스마트스토어·쿠팡 상세 편집기에서 <b>맨 위에 이 GIF</b>를 먼저 올리고, 그 아래에 상세 이미지(JPG)를 이어 붙이세요. 상세 이미지의 맨 위 섹션은 GIF와 겹치니 빼고 올려도 돼요.
            </p>
          </div>
        )}

        {(canCreate || motion) && (
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
            <div className="text-sm font-semibold text-gray-900">{motion ? '다시 만들기' : '만들기'}</div>
            <div className="flex gap-2">
              <button type="button" className="btn-outline flex-1 text-sm" disabled={busy || !canCreate} onClick={() => start.mutate('pan')}>
                천천히 줌·이동 · 무료
              </button>
              <button
                type="button"
                className="btn-primary flex-1 text-sm"
                disabled={busy || !canCreate}
                onClick={() => window.confirm(`AI 영상(${MEDIA_COST.heroVideoSeconds}초)은 ${formatCost(HERO_VIDEO_USD)} 정도가 Gemini 키로 청구돼요. 만들까요?`) && start.mutate('video')}
              >
                ✦ AI 영상 · {formatCost(HERO_VIDEO_USD)}
              </button>
            </div>
            {!canCreate && <p className="text-xs text-gray-500">맨 위 사진 자리에 사진을 먼저 넣어 주세요.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
