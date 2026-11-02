import type { ReactNode } from "react";
import { num, percent, wonShort } from "@/lib/format";

export const roasText = (roas: number | null) => (roas === null ? "-" : `${num(roas)}%`);
export const rateText = (value: number | null, digits = 1) => (value === null ? "-" : percent(value, digits));
export const profitText = (value: number | null) => (value === null ? "-" : `${value >= 0 ? "+" : "−"}${wonShort(Math.abs(value))}`);

export const TONE_TEXT = { good: "text-emerald-600", loss: "text-rose-600", warn: "text-amber-600", info: "text-sky-600", default: "text-stone-900" } as const;
export const TONE_DOT = { good: "bg-emerald-500", loss: "bg-rose-500", warn: "bg-amber-500", info: "bg-sky-500" } as const;

export const profitTone = (value: number | null) => (value === null ? "default" : value >= 0 ? "good" : "loss");

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`animate-fade-up rounded-3xl border border-stone-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.12)] ${className}`}>{children}</section>;
}

export function SectionHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700/70">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-stone-900">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-stone-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** ROAS 막대 — 손익분기 위치에 눈금을 긋고, 넘으면 초록·못 넘으면 빨강 */
export function RoasMeter({ roas, breakEven, dark = false }: { roas: number | null; breakEven: number | null; dark?: boolean }) {
  if (roas === null || !breakEven) return null;
  const max = Math.max(breakEven * 2, roas) * 1.08;
  const ok = roas >= breakEven;
  return (
    <div className="relative">
      <div className={`h-2 overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-stone-100"}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${ok ? "bg-linear-to-r from-emerald-400 to-emerald-500" : "bg-linear-to-r from-rose-400 to-rose-500"}`}
          style={{ width: `${(roas / max) * 100}%` }}
        />
      </div>
      <div className="absolute -top-1 h-4 w-0.5 rounded-full bg-amber-400" style={{ left: `${(breakEven / max) * 100}%` }} title={`손익분기 ${num(breakEven)}%`} />
    </div>
  );
}

/** 0~1 비율 도넛 */
export function Ring({ value, size = 96, stroke = 10, color = "#10b981", track = "#f5f5f4", children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * Math.min(1, Math.max(0, value))} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** 작은 지표 칸 */
export function Metric({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: keyof typeof TONE_TEXT }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-stone-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold whitespace-nowrap tabular-nums ${TONE_TEXT[tone]}`}>{value}</p>
      {hint && <p className="text-[11px] text-stone-400">{hint}</p>}
    </div>
  );
}
