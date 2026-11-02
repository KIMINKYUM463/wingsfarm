import { GRADE_META, perMonth, type Overview, type ReportPeriod } from "@/lib/adInsights";
import { num, won, wonShort } from "@/lib/format";
import { RoasMeter, profitText, rateText, roasText } from "./parts";

const GRADE_STYLE = {
  A: "from-emerald-300 to-emerald-500 shadow-[0_0_40px_rgba(52,211,153,0.45)]",
  B: "from-teal-200 to-emerald-400 shadow-[0_0_32px_rgba(45,212,191,0.35)]",
  C: "from-amber-200 to-amber-400 shadow-[0_0_32px_rgba(251,191,36,0.4)]",
  D: "from-rose-300 to-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.45)]",
} as const;

const dotted = (iso: string) => iso.replaceAll("-", ".");

interface Props {
  overview: Overview;
  period: ReportPeriod | null;
  fileName: string;
  window: string | null;
  withVat: boolean;
}

/** 리포트 첫 화면: 등급 · ROAS vs 손익분기 · 돈 · 퍼널 */
export function AdHero({ overview, period, fileName, window, withVat }: Props) {
  const { metrics: m, breakEven, profit, grade } = overview;
  const monthlyProfit = profit === null ? null : perMonth(profit, period);
  const orderNet = overview.grossPerOrder !== null && overview.cpa !== null ? overview.grossPerOrder - overview.cpa : null;
  const funnel = [
    { label: "노출", value: m.impressions, note: null },
    { label: "클릭", value: m.clicks, note: `클릭률 ${rateText(m.ctr, 2)}` },
    { label: "주문", value: m.orders, note: `전환율 ${rateText(m.cvr)}` },
  ];

  return (
    <section className="relative animate-fade-up overflow-hidden rounded-3xl bg-[#07140f] p-7 text-white shadow-2xl md:p-9">
      <div className="pointer-events-none absolute -right-28 -top-28 size-96 animate-float rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 left-1/4 size-96 animate-float rounded-full bg-amber-400/10 blur-3xl [animation-delay:-7s]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[48px_48px]" />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-amber-300/80">Wingsfarm AI Ad Report</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">쿠팡 광고 정밀 분석</h2>
            <p className="mt-1.5 text-sm text-white/50">
              {period ? `${dotted(period.from)} – ${dotted(period.to)} · ${period.days}일` : "기간 정보 없음"} · 전환 {window ?? "보고서 기본"} 기준 · 광고비 {withVat ? "부가세 포함" : "부가세 별도"}
            </p>
          </div>
          <div className="flex max-w-md flex-wrap justify-end gap-1.5">
            {[...overview.adTypes, ...overview.campaigns].slice(0, 4).map((label) => (
              <span key={label} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur">
                {label}
              </span>
            ))}
            <span className="max-w-60 truncate rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/40" title={fileName}>
              {fileName}
            </span>
          </div>
        </div>

        <div className="mt-8 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <div className="flex items-center gap-6">
            {grade && (
              <div className={`flex size-24 shrink-0 flex-col items-center justify-center rounded-full bg-linear-to-br text-[#07140f] ${GRADE_STYLE[grade]}`}>
                <span className="text-5xl font-black leading-none">{grade}</span>
                <span className="mt-1 text-[10px] font-bold tracking-wider">등급</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/50">광고 수익률 (ROAS)</p>
              <p className="animate-shimmer bg-linear-to-r from-white via-amber-200 to-white bg-size-[200%_100%] bg-clip-text text-6xl font-black tracking-tight text-transparent tabular-nums md:text-7xl">
                {roasText(m.roas)}
              </p>
              <div className="mt-3 max-w-sm">
                <RoasMeter roas={m.roas} breakEven={breakEven} dark />
                <p className="mt-2 text-xs text-white/50">
                  <span className="text-amber-300">│</span> 손익분기 {roasText(breakEven)}
                  {m.roas !== null && breakEven ? ` · ${(m.roas / breakEven).toFixed(1)}배` : ""}
                </p>
              </div>
              {grade && (
                <p className="mt-3 text-sm text-white/80">
                  <b className="text-white">{GRADE_META[grade].label}</b> — {GRADE_META[grade].hint}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <HeroTile label="광고비" value={wonShort(m.cost)} hint={period ? `하루 평균 ${won(m.cost / period.days)}` : won(m.cost)} />
            <HeroTile label="광고 매출" value={wonShort(m.revenue)} hint={`주문 ${num(m.orders)}건 · 객단가 ${overview.aov === null ? "-" : won(overview.aov)}`} />
            <HeroTile
              label="광고로 남긴 돈 (추정)"
              value={profitText(profit)}
              hint={monthlyProfit === null ? "광고 매출 × 광고 전 이익률 − 광고비" : `한 달 환산 ${profitText(monthlyProfit)}`}
              accent={profit === null ? undefined : profit >= 0 ? "good" : "loss"}
            />
            <HeroTile
              label="주문 1건의 손익"
              value={orderNet === null ? "-" : `${orderNet >= 0 ? "+" : "−"}${won(Math.abs(orderNet))}`}
              hint={overview.cpa === null ? "-" : `광고비 ${won(overview.cpa)} 써서 이익 ${won(overview.grossPerOrder ?? 0)}`}
              accent={orderNet === null ? undefined : orderNet >= 0 ? "good" : "loss"}
            />
          </div>
        </div>

        <div className="mt-8 grid gap-2 sm:grid-cols-3">
          {funnel.map((step, i) => (
            <div key={step.label} className="relative rounded-2xl border border-white/10 bg-white/4 px-4 py-3 backdrop-blur">
              <p className="text-[11px] font-medium uppercase tracking-widest text-white/40">
                {i + 1}. {step.label}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{num(step.value)}</p>
              {step.note && <p className="text-xs text-emerald-300/80">{step.note}</p>}
              {i < funnel.length - 1 && <span className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-white/30 sm:block">›</span>}
            </div>
          ))}
        </div>
        {overview.unitsPerOrder !== null && (
          <p className="mt-3 text-xs text-white/40">
            주문 1건에 평균 {overview.unitsPerOrder.toFixed(2)}개 · 클릭당 비용 {m.cpc === null ? "-" : won(m.cpc)}
          </p>
        )}
      </div>
    </section>
  );
}

function HeroTile({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: "good" | "loss" }) {
  const accentClass = accent === "good" ? "text-emerald-300" : accent === "loss" ? "text-rose-300" : "text-white";
  return (
    <div className={`rounded-2xl border p-4 backdrop-blur ${accent ? "border-amber-300/20 bg-amber-300/6" : "border-white/10 bg-white/5"}`}>
      <p className="text-xs text-white/50">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${accentClass}`}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-white/40" title={hint}>
        {hint}
      </p>
    </div>
  );
}
