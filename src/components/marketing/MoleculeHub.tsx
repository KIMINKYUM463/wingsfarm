"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MARKETING_FORMAT_META, MARKETING_FORMATS, type MarketingFormat } from "@/lib/marketingAi";

type NodePos = { id: MarketingFormat; restX: number; restY: number; x: number; y: number; phase: number };

const BONDS: [MarketingFormat, MarketingFormat][] = [
  ["shorts", "threads"],
  ["threads", "carousel"],
  ["carousel", "blog"],
  ["blog", "detail"],
  ["detail", "review"],
  ["review", "chat"],
  ["chat", "live"],
  ["live", "ads"],
  ["ads", "shorts"],
  ["shorts", "detail"],
  ["threads", "live"],
  ["carousel", "ads"],
  ["blog", "chat"],
];

const CENTER = { x: 50, y: 50 };
/** 원형 배치 (9개) */
const LAYOUT: Record<MarketingFormat, { x: number; y: number; phase: number }> = Object.fromEntries(
  MARKETING_FORMATS.map((id, i) => {
    const angle = (Math.PI * 2 * i) / MARKETING_FORMATS.length - Math.PI / 2;
    const r = 34;
    return [id, { x: 50 + Math.cos(angle) * r, y: 50 + Math.sin(angle) * r, phase: i * 0.7 }];
  }),
) as Record<MarketingFormat, { x: number; y: number; phase: number }>;

const INITIAL: NodePos[] = MARKETING_FORMATS.map((id) => {
  const L = LAYOUT[id];
  return { id, restX: L.x, restY: L.y, x: CENTER.x, y: CENTER.y, phase: L.phase };
});

/** ease-out: 시작이 빠르고 끝에서 감속 — 펼침이 즉각적으로 느껴짐 */
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type HubPhase = "collapsed" | "expanding" | "expanded" | "collapsing";

export function MoleculeHub({ onPick }: { onPick: (f: MarketingFormat) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<NodePos[]>(INITIAL);
  // 도구 9개가 첫 화면에 바로 보이도록 진입하자마자 펼친다 (가운데 버튼으로 접기 가능)
  const [phase, setPhase] = useState<HubPhase>("expanding");
  /** 0=접힘(중앙), 1=완전 펼침 */
  const [spread, setSpread] = useState(0);
  const dragRef = useRef<{ id: MarketingFormat; ox: number; oy: number; startX: number; startY: number } | null>(null);
  const spreadRef = useRef(0);

  useEffect(() => {
    spreadRef.current = spread;
  }, [spread]);

  /** 펼침/접힘 진행도 애니메이션 */
  useEffect(() => {
    if (phase !== "expanding" && phase !== "collapsing") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const done = phase === "expanding" ? 1 : 0;
      const snap = requestAnimationFrame(() => {
        setSpread(done);
        setPhase(done === 1 ? "expanded" : "collapsed");
        setNodes((prev) =>
          prev.map((n) => {
            const L = LAYOUT[n.id];
            return done === 1
              ? { ...n, x: L.x, y: L.y, restX: L.x, restY: L.y }
              : { ...n, x: CENTER.x, y: CENTER.y, restX: L.x, restY: L.y };
          }),
        );
      });
      return () => cancelAnimationFrame(snap);
    }

    const from = spreadRef.current;
    const to = phase === "expanding" ? 1 : 0;
    const duration = phase === "expanding" ? 720 : 420;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const raw = clamp01((now - start) / duration);
      const t = easeOut(raw);
      const s = lerp(from, to, t);
      setSpread(s);

      // 노드마다 살짝 시차를 둬서 ‘한 번에 튀지 않고’ 부채처럼 펼침
      setNodes((prev) =>
        prev.map((n, i) => {
          const stagger = i / MARKETING_FORMATS.length;
          const local = easeOut(clamp01((s - stagger * 0.28) / 0.72));
          const L = LAYOUT[n.id];
          return {
            ...n,
            restX: L.x,
            restY: L.y,
            x: lerp(CENTER.x, L.x, local),
            y: lerp(CENTER.y, L.y, local),
          };
        }),
      );

      if (raw < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setPhase(to === 1 ? "expanded" : "collapsed");
        if (to === 0) {
          setNodes((prev) =>
            prev.map((n) => ({
              ...n,
              x: CENTER.x,
              y: CENTER.y,
              restX: LAYOUT[n.id].x,
              restY: LAYOUT[n.id].y,
            })),
          );
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  /** 펼친 뒤 살짝 떠다니는 idle 모션 */
  useEffect(() => {
    if (phase !== "expanded") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    let t = 0;
    const loop = () => {
      t += 0.016;
      setNodes((prev) => {
        const drag = dragRef.current?.id;
        return prev.map((n) => {
          if (drag === n.id) return n;
          return {
            ...n,
            x: n.restX + Math.sin(t * 0.55 + n.phase) * 2.4,
            y: n.restY + Math.cos(t * 0.42 + n.phase * 0.7) * 2.1,
          };
        });
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const toPct = (clientX: number, clientY: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const onPointerDown = (e: ReactPointerEvent, id: MarketingFormat) => {
    if (phase !== "expanded") return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const node = nodes.find((n) => n.id === id)!;
    const p = toPct(e.clientX, e.clientY);
    dragRef.current = { id, ox: p.x - node.x, oy: p.y - node.y, startX: e.clientX, startY: e.clientY };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || phase !== "expanded") return;
    const p = toPct(e.clientX, e.clientY);
    const x = Math.min(92, Math.max(8, p.x - drag.ox));
    const y = Math.min(90, Math.max(10, p.y - drag.oy));
    setNodes((prev) => prev.map((n) => (n.id === drag.id ? { ...n, x, y, restX: x, restY: y } : n)));
  };

  const onPointerUp = (e: ReactPointerEvent, id: MarketingFormat) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (phase !== "expanded") return;
    if (!drag || drag.id !== id) return;
    const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (dist < 8) onPick(id);
  };

  const toggleHub = () => {
    if (phase === "collapsed") setPhase("expanding");
    else if (phase === "expanded") setPhase("collapsing");
  };

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<MarketingFormat, NodePos>;
  const isOpen = phase === "expanded" || phase === "expanding";
  const bondOpacity = clamp01((spread - 0.25) / 0.55);
  const hubScale = lerp(1, 0.72, easeOut(spread));
  const hintOpacity = clamp01((spread - 0.55) / 0.45);

  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <div
        ref={wrapRef}
        className="relative h-[560px] w-full touch-none sm:h-[640px]"
        aria-expanded={isOpen}
      >
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="bond" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.32" />
            </linearGradient>
          </defs>
          {BONDS.map(([a, b]) => {
            const A = byId[a];
            const B = byId[b];
            return (
              <g key={`${a}-${b}`} opacity={bondOpacity}>
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="url(#bond)" strokeWidth="0.35" />
                <circle cx={(A.x + B.x) / 2} cy={(A.y + B.y) / 2} r="0.5" fill="#34d399" opacity="0.7" />
              </g>
            );
          })}
        </svg>

        {/* 중앙 핵 — 접힌 상태의 CTA / 펼친 뒤엔 접기 버튼 */}
        <button
          type="button"
          onClick={toggleHub}
          disabled={phase === "expanding" || phase === "collapsing"}
          className="absolute left-1/2 top-1/2 z-20 flex flex-col items-center gap-2 outline-none transition-opacity duration-200 ease-out active:scale-[0.97] disabled:cursor-wait"
          style={{ transform: `translate(-50%, -50%) scale(${hubScale})` }}
          aria-label={isOpen ? "마케팅 도구 접기" : "윙스의 마케팅도구 펼치기"}
        >
          <span
            className={`relative grid place-items-center rounded-full bg-linear-to-br from-emerald-600 via-teal-600 to-amber-500 text-white shadow-[0_18px_50px_-12px_rgba(16,185,129,0.55)] ring-4 ring-white/80 transition-[width,height,box-shadow] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
              isOpen ? "size-16 sm:size-20" : "size-28 sm:size-36"
            }`}
          >
            <span
              className={`pointer-events-none absolute inset-0 rounded-full bg-white/20 ${
                phase === "collapsed" ? "animate-ping opacity-40" : "opacity-0"
              }`}
              style={{ animationDuration: "2.4s" }}
              aria-hidden
            />
            <span className={`relative drop-shadow-sm transition-all duration-300 ${isOpen ? "text-2xl sm:text-3xl" : "text-4xl sm:text-5xl"}`} aria-hidden>
              {isOpen ? "✦" : "📣"}
            </span>
          </span>
          <span
            className={`text-center transition-[opacity,transform] duration-300 ease-out ${
              isOpen ? "translate-y-0 opacity-90" : "translate-y-0 opacity-100"
            }`}
          >
            <span className={`block font-bold tracking-tight text-stone-900 ${isOpen ? "text-[11px] sm:text-xs" : "text-sm sm:text-base"}`}>
              {isOpen ? "접기" : "윙스의 마케팅도구"}
            </span>
            {!isOpen && (
              <span className="mt-0.5 block text-[11px] font-medium text-emerald-700/80 sm:text-xs">눌러서 펼치기</span>
            )}
          </span>
        </button>

        {nodes.map((n, i) => {
          const meta = MARKETING_FORMAT_META[n.id];
          const stagger = i / MARKETING_FORMATS.length;
          const local = easeOut(clamp01((spread - stagger * 0.28) / 0.72));
          const visible = local > 0.02;
          const nodeScale = lerp(0.35, 1, local);
          return (
            <button
              key={n.id}
              type="button"
              tabIndex={phase === "expanded" ? 0 : -1}
              aria-hidden={!visible}
              disabled={phase !== "expanded"}
              onPointerDown={(e) => onPointerDown(e, n.id)}
              onPointerMove={onPointerMove}
              onPointerUp={(e) => onPointerUp(e, n.id)}
              onPointerCancel={(e) => onPointerUp(e, n.id)}
              className={`group absolute z-10 flex w-24 flex-col items-center gap-1.5 outline-none ${
                phase === "expanded" ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
              }`}
              style={{
                left: `${n.x}%`,
                top: `${n.y}%`,
                opacity: local,
                transform: `translate(-50%, -50%) scale(${nodeScale})`,
                willChange: phase === "expanding" || phase === "collapsing" ? "transform, opacity" : undefined,
              }}
            >
              <span
                className={`grid size-14 place-items-center rounded-full bg-linear-to-br ${meta.accent} text-2xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.35)] ring-4 ring-white/70 transition-[transform] duration-200 ease-out group-hover:scale-110 group-active:scale-[0.97] sm:size-24 sm:text-4xl`}
              >
                <span className="drop-shadow-sm" aria-hidden>
                  {meta.icon}
                </span>
              </span>
              <span className="pointer-events-none text-center">
                <span className="block text-xs font-bold text-stone-900 group-hover:text-emerald-800 sm:text-sm">{meta.title}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p
        className="pointer-events-none -mt-2 text-center text-xs text-stone-400 transition-opacity duration-300 ease-out"
        style={{ opacity: hintOpacity }}
        aria-hidden={hintOpacity < 0.2}
      >
        원을 드래그해서 움직일 수 있어요. 클릭하면 스튜디오가 열립니다.
      </p>
    </div>
  );
}
