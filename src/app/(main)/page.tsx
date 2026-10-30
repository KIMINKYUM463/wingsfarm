"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SeasonCategory } from "@/types";
import { AreaChart, Sparkline } from "@/components/charts";
import { KeywordDetail } from "@/components/KeywordDetail";
import { AiTeam } from "@/components/dashboard/AiTeam";
import { TodayOps } from "@/components/dashboard/TodayOps";
import { CountUp, stagger } from "@/components/motion";
import { growthText } from "@/lib/format";
import {
  MIN_SCORE,
  RECENT_WEEKS,
  currentTrend,
  marketSeries,
  sourcingOutlook,
  weekLabel,
  type CurrentTrend,
  type SourcingOutlook,
  type TrendItem,
  type TrendsResponse,
} from "@/lib/trends";
import { PREP_LEAD_DAYS } from "@/lib/season";

type RankedItem = TrendItem & CurrentTrend;
type SelectHandler = (name: string) => void;

const HORIZONS = [
  { weeks: 4, label: "1개월" },
  { weeks: 8, label: "2개월" },
];

type Filter = "전체" | SeasonCategory;
const FILTERS: Filter[] = ["전체", "과일", "채소", "수산", "축산"];

const formatPeriod = (periods: string[]) => {
  if (periods.length === 0) return "";
  const fmt = (s: string) => s.slice(5).replace("-", ".");
  return `${fmt(periods[0])} – ${fmt(periods.at(-1)!)}`;
};

function useTrends() {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/trends")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setData(json);
      })
      .catch((err: Error) => setError(err.message || "트렌드를 불러오지 못했습니다."));
  }, []);
  return { data, error };
}

export default function DashboardPage() {
  const { data, error } = useTrends();
  const [filter, setFilter] = useState<Filter>("전체");
  const [horizon, setHorizon] = useState(HORIZONS[1].weeks);
  const [selected, setSelected] = useState<string | null>(null);
  const closeDetail = useCallback(() => setSelected(null), []);
  const today = useMemo(() => new Date(), []);
  const market = useMemo(() => marketSeries(data?.items ?? []), [data]);

  const view = useMemo(() => {
    const items: RankedItem[] = (data?.items ?? [])
      .filter((i) => filter === "전체" || i.category === filter)
      .map((i) => ({ ...i, ...currentTrend(i) }));
    const ranked = items.filter((i) => i.score >= MIN_SCORE);
    const sourcing = items
      .map((item) => ({ item, outlook: data ? sourcingOutlook(item, market, data.periods, today, horizon) : null }))
      .filter((s): s is { item: RankedItem; outlook: SourcingOutlook } => s.outlook !== null && s.outlook.lastYearScore >= MIN_SCORE && s.outlook.rise > 0)
      .sort((a, b) => b.outlook.rise - a.outlook.rise)
      .slice(0, 6);
    return {
      rising: [...ranked].sort((a, b) => b.growth - a.growth).slice(0, 5),
      popular: [...ranked].sort((a, b) => b.score - a.score).slice(0, 5),
      cooling: ranked.filter((i) => i.growth < -0.1).sort((a, b) => a.growth - b.growth).slice(0, 3),
      upcoming: items.filter((i) => !i.inSeason && i.daysUntilStart <= PREP_LEAD_DAYS + 30).sort((a, b) => a.daysUntilStart - b.daysUntilStart),
      inSeason: items.filter((i) => i.inSeason),
      sourcing,
    };
  }, [data, filter, horizon, today, market]);

  if (error) return <div className="rounded-2xl bg-rose-50 p-6 text-sm text-rose-700">{error}</div>;
  if (!data) return <DashboardSkeleton />;

  const live = data.source === "naver";
  const hero = view.rising[0];
  const selectedItem = data.items.find((i) => i.name === selected);

  return (
    <div className="space-y-6">
      <section className="relative animate-fade-up overflow-hidden rounded-3xl bg-[#07140f] p-8 text-white shadow-2xl md:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 animate-float rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-96 animate-float rounded-full bg-amber-400/10 blur-3xl [animation-delay:-7s]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[48px_48px]" />

        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.3em] text-amber-300/80">
                Wingsfarm AI Trend Report
                {live && (
                  <span className="flex items-center gap-1.5 tracking-normal text-emerald-300">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                    </span>
                    LIVE
                  </span>
                )}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">이번 주, 뭐가 뜨고 있을까</h1>
              <p className="mt-2 text-sm text-white/50">
                {live ? `네이버 쇼핑 식품 분야 검색 클릭 추이 · ${formatPeriod(data.periods.slice(-RECENT_WEEKS))} 주간` : "제철 캘린더 기준 · 실시간 검색 트렌드 미연결"}
              </p>
            </div>
            <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-sm transition-all duration-300 ${f === filter ? "bg-white font-semibold text-[#07140f] shadow-lg" : "text-white/60 hover:text-white"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {live && hero ? (
            <div key={hero.name} className="mt-10 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="animate-fade-up [animation-delay:150ms]">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-[#07140f] shadow-[0_0_24px_rgba(252,211,77,0.45)]">No.1 급상승</span>
                  <span className="text-sm text-white/50">{hero.category}</span>
                </div>
                <button type="button" onClick={() => setSelected(hero.name)} className="group mt-4 block text-left" title="분석 보기">
                  <span className="animate-shimmer bg-linear-to-r from-white via-amber-200 to-white bg-size-[200%_100%] bg-clip-text text-6xl font-black tracking-tight text-transparent md:text-7xl">
                    {hero.name}
                  </span>
                  <span className="ml-3 align-middle text-sm text-white/30 transition group-hover:text-amber-200">분석 보기 →</span>
                </button>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-emerald-300">
                    <CountUp value={hero.growth} format={growthText} duration={1400} />
                  </span>
                  <span className="text-sm text-white/40">직전 4주 대비</span>
                </div>
                <p className="mt-5 max-w-md border-l-2 border-amber-300/60 pl-4 text-sm leading-relaxed text-white/70">{hero.tip}</p>
              </div>
              <div className="animate-fade-up rounded-2xl border border-white/10 bg-white/3 p-4 backdrop-blur [animation-delay:300ms]">
                <div className="mb-2 flex justify-between text-xs text-white/40">
                  <span>최근 {RECENT_WEEKS}주 관심도</span>
                  <span>{hero.inSeason ? "지금 제철" : `시즌 D-${hero.daysUntilStart}`}</span>
                </div>
                <AreaChart values={hero.recent} height={200} color="#fcd34d" className="w-full" />
              </div>
            </div>
          ) : (
            <SeasonHero items={view.inSeason} onSelect={setSelected} />
          )}
        </div>
      </section>

      <AiTeam />

      <TodayOps />

      {!live &&
        (data.warning ? (
          <section className="animate-fade-up rounded-3xl border border-rose-200 bg-rose-50 p-6">
            <h2 className="font-bold text-rose-900">실시간 트렌드 연결 확인 필요</h2>
            <p className="mt-1 text-sm text-rose-800">{data.warning}</p>
            <p className="mt-2 text-xs text-rose-700/70">설정을 고친 뒤 몇 분 지나 새로고침하면 반영됩니다. 그동안은 제철 정보를 보여드립니다.</p>
          </section>
        ) : (
          <ConnectNaverNotice />
        ))}

      {live && <SourcingSection picks={view.sourcing} horizon={horizon} onHorizonChange={setHorizon} onSelect={setSelected} />}

      {live && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel index={2} title="급상승 TOP 5" subtitle="직전 4주 대비 최근 2주 검색 클릭 증가율">
            <ol className="divide-y divide-stone-100">
              {view.rising.map((item, i) => (
                <RankRow key={item.name} rank={i + 1} item={item} onSelect={setSelected}>
                  <Sparkline values={item.recent} />
                  <span className={`w-16 text-right text-sm font-bold ${item.growth >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    <CountUp value={item.growth} format={growthText} />
                  </span>
                </RankRow>
              ))}
            </ol>
          </Panel>

          <Panel index={3} title="가장 많이 찾는 TOP 5" subtitle="최근 2주 검색 클릭량 (1위 = 100)">
            <ol className="divide-y divide-stone-100">
              {view.popular.map((item, i) => {
                const relative = (item.score / view.popular[0].score) * 100;
                return (
                  <RankRow key={item.name} rank={i + 1} item={item} onSelect={setSelected}>
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full origin-left animate-grow rounded-full bg-linear-to-r from-emerald-400 to-emerald-700"
                        style={{ width: `${relative}%`, ...stagger(i, 200, 90) }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-semibold text-stone-700">
                      <CountUp value={relative} />
                    </span>
                  </RankRow>
                );
              })}
            </ol>
          </Panel>
        </div>
      )}

      <div className={`grid gap-6 ${live ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}>
        <Panel index={4} title="곧 시즌 오픈" subtitle={`시즌 ${PREP_LEAD_DAYS}일 전에 상세페이지를 올려야 검색 노출이 쌓입니다`}>
          {view.upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">60일 안에 시작하는 품목이 없습니다.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {view.upcoming.slice(0, 6).map((item, i) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelected(item.name)}
                  className="group animate-fade-up rounded-2xl border border-stone-200 bg-linear-to-br from-white to-stone-50 p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-xl"
                  style={stagger(i, 300)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-bold text-stone-900 transition group-hover:text-emerald-700">{item.name}</div>
                      <div className="text-xs text-stone-400">{item.category}</div>
                    </div>
                    <div className={`text-right ${item.daysUntilStart <= PREP_LEAD_DAYS ? "text-rose-600" : "text-amber-600"}`}>
                      <div className="text-2xl font-black">
                        D-<CountUp value={item.daysUntilStart} />
                      </div>
                      <div className="text-xs font-medium">{item.daysUntilStart <= PREP_LEAD_DAYS ? "지금 준비" : "준비 예정"}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-stone-500">{item.tip}</p>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {live && (
          <Panel index={5} title="관심 식는 중" subtitle="재고·광고비 정리를 검토할 품목">
            {view.cooling.length === 0 ? (
              <p className="py-6 text-center text-sm text-stone-400">눈에 띄게 하락한 품목이 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {view.cooling.map((item, i) => (
                  <li key={item.name} className="animate-fade-up" style={stagger(i, 400)}>
                    <button
                      type="button"
                      onClick={() => setSelected(item.name)}
                      className="flex w-full items-center justify-between rounded-xl bg-stone-50 px-4 py-3 text-left transition hover:bg-rose-50/60 hover:shadow-md"
                    >
                      <span className="font-semibold text-stone-800">{item.name}</span>
                      <span className="flex items-center gap-3">
                        <Sparkline values={item.recent} width={56} />
                        <span className="text-sm font-bold text-rose-500">
                          <CountUp value={item.growth} format={growthText} />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      {selectedItem && <KeywordDetail item={selectedItem} items={data.items} market={market} periods={data.periods} today={today} onClose={closeDetail} />}
    </div>
  );
}

function Panel({ index, title, subtitle, children }: { index: number; title: string; subtitle: string; children: ReactNode }) {
  return (
    <section
      className="animate-fade-up rounded-3xl border border-stone-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.08)]"
      style={stagger(index, 0, 100)}
    >
      <h2 className="text-lg font-bold tracking-tight text-stone-900">{title}</h2>
      <p className="mb-4 mt-0.5 text-xs text-stone-400">{subtitle}</p>
      {children}
    </section>
  );
}

function SourcingSection({
  picks,
  horizon,
  onHorizonChange,
  onSelect,
}: {
  picks: { item: RankedItem; outlook: SourcingOutlook }[];
  horizon: number;
  onHorizonChange: (weeks: number) => void;
  onSelect: SelectHandler;
}) {
  const horizonLabel = HORIZONS.find((h) => h.weeks === horizon)!.label;
  return (
    <section
      className="relative animate-fade-up overflow-hidden rounded-3xl border border-amber-200/60 bg-linear-to-br from-[#fffdf7] via-white to-emerald-50/40 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.08)] md:p-8"
      style={stagger(1, 0, 100)}
    >
      <div className="pointer-events-none absolute -right-32 -top-32 size-80 animate-float rounded-full bg-amber-200/30 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-amber-600/80">Sourcing Forecast</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">지금 소싱하면 좋은 품목</h2>
          <p className="mt-1 text-sm text-stone-500">
            작년 이맘때 이후 {horizonLabel} 동안 검색이 가장 크게 오른 품목입니다. 카드를 누르면 자세한 분석을 볼 수 있어요.
          </p>
        </div>
        <div className="relative flex rounded-full bg-stone-100 p-1">
          <span
            className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-stone-900 shadow transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(${HORIZONS.findIndex((h) => h.weeks === horizon) * 100}%)` }}
          />
          {HORIZONS.map((h) => (
            <button
              key={h.weeks}
              type="button"
              onClick={() => onHorizonChange(h.weeks)}
              className={`relative w-20 rounded-full py-1.5 text-sm font-medium transition-colors duration-300 ${horizon === h.weeks ? "text-amber-200" : "text-stone-500 hover:text-stone-800"}`}
            >
              +{h.label}
            </button>
          ))}
        </div>
      </div>

      {picks.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-400">작년 이 시기 이후 오른 품목이 없습니다.</p>
      ) : (
        <div className="relative mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {picks.map(({ item, outlook }, i) => (
            <SourcingCard key={item.name} index={i} item={item} outlook={outlook} onSelect={onSelect} />
          ))}
        </div>
      )}
      <p className="relative mt-4 text-xs text-stone-400">
        점선 = 작년 이맘때 · 곡선 = 작년 실제 검색 흐름 · &quot;올해 인기&quot;는 식품 전체 검색량 증감을 보정해 작년 같은 시기와 비교한 값입니다.
      </p>
    </section>
  );
}

function SourcingCard({ index, item, outlook, onSelect }: { index: number; item: RankedItem; outlook: SourcingOutlook; onSelect: SelectHandler }) {
  const rank = index + 1;
  const yoyUp = outlook.yoy >= 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.name)}
      className="group relative animate-fade-up overflow-hidden rounded-2xl border border-stone-200 bg-white/80 p-5 text-left backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-2xl"
      style={stagger(index, 250, 90)}
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/70 to-transparent opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className={`font-serif text-3xl italic ${rank <= 3 ? "text-amber-500" : "text-stone-300"}`}>{rank}</span>
          <div>
            <p className="text-lg font-bold text-stone-900 transition group-hover:text-emerald-700">{item.name}</p>
            <p className="text-xs text-stone-400">
              {item.category} · {item.inSeason ? "지금 제철" : `시즌 D-${item.daysUntilStart}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-emerald-600">
            <CountUp value={outlook.rise} format={growthText} />
          </p>
          <p className="text-xs text-stone-500">작년 평균 상승</p>
        </div>
      </div>

      <AreaChart values={outlook.window} markerIndex={outlook.nowIndex} nowIndex={outlook.nowIndex} height={90} color="#10b981" className="mt-3 w-full text-stone-500" />

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-amber-50/70 px-3 py-2">
          <dt className="text-amber-700/70">작년 피크</dt>
          <dd className="mt-0.5 font-semibold text-amber-900">
            {weekLabel(outlook.peakPeriod)} · {growthText(outlook.peakGain)}
          </dd>
        </div>
        <div className={`rounded-xl px-3 py-2 ${yoyUp ? "bg-emerald-50/70" : "bg-stone-100"}`}>
          <dt className={yoyUp ? "text-emerald-700/70" : "text-stone-500"}>올해 인기 vs 작년 이맘때</dt>
          <dd className={`mt-0.5 font-semibold ${yoyUp ? "text-emerald-800" : "text-stone-600"}`}>{growthText(outlook.yoy)}</dd>
        </div>
      </dl>
    </button>
  );
}

function RankRow({ rank, item, onSelect, children }: { rank: number; item: RankedItem; onSelect: SelectHandler; children: ReactNode }) {
  return (
    <li className="animate-fade-up" style={stagger(rank - 1, 200)}>
      <button
        type="button"
        onClick={() => onSelect(item.name)}
        className="group -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-2xl px-3 py-3 text-left transition duration-300 hover:bg-linear-to-r hover:from-amber-50/80 hover:to-transparent"
      >
        <span className={`w-7 text-center font-serif text-2xl italic transition group-hover:scale-110 ${rank <= 3 ? "text-amber-500" : "text-stone-300"}`}>{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-stone-900 transition group-hover:text-emerald-700">{item.name}</div>
          <div className="text-xs text-stone-400">
            {item.category} · {item.inSeason ? "제철" : `시즌 D-${item.daysUntilStart}`}
          </div>
        </div>
        {children}
        <span className="-ml-2 w-0 overflow-hidden text-stone-300 transition-all duration-300 group-hover:ml-0 group-hover:w-3 group-hover:text-amber-500">›</span>
      </button>
    </li>
  );
}

function SeasonHero({ items, onSelect }: { items: TrendItem[]; onSelect: SelectHandler }) {
  return (
    <div className="mt-10">
      <p className="text-sm text-white/50">지금 제철인 품목 · 눌러서 분석 보기</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {items.map((item, i) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onSelect(item.name)}
            className="animate-fade-up rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xl font-bold backdrop-blur transition hover:-translate-y-0.5 hover:border-amber-300/50 hover:bg-white/10"
            style={stagger(i, 150, 50)}
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConnectNaverNotice() {
  return (
    <section className="animate-fade-up rounded-3xl border border-amber-200 bg-linear-to-r from-amber-50 to-white p-6">
      <h2 className="font-bold text-stone-900">실시간 검색 트렌드 연결하기 (무료)</h2>
      <p className="mt-1 text-sm text-stone-600">
        네이버 쇼핑에서 사람들이 실제로 많이 찾는 품목·급상승 품목을 보려면 네이버 데이터랩 API 키가 필요합니다.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-stone-600">
        <li>
          <a href="https://developers.naver.com/apps/#/register" target="_blank" rel="noreferrer" className="text-emerald-700 underline">
            네이버 개발자센터
          </a>
          에서 애플리케이션 등록 → 사용 API에 <b>데이터랩(쇼핑인사이트)</b> 선택
        </li>
        <li>
          프로젝트 폴더 <code className="rounded bg-stone-100 px-1">.env.local</code>에 <code className="rounded bg-stone-100 px-1">NAVER_CLIENT_ID</code>,{" "}
          <code className="rounded bg-stone-100 px-1">NAVER_CLIENT_SECRET</code> 입력
        </li>
        <li>개발 서버 재시작</li>
      </ol>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="relative h-96 overflow-hidden rounded-3xl bg-[#07140f]">
        <div className="absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-white/5 to-transparent bg-size-[200%_100%]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-3xl bg-stone-200/60" />
        <div className="h-72 animate-pulse rounded-3xl bg-stone-200/60" />
      </div>
    </div>
  );
}
