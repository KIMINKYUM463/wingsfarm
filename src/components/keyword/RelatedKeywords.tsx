"use client";

import { useMemo, useState } from "react";
import { CopyButton, Toggle } from "@/components/ui";
import { stagger } from "@/components/motion";
import { num, percent } from "@/lib/format";
import { AD_COMPETITION_ORDER, isGoldenKeyword, type KeywordReport, type RelatedKeyword } from "@/lib/keyword";
import { MonthBars } from "@/components/charts";
import { AdCompetitionBadge, Panel, useKeywordTrends, volumeText } from "./shared";

function TrendCell({ values, labels, loading }: { values: number[] | null | undefined; labels: string[]; loading: boolean }) {
  if (loading) return <span className="block h-7 w-27 animate-pulse rounded-md bg-stone-100" />;
  if (!values) return <span className="text-xs text-stone-300">식품 분야 데이터 없음</span>;
  const peak = values.indexOf(Math.max(...values));
  return (
    <span className="flex items-end gap-2">
      <MonthBars values={values} labels={labels} />
      <span className="whitespace-nowrap text-[11px] font-semibold text-amber-600">{labels[peak]} 피크</span>
    </span>
  );
}

type SortKey = "volume" | "competition" | "ctr";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "volume", label: "검색수 많은 순" },
  { key: "competition", label: "광고 경쟁 낮은 순" },
  { key: "ctr", label: "클릭률 높은 순" },
];

const INITIAL_ROWS = 15;

const byVolume = (a: RelatedKeyword, b: RelatedKeyword) => b.volume.total - a.volume.total;
const sorters: Record<SortKey, (a: RelatedKeyword, b: RelatedKeyword) => number> = {
  volume: byVolume,
  competition: (a, b) => (AD_COMPETITION_ORDER[a.volume.adCompetition] ?? 9) - (AD_COMPETITION_ORDER[b.volume.adCompetition] ?? 9) || byVolume(a, b),
  ctr: (a, b) => b.volume.ctr - a.volume.ctr,
};

export function RelatedKeywords({ report, onAnalyze }: { report: KeywordReport; onAnalyze: (keyword: string) => void }) {
  const [goldenOnly, setGoldenOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("volume");
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => {
    const filtered = goldenOnly ? report.related.filter(isGoldenKeyword) : report.related;
    return [...filtered].sort(sorters[sort]);
  }, [report.related, goldenOnly, sort]);

  const goldenCount = report.related.filter(isGoldenKeyword).length;
  const visible = expanded ? rows : rows.slice(0, INITIAL_ROWS);
  const maxVolume = Math.max(...report.related.map((k) => k.volume.total), 1);
  const trends = useKeywordTrends(visible.map((k) => k.keyword));
  const monthLabels = trends.periods.map((p) => `${Number(p.slice(5, 7))}월`);

  return (
    <Panel
      index={3}
      title="연관 키워드"
      subtitle="네이버 검색광고 키워드 도구 기준 · 행을 누르면 그 키워드를 분석합니다"
      aside={rows.length > 0 && <CopyButton text={rows.map((r) => r.keyword).join(", ")} label="키워드 복사" />}
    >
      {report.related.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">
          {report.notices.some((n) => n.service === "searchad") ? "검색광고 API를 연결하면 연관 키워드가 나옵니다." : "연관 키워드를 찾지 못했습니다."}
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-full bg-stone-100 p-1">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${sort === s.key ? "bg-stone-900 text-amber-200 shadow" : "text-stone-500 hover:text-stone-800"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Toggle checked={goldenOnly} onChange={setGoldenOnly} label={`황금 키워드만 (${goldenCount})`} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs text-stone-500 [&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                  <th>키워드</th>
                  <th className="text-right">월간 검색수</th>
                  <th>최근 12개월 추이</th>
                  <th className="text-right">PC</th>
                  <th className="text-right">모바일</th>
                  <th className="text-right">월평균 클릭</th>
                  <th className="text-right">클릭률</th>
                  <th>광고 경쟁</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((k, i) => (
                  <tr
                    key={k.keyword}
                    className="group animate-fade-up cursor-pointer border-b border-stone-100 transition hover:bg-amber-50/50 [&>td]:px-3 [&>td]:py-2.5"
                    style={stagger(i % INITIAL_ROWS, 0, 25)}
                    onClick={() => onAnalyze(k.keyword)}
                  >
                    <td className="font-medium text-stone-900">
                      {isGoldenKeyword(k) && <span className="mr-1.5 text-amber-500" title="황금 키워드: 검색수 500 이상 + 광고 경쟁 낮음">★</span>}
                      {k.keyword}
                    </td>
                    <td className="text-right">
                      <span className="font-semibold tabular-nums text-stone-900">{volumeText(k.volume.total)}</span>
                      <span className="ml-auto mt-1 block h-1 w-20 overflow-hidden rounded-full bg-stone-100">
                        <span
                          className="block h-full origin-left animate-grow rounded-full bg-linear-to-r from-amber-300 to-amber-500"
                          style={{ width: `${(k.volume.total / maxVolume) * 100}%` }}
                        />
                      </span>
                    </td>
                    <td>
                      <TrendCell values={trends.series[k.keyword]} labels={monthLabels} loading={trends.loading(k.keyword)} />
                    </td>
                    <td className="text-right tabular-nums text-stone-500">{volumeText(k.volume.pc)}</td>
                    <td className="text-right tabular-nums text-stone-500">{volumeText(k.volume.mobile)}</td>
                    <td className="text-right tabular-nums text-stone-500">{num(k.volume.clicks)}</td>
                    <td className="text-right tabular-nums text-stone-500">{percent(k.volume.ctr, 2)}</td>
                    <td>
                      <AdCompetitionBadge level={k.volume.adCompetition} />
                    </td>
                    <td className="text-right text-xs text-stone-300 transition group-hover:text-amber-600">분석 →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > INITIAL_ROWS && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-4 w-full rounded-xl bg-stone-50 py-2.5 text-sm text-stone-600 transition hover:bg-stone-100">
              {expanded ? "접기" : `${rows.length - INITIAL_ROWS}개 더 보기`}
            </button>
          )}
          <p className="mt-3 text-[11px] text-stone-400">
            12개월 추이 = 네이버 쇼핑 식품 분야 월별 클릭 (키워드마다 최고 달 기준) · <span className="text-amber-600">금색</span> 최고 달 · <span className="text-emerald-600">초록</span> 지난달
          </p>
          <p className="mt-1 text-[11px] text-stone-400">★ 황금 키워드 = 월간 검색수 500 이상이면서 광고 경쟁 낮음 (찾는 사람은 많은데 광고비를 쓰는 판매자가 적은 키워드)</p>
        </>
      )}
    </Panel>
  );
}
