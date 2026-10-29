import { useCallback, useMemo, useRef, useState } from "react";

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

const COALESCE_MS = 1000;

/**
 * 되돌리기/다시하기가 되는 상태.
 * - 같은 coalesceKey로 1초 안에 연달아 바꾸면(글자 입력) 한 단계로 묶는다.
 * - patchAll은 기록을 남기지 않고 과거·미래 스냅샷까지 함께 고친다 (늦게 도착한 AI 사진 등).
 */
export function useHistoryState<T>(initial: T, limit = 50) {
  const [history, setHistory] = useState<History<T>>({ past: [], present: initial, future: [] });
  const last = useRef<{ key: string; at: number } | null>(null);

  const set = useCallback(
    (updater: (prev: T) => T, coalesceKey?: string) => {
      const now = Date.now();
      const merge = !!coalesceKey && last.current?.key === coalesceKey && now - last.current.at < COALESCE_MS;
      last.current = coalesceKey ? { key: coalesceKey, at: now } : null;
      setHistory((h) => {
        const next = updater(h.present);
        if (Object.is(next, h.present)) return h;
        return { past: merge ? h.past : [...h.past, h.present].slice(-limit), present: next, future: [] };
      });
    },
    [limit],
  );

  const patchAll = useCallback((fn: (value: T) => T) => {
    setHistory((h) => ({ past: h.past.map(fn), present: fn(h.present), future: h.future.map(fn) }));
  }, []);

  const reset = useCallback((value: T) => {
    last.current = null;
    setHistory({ past: [], present: value, future: [] });
  }, []);

  const undo = useCallback(() => {
    last.current = null;
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  }, []);

  const redo = useCallback(() => {
    last.current = null;
    setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  }, []);

  return useMemo(
    () => ({ value: history.present, set, patchAll, reset, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 }),
    [history, set, patchAll, reset, undo, redo],
  );
}
