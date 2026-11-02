"use client";

import { useMemo, useState } from "react";
import { Badge, CopyButton, TextInput } from "@/components/ui";
import { KEYWORD_LENGTHS, type KeywordInsights } from "@/lib/adInsights";
import { VERDICT_META, type AdGroup, type Verdict } from "@/lib/coupangAds";
import { num, percent, won, wonShort } from "@/lib/format";
import { Panel, Ring, SectionHeader, profitText, rateText, roasText } from "./parts";

const PAGE = 40;
const FILTERS = ["all", "scale", "ok", "cut", "exclude", "watch"] as const;
type Filter = (typeof FILTERS)[number];

const SORTS = {
  cost: { label: "광고비 순", value: (g: AdGroup) => g.metrics.cost },
  revenue: { label: "매출 순", value: (g: AdGroup) => g.metrics.revenue },
  roas: { label: "ROAS 순", value: (g: AdGroup) => g.metrics.roas ?? -1 },
  profit: { label: "남긴 돈 순", value: (g: AdGroup) => g.profit ?? 0 },
  clicks: { label: "클릭 순", value: (g: AdGroup) => g.metrics.clicks },
} as const;
type Sort = keyof typeof SORTS;

function KeywordList({ title, tone, groups, empty, copyLabel }: { title: string; tone: "good" | "loss"; groups: AdGroup[]; empty: string; copyLabel: string }) {
  return (
    <div className={`rounded-2xl p-4 ring-1 ${tone === "good" ? "bg-emerald-50/40 ring-emerald-100" : "bg-rose-50/40 ring-rose-100"}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className={`text-sm font-semibold ${tone === "good" ? "text-emerald-800" : "text-rose-800"}`}>
          {title} <span className="font-normal opacity-70">{groups.length}</span>
        </p>
        {groups.length > 0 && <CopyButton text={groups.map((g) => g.key).join("\n")} label={copyLabel} />}
      </div>
      {!groups.length ? (
        <p className="text-xs text-stone-500">{empty}</p>
      ) : (
        <ol className="space-y-1.5">
          {groups.slice(0, 8).map((g, i) => (
            <li key={g.key} className="flex items-center gap-2 text-sm">
              <span className="w-4 text-right text-xs tabular-nums text-stone-400">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-stone-800" title={g.key}>
                {g.key}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-stone-500">
                {tone === "good" ? `${roasText(g.metrics.roas)} · ${g.metrics.orders}건` : `클릭 ${g.metrics.clicks} · ${won(g.metrics.cost)}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function KeywordPanel({ keywords, minClicks }: { keywords: KeywordInsights; minClicks: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("cost");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const wasteShare = keywords.metrics.cost > 0 ? keywords.noOrder.cost / keywords.metrics.cost : 0;
  const bestLength = [...keywords.lengths].sort((a, b) => (b.metrics.roas ?? 0) - (a.metrics.roas ?? 0))[0];
  const maxLengthRoas = Math.max(1, ...keywords.lengths.map((l) => l.metrics.roas ?? 0));
  const scale = [...keywords.scale].sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return keywords.groups
      .filter((g) => (filter === "all" || g.verdict === filter) && (!q || g.key.toLowerCase().includes(q)))
      .sort((a, b) => SORTS[sort].value(b) - SORTS[sort].value(a));
  }, [keywords.groups, filter, sort, query]);
  const count = (v: Verdict) => keywords.groups.filter((g) => g.verdict === v).length;

  return (
    <Panel>
      <SectionHeader
        eyebrow="Keyword Intelligence"
        title="어떤 검색어가 돈을 벌고, 어디서 새나"
        description={`검색 영역에 노출된 키워드 ${num(keywords.groups.length)}개를 분석했어요. 주문 없이 클릭 ${minClicks}회 이상이면 제외 후보, 손익분기의 1.3배 이상 + 주문 2건 이상이면 효자예요.`}
      />

      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex items-center gap-4 rounded-2xl bg-stone-50 p-5">
          <Ring value={1 - wasteShare} size={112} stroke={12} color="#10b981" track="#fecdd3">
            <span className="text-[10px] text-stone-400">일한 광고비</span>
            <span className="text-lg font-bold tabular-nums text-stone-900">{percent(1 - wasteShare, 0)}</span>
          </Ring>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-stone-400">주문 난 키워드</span>
              <br />
              <b className="tabular-nums">{num(keywords.converting)}개</b> <span className="text-xs text-stone-400">/ {num(keywords.groups.length)}개</span>
            </p>
            <p>
              <span className="text-rose-500">주문 0건에 나간 광고비</span>
              <br />
              <b className="tabular-nums text-rose-600">{wonShort(keywords.noOrder.cost)}</b> <span className="text-xs text-stone-400">({percent(wasteShare, 0)})</span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-stone-50 p-5">
          <p className="text-xs font-semibold text-stone-500">집중도</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-700">
            키워드 매출의 80%를 단 <b className="text-stone-900">{num(keywords.revenue80Count)}개</b> 키워드가 만들어요. 광고비 상위 10개 키워드가 키워드 광고비의{" "}
            <b className="text-stone-900">{percent(keywords.top10CostShare, 0)}</b>를 써요.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            소수 키워드가 매출을 거의 다 만들어요. 이 키워드들은 수동 캠페인에서 직접 입찰가를 관리하면 효율이 더 올라가요.
          </p>
        </div>

        <div className="rounded-2xl bg-stone-50 p-5">
          <p className="text-xs font-semibold text-stone-500">검색어 길이별 ROAS</p>
          <ul className="mt-3 space-y-2.5">
            {keywords.lengths.map((l) => {
              const meta = KEYWORD_LENGTHS.find((k) => k.id === l.id)!;
              return (
                <li key={l.id}>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-700">
                      {meta.label} <span className="text-stone-400">예: {meta.example}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-stone-900">{roasText(l.metrics.roas)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-stone-200">
                    <div className={`h-full rounded-full ${l === bestLength ? "bg-emerald-500" : "bg-stone-400"}`} style={{ width: `${((l.metrics.roas ?? 0) / maxLengthRoas) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-stone-400">광고비 {percent(l.costShare, 0)} · 매출 {percent(l.revenueShare, 0)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <KeywordList title="효자 키워드 (남긴 돈 순)" tone="good" groups={scale} empty="아직 손익분기의 1.3배를 넘는 키워드가 없어요." copyLabel="복사" />
        <KeywordList title="제외 후보 (주문 0건)" tone="loss" groups={keywords.exclude} empty={`주문 없이 클릭 ${minClicks}회를 넘은 키워드가 없어요.`} copyLabel="복사" />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  setLimit(PAGE);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${filter === f ? "bg-[#07140f] text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
              >
                {f === "all" ? `전체 ${keywords.groups.length}` : `${VERDICT_META[f].label} ${count(f)}`}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <TextInput className="w-44! py-1.5 text-sm" placeholder="키워드 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-lg border border-stone-200 bg-white px-2 text-sm" aria-label="정렬">
              {(Object.keys(SORTS) as Sort[]).map((s) => (
                <option key={s} value={s}>
                  {SORTS[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">키워드</th>
                <th className="px-3 py-2 text-right font-medium">광고비</th>
                <th className="px-3 py-2 text-right font-medium">매출</th>
                <th className="px-3 py-2 text-right font-medium">ROAS</th>
                <th className="px-3 py-2 text-right font-medium">남긴 돈</th>
                <th className="px-3 py-2 text-right font-medium">주문</th>
                <th className="px-3 py-2 text-right font-medium">클릭</th>
                <th className="px-3 py-2 text-right font-medium">클릭률</th>
                <th className="px-3 py-2 text-right font-medium">전환율</th>
                <th className="px-3 py-2 text-left font-medium">진단</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((g) => (
                <tr key={g.key} className="border-t border-stone-100 hover:bg-stone-50/70">
                  <td className="max-w-64 truncate px-3 py-2 font-medium text-stone-800" title={g.key}>
                    {g.key}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{won(g.metrics.cost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{won(g.metrics.revenue)}</td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${g.metrics.roas !== null && g.breakEven ? (g.metrics.roas >= g.breakEven ? "text-emerald-600" : "text-rose-600") : ""}`}>
                    {roasText(g.metrics.roas)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${(g.profit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{profitText(g.profit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(g.metrics.orders)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(g.metrics.clicks)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rateText(g.metrics.ctr, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rateText(g.metrics.cvr)}</td>
                  <td className="px-3 py-2" title={VERDICT_META[g.verdict].action}>
                    <Badge tone={VERDICT_META[g.verdict].tone}>{VERDICT_META[g.verdict].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-6 text-center text-sm text-stone-400">조건에 맞는 키워드가 없어요.</p>}
        </div>
        {rows.length > limit && (
          <button type="button" onClick={() => setLimit((n) => n + PAGE * 2)} className="mt-3 w-full rounded-xl bg-stone-50 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100">
            {num(rows.length - limit)}개 더 보기
          </button>
        )}
      </div>
    </Panel>
  );
}
