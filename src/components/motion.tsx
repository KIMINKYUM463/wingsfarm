"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/** 목록 항목이 순서대로 떠오르도록 index별 지연시간을 준다 */
export const stagger = (index: number, baseMs = 0, stepMs = 70): CSSProperties => ({
  animationDelay: `${baseMs + index * stepMs}ms`,
});

/** 숫자가 이전 값에서 새 값까지 부드럽게 올라가는 카운터 */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  duration = 1000,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = reduceMotion ? 1 : Math.min(1, (now - start) / duration);
      const current = from + (value - from) * (1 - (1 - t) ** 3);
      fromRef.current = current;
      setDisplay(current);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className="tabular-nums">{format(display)}</span>;
}
