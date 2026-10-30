'use client';

import clsx from 'clsx';
import { useState } from 'react';
import { ToolSectionLayout } from '@/features/editor/components/panel/common';
import { usePageAnimation } from '@/features/editor/hooks/usePageAnimation';
import { useScrollToElement } from '@/features/editor/hooks/useScrollToElement';
import { useSelectedElement } from '@/features/editor/hooks/useSelectedElement';
import {
  ANIMATION_EFFECTS,
  canUseEffect,
  clampSeconds,
  collectAnimated,
  createAnimation,
  effectInfo,
  normalizeAnimation,
  PAGE_LENGTH,
  pageLengthOf,
  type EffectInfo,
} from '@/features/editor/lib/animation';
import { PLATFORMS } from '@/features/editor/lib/download-options';
import { isImageElement } from '@/features/editor/lib/element-finder';
import { useActiveFrames, useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useSelectionStore } from '@/features/editor/store/useSelectionStore';
import type { AnimationEffect, ElementAnimation } from '@/shared/types/animation';
import type { KonvaElement, KonvaFrameElement } from '@/shared/types/konva';

/** 마켓별 받기 — 쿠팡은 WebP, 나머지는 GIF */
const DOWNLOADS = PLATFORMS.flatMap((p) => (p.width ? [{ id: p.id, label: p.label.replace('네이버 ', ''), width: p.width, format: p.id === 'coupang' ? ('webp' as const) : ('gif' as const) }] : []));

const TYPE_LABELS: Record<string, string> = { rect: '도형', path: '아이콘', group: '그룹', frame: '묶음', line: '선', arrow: '화살표', circle: '원', ellipse: '타원', star: '별', regularPolygon: '다각형' };

const elementLabel = (element: KonvaElement) => {
  if (element.type === 'text') {
    const line = element.text.replace(/\s+/g, ' ').trim();
    return line.length > 14 ? `${line.slice(0, 14)}…` : line || '글자';
  }
  return isImageElement(element) ? '사진' : (TYPE_LABELS[element.type] ?? '요소');
};

const pageLabel = (frame: KonvaFrameElement, index: number) => `${index + 1}. ${frame.part2 || frame.name || '페이지'}`;

/** 움직임을 넣을 수 있는 선택 요소 (페이지 자체는 제외) */
const isAnimatable = (element: KonvaElement) => !(element.type === 'frame' && !element.rootId);

export default function AnimationTool() {
  const frames = useActiveFrames();
  const updateElement = useCanvasDataStore((state) => state.updateElement);
  const setSelectedItems = useSelectionStore((state) => state.setSelectedItems);
  const { scrollToFrameById } = useScrollToElement();
  const { elements } = useSelectedElement();
  const { playingId, play, stop, exporting, download } = usePageAnimation();
  const [chosenPageId, setChosenPageId] = useState<string | null>(null);

  const targets = elements.filter(isAnimatable);
  const pageId = targets[0]?.rootId ?? chosenPageId ?? frames[0]?.id;
  const page = frames.find((f) => f.id === pageId);
  const pageIndex = page ? frames.indexOf(page) : -1;
  const length = page ? pageLengthOf(page) : PAGE_LENGTH.default;
  const animated = page ? collectAnimated(page.children) : [];
  const busy = exporting !== null;

  const replay = () => page && requestAnimationFrame(() => play(page.id));

  const setEffect = (info: EffectInfo | null) => {
    for (const element of targets) {
      if (info && !canUseEffect(info, element)) continue;
      const animation = info ? normalizeAnimation({ ...createAnimation(info.id), delay: element.animation?.delay ?? 0 }, length) : undefined;
      updateElement(element.id, { animation });
    }
    if (info) replay();
  };

  const setTiming = (patch: Partial<Pick<ElementAnimation, 'delay' | 'duration'>>) => {
    for (const element of targets) {
      if (element.animation) updateElement(element.id, { animation: normalizeAnimation({ ...element.animation, ...patch }, length) });
    }
  };

  const setLength = (value: number) => {
    if (!page) return;
    const next = clampSeconds(value, PAGE_LENGTH.min, PAGE_LENGTH.max);
    updateElement(page.id, { animationLength: next });
    for (const element of animated) {
      const fitted = normalizeAnimation(element.animation!, next);
      if (fitted.delay !== element.animation!.delay || fitted.duration !== element.animation!.duration) updateElement(element.id, { animation: fitted });
    }
  };

  const choosePage = (id: string) => {
    stop();
    setChosenPageId(id);
    setSelectedItems([]);
    scrollToFrameById(id, { block: 'start' });
  };

  const selectElement = (element: KonvaElement) => setSelectedItems([{ id: element.id, type: element.type, rootId: element.rootId ?? pageId }]);

  const current = targets.length === 1 ? targets[0].animation : undefined;
  const sharedEffect = targets.length && targets.every((t) => t.animation?.effect === targets[0].animation?.effect) ? targets[0].animation?.effect : undefined;

  return (
    <ToolSectionLayout title="움직임" subtitle="글자·사진에 움직임을 넣고 페이지를 GIF로 받아요">
      {!page ? (
        <p className="text-sm text-gray-500">페이지가 없어요.</p>
      ) : (
        <>
          <section className="space-y-3">
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={page.id}
              onChange={(e) => choosePage(e.target.value)}
              aria-label="움직임을 볼 페이지"
            >
              {frames.map((f, i) => {
                const count = collectAnimated(f.children).length;
                return (
                  <option key={f.id} value={f.id}>
                    {pageLabel(f, i)}
                    {count ? ` · 움직임 ${count}` : ''}
                  </option>
                );
              })}
            </select>

            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
              <span className="text-sm text-gray-600">재생 길이</span>
              <div className="flex items-center gap-1">
                <button type="button" className="btn-icon h-7 w-7 rounded-md border bg-white" aria-label="재생 길이 줄이기" disabled={length <= PAGE_LENGTH.min} onClick={() => setLength(length - 1)}>
                  −
                </button>
                <span className="w-12 text-center text-sm font-semibold">{length}초</span>
                <button type="button" className="btn-icon h-7 w-7 rounded-md border bg-white" aria-label="재생 길이 늘리기" disabled={length >= PAGE_LENGTH.max} onClick={() => setLength(length + 1)}>
                  +
                </button>
              </div>
            </div>

            <Timeline elements={animated} length={length} selectedIds={targets.map((t) => t.id)} onSelect={selectElement} />

            <button
              type="button"
              className="btn-outline w-full text-sm"
              disabled={!animated.length || busy}
              onClick={() => (playingId === page.id ? stop() : play(page.id))}
            >
              {playingId === page.id ? '■ 멈추기' : '▶ 이 페이지 재생'}
            </button>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {targets.length ? (targets.length === 1 ? `고른 요소 · ${elementLabel(targets[0])}` : `고른 요소 ${targets.length}개`) : '효과'}
            </h3>
            {!targets.length ? (
              <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm leading-6 text-gray-500">
                캔버스에서 글자·사진·도형을 하나 고르면
                <br />
                움직임을 넣을 수 있어요
              </p>
            ) : (
              <>
                <EffectGroup title="나타날 때 한 번" kind="enter" targets={targets} active={sharedEffect} onPick={setEffect} />
                <EffectGroup title="페이지가 끝날 때까지 반복" kind="loop" targets={targets} active={sharedEffect} onPick={setEffect} />
                {targets.some((t) => t.animation) && (
                  <>
                    <Slider
                      label="시작"
                      value={current?.delay ?? 0}
                      max={Math.max(0, length - 0.1)}
                      min={0}
                      onChange={(delay) => setTiming({ delay })}
                      onCommit={replay}
                    />
                    <Slider
                      label={effectInfo(current?.effect)?.kind === 'loop' ? '한 번 반복' : '나타나는 시간'}
                      value={current?.duration ?? 0.8}
                      min={0.2}
                      max={length}
                      onChange={(duration) => setTiming({ duration })}
                      onCommit={replay}
                    />
                    <button type="button" className="text-xs font-semibold text-gray-500 hover:text-red-500" onClick={() => setEffect(null)}>
                      움직임 빼기
                    </button>
                  </>
                )}
              </>
            )}
          </section>

          <section className="space-y-2 border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-900">{pageIndex + 1}페이지 받기</h3>
            <div className="grid grid-cols-3 gap-2">
              {DOWNLOADS.map((d) => {
                const running = exporting?.width === d.width && exporting.format === d.format;
                return (
                  <button
                    key={d.id}
                    type="button"
                    className="btn-outline flex flex-col items-center gap-0.5 px-1 py-2 text-xs"
                    disabled={!animated.length || busy}
                    onClick={() => void download(page.id, d.format, d.width)}
                  >
                    <span className="font-semibold">{d.label}</span>
                    <span className="text-gray-500">
                      {running && exporting.total ? `${Math.round((exporting.done / exporting.total) * 100)}%` : `${d.width} · ${d.format.toUpperCase()}`}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs leading-5 text-gray-500">
              움직임을 넣은 페이지만 GIF로 받아 상세 이미지 사이 같은 자리에 올리세요. 쿠팡은 WebP로 받아요.
            </p>
          </section>
        </>
      )}
    </ToolSectionLayout>
  );
}

function EffectGroup({
  title,
  kind,
  targets,
  active,
  onPick,
}: {
  title: string;
  kind: EffectInfo['kind'];
  targets: KonvaElement[];
  active: AnimationEffect | undefined;
  onPick: (info: EffectInfo | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        {kind === 'enter' && <EffectButton label="없음" selected={!active && targets.every((t) => !t.animation)} onClick={() => onPick(null)} />}
        {ANIMATION_EFFECTS.filter((e) => e.kind === kind).map((info) => {
          const usable = targets.some((t) => canUseEffect(info, t));
          return (
            <EffectButton
              key={info.id}
              label={info.label}
              selected={active === info.id}
              disabled={!usable}
              title={usable ? undefined : info.needs === 'number' ? '숫자가 있는 글자에서 쓸 수 있어요' : '글자에서 쓸 수 있어요'}
              onClick={() => onPick(info)}
            />
          );
        })}
      </div>
    </div>
  );
}

function EffectButton({ label, selected, disabled, title, onClick }: { label: string; selected: boolean; disabled?: boolean; title?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        'rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        selected ? 'border-(--color-point) bg-(--color-point)/10 text-(--color-point)' : 'border-gray-200 text-gray-700 hover:border-gray-300',
      )}
    >
      {label}
    </button>
  );
}

function Slider({ label, value, min, max, onChange, onCommit }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; onCommit: () => void }) {
  return (
    <label className="block space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-semibold">{value.toFixed(1)}초</span>
      </div>
      <input
        type="range"
        className="w-full accent-(--color-point)"
        min={min}
        max={max}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
    </label>
  );
}

/** 페이지 안 움직임 순서 — 막대 위치 = 시작, 길이 = 나타나는 시간 (반복은 끝까지 줄무늬) */
function Timeline({ elements, length, selectedIds, onSelect }: { elements: KonvaElement[]; length: number; selectedIds: string[]; onSelect: (element: KonvaElement) => void }) {
  if (!elements.length) return <p className="text-xs text-gray-500">이 페이지에는 아직 움직이는 요소가 없어요.</p>;
  return (
    <ul className="space-y-1.5">
      {elements.map((element) => {
        const animation = element.animation!;
        const loop = effectInfo(animation.effect)?.kind === 'loop';
        const left = (animation.delay / length) * 100;
        const width = loop ? 100 - left : Math.min(100 - left, (animation.duration / length) * 100);
        return (
          <li key={element.id}>
            <button
              type="button"
              onClick={() => onSelect(element)}
              className={clsx('w-full rounded-lg px-2 py-1.5 text-left hover:bg-gray-50', selectedIds.includes(element.id) && 'bg-gray-50 ring-1 ring-gray-200')}
            >
              <div className="flex justify-between text-xs">
                <span className="truncate text-gray-800">{elementLabel(element)}</span>
                <span className="shrink-0 text-gray-500">{effectInfo(animation.effect)?.label}</span>
              </div>
              <div className="relative mt-1 h-1.5 rounded-full bg-gray-100">
                <div
                  className={clsx('absolute inset-y-0 rounded-full bg-(--color-point)', loop && 'opacity-50')}
                  style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
