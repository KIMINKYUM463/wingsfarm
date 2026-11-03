import type { ReactNode } from "react";
import { num, percent, wonShort } from "@/lib/format";

export const roasText = (roas: number | null) => (roas === null ? "-" : `${num(roas)}%`);
export const rateText = (value: number | null, digits = 1) => (value === null ? "-" : percent(value, digits));
export const profitText = (value: number | null) => (value === null ? "-" : `${value >= 0 ? "+" : "−"}${wonShort(Math.abs(value))}`);
/** "2026-11-03" → "2026.11.03" */
export const dotted = (iso: string) => iso.replaceAll("-", ".");

export const TONE_TEXT = {
  good: "text-emerald-600",
  loss: "text-rose-600",
  warn: "text-amber-600",
  info: "text-sky-600",
  default: "text-stone-900",
} as const;
export const TONE_DOT = {
  good: "bg-emerald-500",
  loss: "bg-rose-500",
  warn: "bg-amber-500",
  info: "bg-sky-500",
} as const;

export const profitTone = (value: number | null) => (value === null ? "default" : value >= 0 ? "good" : "loss");

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-stone-200 bg-white px-5 py-4 ${className}`}>{children}</section>;
}

export function SectionHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-stone-900">{title}</h2>
        {description && <p className="mt-0.5 max-w-3xl text-[13px] leading-relaxed text-stone-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** 작은 상태 표시 (색 점 + 글자) */
export function Tag({ tone, children }: { tone: keyof typeof TONE_DOT | "default"; children: ReactNode }) {
  const style = {
    good: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    loss: "bg-rose-50 text-rose-700 ring-rose-200/70",
    warn: "bg-amber-50 text-amber-700 ring-amber-200/70",
    info: "bg-sky-50 text-sky-700 ring-sky-200/70",
    default: "bg-stone-50 text-stone-600 ring-stone-200",
  }[tone];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ${style}`}>
      {tone !== "default" && <span className={`size-1.5 rounded-full ${TONE_DOT[tone]}`} />}
      {children}
    </span>
  );
}

/** ROAS 막대 — 손익분기 위치에 눈금을 긋고, 넘으면 초록·못 넘으면 빨강 */
export function RoasMeter({ roas, breakEven }: { roas: number | null; breakEven: number | null }) {
  if (roas === null || !breakEven) return null;
  const max = Math.max(breakEven * 2, roas) * 1.08;
  const ok = roas >= breakEven;
  return (
    <div className="relative">
      <div className="h-2 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${ok ? "bg-linear-to-r from-emerald-400 to-emerald-500" : "bg-linear-to-r from-rose-400 to-rose-500"}`}
          style={{ width: `${(roas / max) * 100}%` }}
        />
      </div>
      <div className="absolute -top-1 h-4 w-0.5 rounded-full bg-amber-400" style={{ left: `${(breakEven / max) * 100}%` }} title={`손익분기 ${num(breakEven)}%`} />
    </div>
  );
}

/** 분석 표 공통 — 테두리·머리글·숫자 열을 한곳에서 */
export function DataTable({ children, minWidth = "720px" }: { children: ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200">
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-stone-50 text-xs text-stone-500">{children}</thead>;
}

export const th = (align: "left" | "right" = "right") => `px-3 py-2 font-medium ${align === "left" ? "text-left" : "text-right"}`;
export const td = (extra = "") => `px-3 py-2 ${extra}`;

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
