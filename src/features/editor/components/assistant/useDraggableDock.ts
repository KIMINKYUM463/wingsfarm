import { useEffect, useRef, useState, type PointerEvent } from 'react';

/** 화면 오른쪽·아래에서 떨어진 거리 — 창 크기가 바뀌어도 오른쪽 아래 기준을 지킨다 */
export interface DockOffset {
  right: number;
  bottom: number;
}

const MARGIN = 8;
/** 이만큼 움직여야 끌기로 본다 (그보다 적으면 클릭) */
const DRAG_THRESHOLD = 4;

const clamp = (offset: DockOffset, size: number): DockOffset => ({
  right: Math.min(Math.max(offset.right, MARGIN), window.innerWidth - size - MARGIN),
  bottom: Math.min(Math.max(offset.bottom, MARGIN), window.innerHeight - size - MARGIN),
});

function readOffset(key: string, fallback: DockOffset): DockOffset {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as DockOffset | null;
    return saved && Number.isFinite(saved.right) && Number.isFinite(saved.bottom) ? saved : fallback;
  } catch {
    return fallback;
  }
}

/**
 * 마우스로 끌어 옮길 수 있는 떠 있는 버튼 위치
 * - 끌지 않고 떼면 onClick, 끌었으면 놓은 자리를 저장한다
 */
export function useDraggableDock(storageKey: string, size: number, fallback: DockOffset, onClick: () => void) {
  const [offset, setOffset] = useState<DockOffset>(() => clamp(readOffset(storageKey, fallback), size));
  const drag = useRef<{ x: number; y: number; start: DockOffset; moved: boolean } | null>(null);

  useEffect(() => {
    const onResize = () => setOffset((current) => clamp(current, size));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [size]);

  /** 누른 자리에서 움직인 만큼 옮긴 위치 */
  const offsetAt = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current!;
    return clamp({ right: d.start.right - (e.clientX - d.x), bottom: d.start.bottom - (e.clientY - d.y) }, size);
  };

  const handlers = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      drag.current = { x: e.clientX, y: e.clientY, start: offset, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_THRESHOLD) return;
      d.moved = true;
      setOffset(offsetAt(e));
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d) return;
      if (!d.moved) {
        drag.current = null;
        return onClick();
      }
      const next = offsetAt(e);
      drag.current = null;
      setOffset(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
    },
  };

  return { offset, handlers };
}
