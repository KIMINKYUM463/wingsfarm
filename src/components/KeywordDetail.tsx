"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { AreaChart, CompareChart } from "@/components/charts";
import { CountUp, stagger } from "@/components/motion";
import { SEASON_ITEMS } from "@/lib/data/season";
import { AiInsightLauncher } from "@/components/keyword/AiInsightPanel";
import { AdCompetitionBadge, keywordHref, useKeywordReport, volumeText } from "@/components/keyword/shared";
import { growthText, percent } from "@/lib/format";
import { isGoldenKeyword } from "@/lib/keyword";
import {
  currentTrend,
  lastYearIndex,
  sourcingOutlook,
  sourcingVerdict,
  weekLabel,
  yearComparison,
  type TrendItem,
  type VerdictTone,
} from "@/lib/trends";

const TONE_CLASS: Record<VerdictTone, string> = {
  go: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/40",
  test: "bg-amber-300/15 text-amber-200 ring-amber-300/40",
  hold: "bg-white/10 text-white/80 ring-white/20",
  clear: "bg-rose-400/15 text-rose-300 ring-rose-400/40",
  unknown: "bg-white/10 text-white/70 ring-white/20",
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function KeywordDetail({
  item,
  items,
  market,
  periods,
  today,
  onClose,
}: {
  item: TrendItem;
  /** 인기 순위 계산용 전체 품목 */
  items: TrendItem[];
  market: number[];
  periods: string[];
  today: Date;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const meta = SEASON_ITEMS.find((s) => s.name === item.name)!;
  const hasData = item.series.length > 0;
  const current = currentTrend(item);
  const rank = [...items].sort((a, b) => currentTrend(b).score - currentTrend(a).score).findIndex((i) => i.name === item.name) + 1;
  const outlook1 = sourcingOutlook(item, market, periods, today, 4);
  const outlook2 = sourcingOutlook(item, market, periods, today, 8);
  const comparison = yearComparison(item, market, periods, today);
  const verdict = sourcingVerdict(outlook2);
  const lastYearIdx = lastYearIndex(periods, today);
  const currentMonth = today.getMonth() + 1;
  const keyword = meta.searchKeyword ?? item.name;
  const searchUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`;
  const aiContext = [
    `제철: ${meta.months.join("·")}월`,
    `소싱 판단: ${verdict.title} (${verdict.message})`,
    hasData && `최근 2주 클릭 증감(직전 4주 대비): ${growthText(current.growth)}`,
    outlook1 && `작년 대비(식품 전체 증감 보정): ${growthText(outlook1.yoy)}`,
    outlook1 && outlook2 && `작년 이맘때 이후 +1개월 ${growthText(outlook1.rise)}, +2개월 ${growthText(outlook2.rise)}`,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-[#07140f]/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${item.name} 분석`}
        className="max-h-[92vh] w-full max-w-3xl animate-pop-in overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="relative overflow-hidden bg-[#07140f] p-8 text-white">
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 animate-float rounded-full bg-emerald-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 size-64 animate-float rounded-full bg-amber-400/15 blur-3xl [animation-delay:-7s]" />
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-white/10 text-white/70 transition hover:rotate-90 hover:bg-white/20 hover:text-white"
          >
            ✕
          </button>

          <div className="relative">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-amber-300/80">Keyword Analysis</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1 text-white/70">{item.category}</span>
              <span className={`rounded-full px-3 py-1 ${item.inSeason ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-white/70"}`}>
                {item.inSeason ? "지금 제철" : `시즌 D-${item.daysUntilStart}`}
              </span>
            </div>
            <h2 className="mt-3 animate-shimmer bg-linear-to-r from-white via-amber-200 to-white bg-size-[200%_100%] bg-clip-text text-5xl font-black tracking-tight text-transparent">
              {item.name}
            </h2>
            <div className={`mt-5 animate-fade-up rounded-2xl p-4 ring-1 [animation-delay:150ms] ${TONE_CLASS[verdict.tone]}`}>
              <p className="text-sm font-bold">{verdict.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/75">{verdict.message}</p>
            </div>
            <div className="mt-4 animate-fade-up [animation-delay:250ms]">
              <AiInsightLauncher keyword={keyword} context={aiContext} />
            </div>
          </div>
        </header>

        <div className="space-y-6 p-6 md:p-8">
          {hasData && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat index={0} label="인기 순위" hint={`식품 ${items.length}개 품목 중`}>
                <CountUp value={rank} format={(n) => `${Math.round(n)}위`} />
              </Stat>
              <Stat index={1} label="최근 2주 증감" hint="직전 4주 대비" tone={current.growth}>
                <CountUp value={current.growth} format={growthText} />
              </Stat>
              <Stat index={2} label="올해 vs 작년" hint="식품 전체 증감 보정" tone={outlook1?.yoy}>
                {outlook1 ? <CountUp value={outlook1.yoy} format={growthText} /> : "–"}
              </Stat>
              <Stat index={3} label="작년 이후 흐름" hint="+1개월 / +2개월" tone={outlook2?.rise}>
                {outlook1 && outlook2 ? (
                  <span className="text-xl">
                    <CountUp value={outlook1.rise} format={growthText} /> <span className="text-stone-300">/</span> <CountUp value={outlook2.rise} format={growthText} />
                  </span>
                ) : (
                  "–"
                )}
              </Stat>
            </div>
          )}

          {comparison && (
            <Section index={4} title="작년 vs 올해 흐름" aside={outlook2 && `작년 피크 ${weekLabel(outlook2.peakPeriod)}`}>
              <div className="mb-3 flex gap-4 text-xs text-stone-500">
                <Legend className="border-t-2 border-dashed border-stone-400">작년</Legend>
                <Legend className="h-0.5 bg-emerald-500">올해 (식품 전체 증감 보정)</Legend>
              </div>
              <CompareChart {...comparison} className="w-full text-stone-500" />
              <div className="relative mt-2 h-4 text-[11px] text-stone-400">
                <span className="absolute left-0">{weekLabel(comparison.startPeriod)}</span>
                <span
                  className="absolute -translate-x-1/2 font-semibold text-stone-600"
                  style={{ left: `${(comparison.nowIndex / (comparison.lastYear.length - 1)) * 100}%` }}
                >
                  지금
                </span>
                <span className="absolute right-0">{weekLabel(comparison.endPeriod)}</span>
              </div>
            </Section>
          )}

          {hasData && (
            <Section index={5} title="최근 1년 흐름" aside="점선 = 작년 이맘때">
              <AreaChart values={item.series} markerIndex={lastYearIdx >= 0 ? lastYearIdx : undefined} height={120} color="#f59e0b" className="w-full text-stone-500" />
              <div className="mt-2 flex justify-between text-[11px] text-stone-400">
                <span>{weekLabel(periods[0])}</span>
                <span>{weekLabel(periods.at(-1)!)}</span>
              </div>
            </Section>
          )}

          <RelatedSection index={6} keyword={keyword} />

          <Section index={7} title="제철 달력">
            <div className="grid grid-cols-12 gap-1">
              {MONTHS.map((m, i) => {
                const active = meta.months.includes(m);
                return (
                  <div key={m} className="animate-fade-up text-center" style={stagger(i, 400, 30)}>
                    <div
                      className={`h-9 rounded-lg ${active ? "bg-linear-to-b from-emerald-400 to-emerald-600" : "bg-stone-100"} ${
                        m === currentMonth ? "ring-2 ring-amber-400 ring-offset-2" : ""
                      }`}
                    />
                    <span className={`mt-1 block text-[11px] ${m === currentMonth ? "font-bold text-amber-600" : "text-stone-400"}`}>{m}월</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 border-l-2 border-amber-400 pl-3 text-sm leading-relaxed text-stone-600">{item.tip}</p>
          </Section>

          <div className="flex flex-wrap gap-2">
            <a
              href={searchUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#07140f] px-5 py-2.5 text-sm font-medium text-amber-200 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              네이버 쇼핑에서 보기 ↗
            </a>
            <Link
              href={keywordHref(keyword)}
              className="rounded-full border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-medium text-amber-800 transition hover:-translate-y-0.5 hover:bg-amber-100"
            >
              키워드 정밀 분석
            </Link>
            <Link href="/margin" className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:-translate-y-0.5 hover:bg-stone-50">
              마진 계산하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const RELATED_PREVIEW = 12;

function RelatedSection({ index, keyword }: { index: number; keyword: string }) {
  const { data, loading } = useKeywordReport(keyword);
  const related = data?.related.slice(0, RELATED_PREVIEW) ?? [];

  return (
    <Section index={index} title="연관 키워드" aside={data && data.related.length > 0 ? "월간 검색수 순" : undefined}>
      {loading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="h-8 w-24 animate-pulse rounded-full bg-stone-100" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-sm text-stone-400">연관 키워드를 불러오지 못했습니다.</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
            <MiniMetric label="월간 검색수">{data.volume ? volumeText(data.volume.total) : "–"}</MiniMetric>
            <MiniMetric label="클릭률">{data.volume ? percent(data.volume.ctr, 2) : "–"}</MiniMetric>
            <MiniMetric label="광고 경쟁">
              <AdCompetitionBadge level={data.volume?.adCompetition} />
            </MiniMetric>
          </div>
          {related.length === 0 ? (
            <p className="text-sm text-stone-400">{data.notices[0]?.message ?? "연관 키워드가 없습니다."}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {related.map((k, i) => (
                <Link
                  key={k.keyword}
                  href={keywordHref(k.keyword)}
                  className="animate-fade-up rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:-translate-y-0.5 hover:border-amber-300 hover:text-stone-900 hover:shadow-md"
                  style={stagger(i, 0, 30)}
                >
                  {isGoldenKeyword(k) && <span className="mr-1 text-amber-500">★</span>}
                  {k.keyword}
                  <span className="ml-1.5 text-[11px] text-stone-400">{volumeText(k.volume.total)}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function MiniMetric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-stone-50 py-2">
      <p className="text-stone-400">{label}</p>
      <div className="mt-0.5 font-semibold text-stone-800">{children}</div>
    </div>
  );
}

function Stat({ index, label, hint, tone, children }: { index: number; label: string; hint: string; tone?: number; children: ReactNode }) {
  const color = tone === undefined ? "text-stone-900" : tone >= 0 ? "text-emerald-600" : "text-rose-500";
  return (
    <div className="animate-fade-up rounded-2xl border border-stone-200 bg-linear-to-br from-white to-stone-50 p-4" style={stagger(index, 150)}>
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{children}</p>
      <p className="mt-0.5 text-[11px] text-stone-400">{hint}</p>
    </div>
  );
}

function Section({ index, title, aside, children }: { index: number; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="animate-fade-up" style={stagger(index, 150)}>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-bold text-stone-900">{title}</h3>
        {aside && <span className="text-xs text-stone-400">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-5 ${className}`} />
      {children}
    </span>
  );
}
