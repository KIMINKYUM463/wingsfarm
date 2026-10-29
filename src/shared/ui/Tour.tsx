'use client';

import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export interface TourStep {
  /** 강조할 요소 (CSS 선택자). 없으면 화면 가운데 안내 */
  selector?: string;
  title: string;
  body: string;
}

const doneKey = (key: string) => `wingsfarm:tour:${key}`;
const subscribe = () => () => {};

/** 한 번 본 안내는 다시 띄우지 않는다 (다시 보기 버튼으로는 언제든 열 수 있음) */
export function useTour(key: string, autoStart: boolean) {
  const seen = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(doneKey(key)) === '1',
    () => true,
  );
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? (autoStart && !seen);
  const close = useCallback(() => {
    window.localStorage.setItem(doneKey(key), '1');
    setManual(false);
  }, [key]);
  const start = useCallback(() => setManual(true), []);
  return { open, start, close };
}

const POPOVER_W = 320;
const POPOVER_H = 190;
const GAP = 12;
const EDGE = 16;

interface Box {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/** 화면보다 큰 요소(캔버스 등)는 보이는 부분만 비춰야 주변이 어두워진다 */
function clipToViewport(rect: DOMRect, pad: number): Box {
  return {
    top: Math.max(rect.top - pad, 4),
    left: Math.max(rect.left - pad, 4),
    right: Math.min(rect.right + pad, window.innerWidth - 4),
    bottom: Math.min(rect.bottom + pad, window.innerHeight - 4),
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/** 아래 → 위 → 오른쪽 → 왼쪽 순으로 자리가 있는 쪽에 설명을 띄우고, 없으면 대상 안쪽 위에 띄운다 */
function placePopover(box: Box | null): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!box) return { top: vh / 2 - POPOVER_H / 2, left: vw / 2 - POPOVER_W / 2 };

  const alignLeft = clamp(box.left, EDGE, vw - POPOVER_W - EDGE);
  const alignTop = clamp(box.top, EDGE, vh - POPOVER_H - EDGE);
  if (vh - box.bottom >= POPOVER_H + GAP) return { top: box.bottom + GAP, left: alignLeft };
  if (box.top >= POPOVER_H + GAP) return { top: box.top - POPOVER_H - GAP, left: alignLeft };
  if (vw - box.right >= POPOVER_W + GAP) return { top: alignTop, left: box.right + GAP };
  if (box.left >= POPOVER_W + GAP) return { top: alignTop, left: box.left - POPOVER_W - GAP };
  return { top: alignTop + EDGE, left: clamp(box.left + EDGE, EDGE, vw - POPOVER_W - EDGE) };
}

/** 단계별 안내 투어 — 대상 요소를 밝게 비추고 옆에 설명을 띄운다 */
export function Tour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[index];

  useLayoutEffect(() => {
    if (!open || !step) return;
    const measure = () => {
      const el = step.selector ? document.querySelector(step.selector) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const el = step.selector ? document.querySelector(step.selector) : null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    measure();
    const timer = setTimeout(measure, 350);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !step) return null;

  const finish = () => {
    setIndex(0);
    onClose();
  };
  const pad = 8;
  const box = rect && clipToViewport(rect, pad);
  const popover = placePopover(box);

  return createPortal(
    <div className="fixed inset-0 z-[10001]" role="dialog" aria-label="사용 안내">
      {box ? (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-200"
          style={{
            top: box.top,
            left: box.left,
            width: box.right - box.left,
            height: box.bottom - box.top,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            outline: '2px solid var(--color-point)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/45" />
      )}
      <div className="absolute w-80 rounded-2xl bg-white p-4 shadow-xl" style={popover}>
        <div className="mb-1 text-xs font-semibold text-(--color-point)">
          {index + 1} / {steps.length}
        </div>
        <div className="mb-1 text-base font-semibold text-gray-900">{step.title}</div>
        <div className="mb-4 text-sm leading-6 text-gray-600">{step.body}</div>
        <div className="flex items-center justify-between">
          <button type="button" className="text-xs font-medium text-gray-400" onClick={finish}>
            건너뛰기
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" className="btn-outline h-8 px-3 text-xs" onClick={() => setIndex(index - 1)}>
                이전
              </button>
            )}
            <button type="button" className="btn-primary h-8 px-3 text-xs" onClick={() => (index === steps.length - 1 ? finish() : setIndex(index + 1))}>
              {index === steps.length - 1 ? '시작하기' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
