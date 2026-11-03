import type { ReactNode } from "react";
import { GRADE_META, perMonth, type Grade, type Overview, type ReportPeriod } from "@/lib/adInsights";
import { num, won, wonShort } from "@/lib/format";
import { RoasMeter, Tag, dotted, profitText, rateText, roasText } from "./parts";

const GRADE_TONE: Record<Grade, "good" | "info" | "warn" | "loss"> = {
  A: "good",
  B: "info",
  C: "warn",
  D: "loss",
};
const VALUE_TONE = {
  good: "text-emerald-600",
  loss: "text-rose-600",
  default: "text-stone-900",
} as const;

interface Props {
  overview: Overview;
  period: ReportPeriod | null;
  fileName: string;
  window: string | null;
  withVat: boolean;
  /** 손익분기·부가세 설정 */
  settings: ReactNode;
}

const toneOf = (value: number | null) => (value === null ? "default" : value >= 0 ? "good" : "loss");
const signedWon = (value: number) => `${value >= 0 ? "+" : "−"}${won(Math.abs(value))}`;

function Cell({
  label,
  value,
  hint,
  tone = "default",
  className = "",
  children,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: keyof typeof VALUE_TONE;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`px-5 py-3.5 ${className}`}>
      <p className="text-[11px] font-medium text-stone-500">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tracking-tight tabular-nums ${VALUE_TONE[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-stone-400">{hint}</p>}
      {children}
    </div>
  );
}

/** 보고서 정보·핵심 지표·퍼널을 한 패널에 */
export function AdSummary({ overview, period, fileName, window, withVat, settings }: Props) {
  const { metrics: m, breakEven, profit, grade } = overview;
  const monthlyProfit = profit === null ? null : perMonth(profit, period);
  const orderNet = overview.grossPerOrder !== null && overview.cpa !== null ? overview.grossPerOrder - overview.cpa : null;
  const meta = [
    period ? `${dotted(period.from)} – ${dotted(period.to)} (${period.days}일)` : "기간 정보 없음",
    `전환 ${window ?? "보고서 기본"} 기준`,
    `광고비 부가세 ${withVat ? "포함" : "별도"}`,
    overview.campaigns.length ? `캠페인 ${overview.campaigns.length}개` : null,
  ].filter(Boolean);
  const funnel = [
    { label: "노출", value: num(m.impressions), rate: null },
    { label: "클릭", value: num(m.clicks), rate: `클릭률 ${rateText(m.ctr, 2)}` },
    { label: "주문", value: num(m.orders), rate: `전환율 ${rateText(m.cvr)}` },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-stone-100 px-5 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-800" title={fileName}>
            {fileName}
          </p>
          <p className="text-xs text-stone-500">{meta.join(" · ")}</p>
        </div>
        {settings}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        <Cell label="ROAS" value={roasText(m.roas)} className="col-span-2 border-b border-stone-100 sm:col-span-3 xl:col-span-2 xl:border-b-0 xl:border-r">
          <div className="mt-2">
            <RoasMeter roas={m.roas} breakEven={breakEven} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400">
            {grade && (
              <Tag tone={GRADE_TONE[grade]}>
                {grade} · {GRADE_META[grade].label}
              </Tag>
            )}
            <span>
              손익분기 {roasText(breakEven)}
              {m.roas !== null && breakEven ? ` · ${(m.roas / breakEven).toFixed(1)}배` : ""}
            </span>
          </div>
        </Cell>
        <Cell
          label="남긴 돈"
          value={profitText(profit)}
          tone={toneOf(profit)}
          hint={monthlyProfit === null ? "매출 × 광고 전 이익률 − 광고비" : `한 달 환산 ${profitText(monthlyProfit)}`}
          className="border-b border-l border-stone-100 sm:border-l-0 xl:border-b-0 xl:border-l"
        />
        <Cell label="광고비" value={wonShort(m.cost)} hint={period ? `하루 ${won(m.cost / period.days)}` : won(m.cost)} className="border-b border-stone-100 sm:border-l xl:border-b-0" />
        <Cell label="광고 매출" value={wonShort(m.revenue)} hint={`객단가 ${overview.aov === null ? "-" : won(overview.aov)}`} className="border-b border-l border-stone-100 xl:border-b-0" />
        <Cell
          label="주문 1건 손익"
          value={orderNet === null ? "-" : signedWon(orderNet)}
          tone={toneOf(orderNet)}
          hint={overview.cpa === null ? undefined : `주문당 광고비 ${won(overview.cpa)}`}
          className="border-l border-stone-100"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-stone-100 px-5 py-2 text-[13px]">
        {funnel.map((step, i) => (
          <span key={step.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-stone-300">→</span>}
            <span className="text-stone-500">{step.label}</span>
            <b className="font-semibold tabular-nums text-stone-900">{step.value}</b>
            {step.rate && <span className="text-[11px] tabular-nums text-stone-400">{step.rate}</span>}
          </span>
        ))}
        <span className="ml-auto text-[11px] tabular-nums text-stone-400">
          클릭당 {m.cpc === null ? "-" : won(m.cpc)}
          {overview.unitsPerOrder !== null && ` · 주문당 ${overview.unitsPerOrder.toFixed(2)}개`}
        </span>
      </div>
    </div>
  );
}
