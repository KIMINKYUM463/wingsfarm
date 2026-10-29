"use client";

import type { ReactNode } from "react";
import { AreaChart } from "@/components/charts";
import { CountUp, stagger } from "@/components/motion";
import { num, percent } from "@/lib/format";
import type { KeywordReport } from "@/lib/keyword";
import { weekLabel } from "@/lib/trends";
import { AiInsightLauncher } from "./AiInsightPanel";
import { RelatedKeywords } from "./RelatedKeywords";
import { TitleBuilder } from "./TitleBuilder";
import { AdCompetitionBadge, ApiNotices, Panel } from "./shared";

const peakIndex = (values: number[]) => values.indexOf(Math.max(...values));

export function KeywordReportView({ report, onAnalyze }: { report: KeywordReport; onAnalyze: (keyword: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex animate-fade-up flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">&lsquo;{report.keyword}&rsquo; 분석 결과</h2>
          <p className="mt-0.5 text-sm text-stone-500">AI가 데이터를 읽고 후킹 포인트·상품명·판매 타이밍까지 정리해 드려요</p>
        </div>
        {(report.volume || report.trend) && <AiInsightLauncher keyword={report.keyword} />}
      </div>
      <SummaryCards report={report} />
      <ApiNotices notices={report.notices} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel index={1} title="검색 추이" subtitle="네이버 쇼핑 식품 분야 · 최근 1년 주간 클릭 (최고 주 = 100)">
          {report.trend ? <TrendChart trend={report.trend} /> : <Missing />}
        </Panel>
        <Panel index={2} title="누가 찾나요?" subtitle="최근 1년 쇼핑 클릭 비중">
          {report.audience ? <Audience audience={report.audience} /> : <Missing />}
        </Panel>
      </div>

      <RelatedKeywords report={report} onAnalyze={onAnalyze} />

      <Panel index={4} title="상품명 조합" subtitle="연관 키워드에서 뽑은 수식어 · 숫자는 그 수식어가 붙은 키워드의 월간 검색수 합계">
        {report.titleWords.length > 0 ? (
          <TitleBuilder keyword={report.keyword} words={report.titleWords} />
        ) : (
          <p className="py-8 text-center text-sm text-stone-400">
            {report.volume ? "이 키워드를 포함한 연관 키워드가 없어 조합할 수식어가 없습니다." : "검색광고 API를 연결하면 연관 키워드 기반으로 상품명을 조합할 수 있어요."}
          </p>
        )}
      </Panel>
    </div>
  );
}

function SummaryCards({ report }: { report: KeywordReport }) {
  const { volume, trend } = report;
  const peak = trend ? trend.periods[peakIndex(trend.values)] : null;
  const needsAd = "검색광고 API 필요";
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Metric index={0} label="월간 검색수" hint={volume ? `PC ${num(volume.pc)} · 모바일 ${num(volume.mobile)}` : needsAd}>
        {volume && <CountUp value={volume.total} format={num} />}
      </Metric>
      <Metric index={1} label="모바일 비중" hint="검색 기준">
        {volume && volume.total > 0 && <CountUp value={volume.mobile / volume.total} format={(n) => percent(n, 0)} />}
      </Metric>
      <Metric index={2} label="월평균 클릭" hint={volume ? "광고 영역 클릭 기준" : needsAd}>
        {volume && <CountUp value={volume.clicks} format={num} />}
      </Metric>
      <Metric index={3} label="클릭률" hint="검색 대비 클릭 · 높을수록 구매 의도가 강함">
        {volume && <CountUp value={volume.ctr} format={(n) => percent(n, 2)} />}
      </Metric>
      <Metric index={4} label="광고 경쟁" hint="검색광고 입찰 경쟁 정도">
        {volume && <AdCompetitionBadge level={volume.adCompetition} />}
      </Metric>
      <Metric index={5} label="검색 피크" hint="최근 1년 중 가장 많이 찾은 주">
        {peak && weekLabel(peak)}
      </Metric>
    </div>
  );
}

function Metric({ index, label, hint, children }: { index: number; label: string; hint: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === false || children === 0;
  return (
    <div
      className="animate-fade-up rounded-2xl border border-stone-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.1)]"
      style={stagger(index, 100)}
    >
      <p className="text-xs text-stone-500">{label}</p>
      <div className={`mt-1 text-2xl font-bold tracking-tight ${empty ? "text-stone-300" : "text-stone-900"}`}>{empty ? "–" : children}</div>
      <p className="mt-0.5 truncate text-[11px] text-stone-400" title={hint}>
        {hint}
      </p>
    </div>
  );
}

function Missing() {
  return <p className="py-8 text-center text-sm text-stone-400">연결되지 않은 데이터입니다. 위 안내를 확인해 주세요.</p>;
}

function TrendChart({ trend }: { trend: NonNullable<KeywordReport["trend"]> }) {
  const peak = peakIndex(trend.values);
  return (
    <>
      <AreaChart values={trend.values} markerIndex={peak} height={180} color="#10b981" className="w-full text-stone-500" />
      <div className="mt-2 flex justify-between text-[11px] text-stone-400">
        <span>{weekLabel(trend.periods[0])}</span>
        <span className="font-semibold text-emerald-700">최고 {weekLabel(trend.periods[peak])}</span>
        <span>{weekLabel(trend.periods.at(-1)!)}</span>
      </div>
    </>
  );
}

function SplitBar({ left, right, leftLabel, rightLabel, leftClass, rightClass }: { left: number; right: number; leftLabel: string; rightLabel: string; leftClass: string; rightClass: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs font-semibold text-stone-700">
        <span>
          {leftLabel} {percent(left, 0)}
        </span>
        <span>
          {rightLabel} {percent(right, 0)}
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-stone-100">
        <div className={`origin-left animate-grow ${leftClass}`} style={{ width: `${left * 100}%` }} />
        <div className={`origin-right animate-grow ${rightClass}`} style={{ width: `${right * 100}%` }} />
      </div>
    </div>
  );
}

function Audience({ audience }: { audience: NonNullable<KeywordReport["audience"]> }) {
  const maxAge = Math.max(...audience.age.map((a) => a.share), 0.01);
  const topAge = audience.age.reduce((a, b) => (b.share > a.share ? b : a));
  return (
    <div className="space-y-5">
      <SplitBar left={audience.gender.female} right={audience.gender.male} leftLabel="여성" rightLabel="남성" leftClass="bg-rose-300" rightClass="bg-sky-400" />
      <div>
        <p className="mb-2 text-xs text-stone-500">
          연령 · <b className="text-stone-700">{topAge.group}대</b>가 가장 많이 찾아요
        </p>
        <div className="flex h-28 items-end gap-2">
          {audience.age.map((a, i) => (
            <div key={a.group} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-stone-400">{percent(a.share, 0)}</span>
              <div
                className={`w-full origin-bottom animate-grow-y rounded-t-lg ${a === topAge ? "bg-linear-to-t from-emerald-600 to-emerald-400" : "bg-stone-200"}`}
                style={{ height: `${(a.share / maxAge) * 72}px`, ...stagger(i, 300, 60) }}
              />
              <span className="text-[11px] text-stone-500">{a.group}대</span>
            </div>
          ))}
        </div>
      </div>
      <SplitBar left={audience.device.mobile} right={audience.device.pc} leftLabel="모바일" rightLabel="PC" leftClass="bg-emerald-400" rightClass="bg-stone-400" />
    </div>
  );
}
