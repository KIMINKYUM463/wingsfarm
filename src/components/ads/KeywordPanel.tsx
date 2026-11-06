"use client";

import { Fragment, useMemo, useState } from "react";
import { Badge, CopyButton, TextInput } from "@/components/ui";
import { keywordSales, manualBidGroups } from "@/lib/adOptions";
import { KEYWORD_LENGTHS, type KeywordInsights } from "@/lib/adInsights";
import { VERDICT_META, type AdGroup, type Verdict } from "@/lib/coupangAds";
import { num, percent, won, wonShort } from "@/lib/format";
import { IrrelevantKeywords } from "./IrrelevantKeywords";
import { DataTable, Metric, Panel, SectionHeader, TableHead, profitText, rateText, roasText, td, th } from "./parts";

const PAGE = 40;
const FILTERS = ["all", "scale", "ok", "cut", "exclude", "watch"] as const;
type Filter = (typeof FILTERS)[number];

const SORTS = {
  cost: { label: "광고비 순", value: (g: AdGroup) => g.metrics.cost },
  revenue: { label: "매출 순", value: (g: AdGroup) => g.metrics.revenue },
  roas: { label: "ROAS 순", value: (g: AdGroup) => g.metrics.roas ?? -1 },
  profit: { label: "남긴 돈 순", value: (g: AdGroup) => g.profit ?? 0 },
  clicks: { label: "클릭 순", value: (g: AdGroup) => g.metrics.clicks },
  cpc: { label: "단가 순", value: (g: AdGroup) => g.metrics.cpc ?? -1 },
} as const;
type Sort = keyof typeof SORTS;

export function KeywordPanel({ keywords, minClicks, costMultiplier }: { keywords: KeywordInsights; minClicks: number; costMultiplier: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("cost");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const bids = useMemo(() => manualBidGroups(keywords.groups), [keywords.groups]);
  const searchRows = useMemo(() => keywords.groups.flatMap((g) => g.rows), [keywords.groups]);

  const wasteShare = keywords.metrics.cost > 0 ? keywords.noOrder.cost / keywords.metrics.cost : 0;
  const bestLength = [...keywords.lengths].sort((a, b) => (b.metrics.roas ?? 0) - (a.metrics.roas ?? 0))[0];
  const maxLengthRoas = Math.max(1, ...keywords.lengths.map((l) => l.metrics.roas ?? 0));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return keywords.groups.filter((g) => (filter === "all" || g.verdict === filter) && (!q || g.key.toLowerCase().includes(q))).sort((a, b) => SORTS[sort].value(b) - SORTS[sort].value(a));
  }, [keywords.groups, filter, sort, query]);
  const count = (v: Verdict) => keywords.groups.filter((g) => g.verdict === v).length;

  return (
    <Panel>
      <SectionHeader
        title="키워드 성과"
        description={`클릭 ${minClicks}회 이상·주문 0건은 제외, 손익분기 1.3배 + 주문 2건은 효자.`}
        actions={
          <div className="flex gap-2">
            {keywords.scale.length > 0 && <CopyButton text={keywords.scale.map((g) => g.key).join("\n")} label="효자 복사" />}
            {keywords.exclude.length > 0 && <CopyButton text={keywords.exclude.map((g) => g.key).join("\n")} label="제외 후보 복사" />}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="주문 난 키워드" value={`${num(keywords.converting)} / ${num(keywords.groups.length)}`} />
        <Metric label="일한 광고비" value={percent(1 - wasteShare, 0)} hint={`낭비 ${wonShort(keywords.noOrder.cost)}`} tone={wasteShare > 0.2 ? "loss" : "default"} />
        <Metric label="매출 80% 키워드" value={`${num(keywords.revenue80Count)}개`} hint={`상위 10개 광고비 ${percent(keywords.top10CostShare, 0)}`} />
        <Metric label="제외 후보" value={`${num(keywords.exclude.length)}개`} tone={keywords.exclude.length ? "loss" : "default"} />
      </div>

      <div className="mb-4">
        <IrrelevantKeywords rows={searchRows} costMultiplier={costMultiplier} />
      </div>

      {bids.length > 0 && (
        <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-stone-700">
              노출 80 미만인데 손익분기를 넘은 키워드 <b>{bids.length}</b>개. 자동 입찰에 두면 잘 안 보이니 수동 입찰로 올려 보세요.
            </p>
            <CopyButton text={bids.map((g) => g.key).join("\n")} label="수동 입찰 복사" />
          </div>
          <p className="mt-1 text-xs text-stone-500">{bids.slice(0, 8).map((g) => `${g.key} ${roasText(g.metrics.roas)}`).join(" · ")}</p>
        </div>
      )}

      {keywords.lengths.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {keywords.lengths.map((l) => {
            const meta = KEYWORD_LENGTHS.find((k) => k.id === l.id)!;
            return (
              <div key={l.id}>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">{meta.label}</span>
                  <span className="tabular-nums text-stone-800">{roasText(l.metrics.roas)}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-stone-100">
                  <div className={`h-full rounded-full ${l === bestLength ? "bg-emerald-500" : "bg-stone-300"}`} style={{ width: `${((l.metrics.roas ?? 0) / maxLengthRoas) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setLimit(PAGE);
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${filter === f ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
            >
              {f === "all" ? `전체 ${keywords.groups.length}` : `${VERDICT_META[f].label} ${count(f)}`}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <TextInput className="w-40! py-1.5 text-sm" placeholder="키워드 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-lg border border-stone-200 bg-white px-2 text-sm" aria-label="정렬">
            {(Object.keys(SORTS) as Sort[]).map((s) => (
              <option key={s} value={s}>
                {SORTS[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable minWidth="920px">
        <TableHead>
          <tr>
            <th className={th("left")}>키워드</th>
            <th className={th()}>광고비</th>
            <th className={th()} title="클릭 1회당 광고비. 광고비 ÷ 클릭이고, 부가세 포함이면 표의 광고비와 같이 1.1을 곱해요.">
              단가
            </th>
            <th className={th()}>매출</th>
            <th className={th()}>ROAS</th>
            <th className={th()}>남긴 돈</th>
            <th className={th()}>주문</th>
            <th className={th()}>클릭</th>
            <th className={th()}>클릭률</th>
            <th className={th()}>전환율</th>
            <th className={th("left")}>진단</th>
          </tr>
        </TableHead>
        <tbody>
          {rows.slice(0, limit).map((g) => {
            const sales = keywordSales(g);
            const opened = open === g.key;
            return (
            <Fragment key={g.key}>
            <tr className="border-t border-stone-100 hover:bg-stone-50/70">
              <td className={`${td("max-w-64 truncate font-medium text-stone-800")}`} title={g.key}>
                <button type="button" className="max-w-full truncate text-left hover:underline" onClick={() => setOpen(opened ? null : g.key)}>
                  {g.key}
                </button>
              </td>
              <td className={`${td()} text-right tabular-nums`}>{won(g.metrics.cost)}</td>
              <td className={`${td()} text-right tabular-nums`} title={g.metrics.clicks > 0 ? `${won(g.metrics.cost)} ÷ ${num(g.metrics.clicks)}클릭` : undefined}>
                {g.metrics.cpc === null ? "-" : won(g.metrics.cpc)}
              </td>
              <td className={`${td()} text-right tabular-nums`}>{won(g.metrics.revenue)}</td>
              <td className={`${td()} text-right font-semibold tabular-nums ${g.metrics.roas !== null && g.breakEven ? (g.metrics.roas >= g.breakEven ? "text-emerald-600" : "text-rose-600") : ""}`}>
                {roasText(g.metrics.roas)}
              </td>
              <td className={`${td()} text-right tabular-nums ${(g.profit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{profitText(g.profit)}</td>
              <td className={`${td()} text-right tabular-nums`}>{num(g.metrics.orders)}</td>
              <td className={`${td()} text-right tabular-nums`}>{num(g.metrics.clicks)}</td>
              <td className={`${td()} text-right tabular-nums`}>{rateText(g.metrics.ctr, 2)}</td>
              <td className={`${td()} text-right tabular-nums`}>{rateText(g.metrics.cvr)}</td>
              <td className={td()} title={VERDICT_META[g.verdict].action}>
                <Badge tone={VERDICT_META[g.verdict].tone}>{VERDICT_META[g.verdict].label}</Badge>
              </td>
            </tr>
            {opened && (
              <tr className="bg-stone-50/80">
                <td colSpan={11} className="px-3 py-2 text-sm text-stone-600">
                  {sales.length === 0 ? (
                    "이 키워드로 난 주문이 없어요."
                  ) : (
                    <ul className="space-y-1">
                      {sales.map((s) => (
                        <li key={s.productName}>
                          {s.productName} · 주문 {num(s.orders)} · {won(s.revenue)}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            )}
            </Fragment>
          );
          })}
        </tbody>
      </DataTable>
      {!rows.length && <p className="py-6 text-center text-sm text-stone-400">조건에 맞는 키워드가 없어요.</p>}
      {rows.length > limit && (
        <button type="button" onClick={() => setLimit((n) => n + PAGE * 2)} className="mt-3 w-full rounded-lg bg-stone-50 py-2 text-sm text-stone-600 hover:bg-stone-100">
          {num(rows.length - limit)}개 더 보기
        </button>
      )}
    </Panel>
  );
}
