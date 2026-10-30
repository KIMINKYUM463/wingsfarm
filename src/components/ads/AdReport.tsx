"use client";

import { useMemo, useState } from "react";
import { Badge, Card, CopyButton, Notice, Stat, Table, Tabs } from "@/components/ui";
import {
  NON_SEARCH,
  VERDICT_META,
  groupRows,
  keywordOf,
  spendByVerdict,
  summarize,
  type AdGroup,
  type AdRow,
  type Verdict,
} from "@/lib/coupangAds";
import { num, percent, won } from "@/lib/format";

type View = "keyword" | "product" | "campaign" | "date";

const VIEWS: { id: View; label: string }[] = [
  { id: "keyword", label: "키워드" },
  { id: "product", label: "상품" },
  { id: "campaign", label: "캠페인" },
  { id: "date", label: "일별" },
];

const KEY_OF: Record<View, (r: AdRow) => string> = {
  keyword: keywordOf,
  product: (r) => r.product || "(상품명 없음)",
  campaign: (r) => r.campaign || "(캠페인 없음)",
  date: (r) => r.date || "(날짜 없음)",
};

const roasText = (roas: number | null) => (roas === null ? "-" : `${num(roas)}%`);
const rateText = (value: number | null) => (value === null ? "-" : percent(value, 2));

interface Props {
  rows: AdRow[];
  /** 줄마다의 손익분기 ROAS (상품 매칭 → 없으면 기본값) */
  breakEvenOf: (r: AdRow) => number | null;
  /** 상품 이름 → 연결된 마진 계산기 상품 이름 (없으면 null) */
  linkedSkuOf: (product: string) => string | null;
  baseBreakEven: number;
  costMultiplier: number;
}

/** 광고 보고서 분석 결과: 요약 지표 → 할 일 → 키워드·상품·캠페인·일별 표 */
export function AdReport({ rows, breakEvenOf, linkedSkuOf, baseBreakEven, costMultiplier }: Props) {
  const [view, setView] = useState<View>("keyword");
  const [filter, setFilter] = useState<Verdict | "all">("all");

  const total = useMemo(() => summarize(rows, costMultiplier), [rows, costMultiplier]);
  const groupsByView = useMemo(
    () => Object.fromEntries(VIEWS.map((v) => [v.id, groupRows(rows, KEY_OF[v.id], breakEvenOf, costMultiplier)])) as Record<View, AdGroup[]>,
    [rows, breakEvenOf, costMultiplier],
  );
  const keywords = groupsByView.keyword;
  const spend = spendByVerdict(keywords);
  const pick = (verdict: Verdict) => keywords.filter((g) => g.verdict === verdict && g.key !== NON_SEARCH);
  const exclude = pick("exclude");
  const cut = pick("cut");
  const scale = pick("scale");
  const losingProducts = groupsByView.product.filter((g) => g.verdict === "cut" || g.verdict === "exclude");

  const groups = view === "date" ? [...groupsByView.date].sort((a, b) => a.key.localeCompare(b.key)) : groupsByView[view];
  const shown = view === "keyword" && filter !== "all" ? groups.filter((g) => g.verdict === filter) : groups;
  const maxDailyCost = Math.max(1, ...groupsByView.date.map((g) => g.metrics.cost));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="광고비" value={won(total.cost)} hint={costMultiplier > 1 ? "부가세 포함" : "보고서 금액 그대로"} />
        <Stat label="광고 매출" value={won(total.revenue)} hint={`주문 ${num(total.orders)}건`} />
        <Stat
          label="ROAS"
          value={roasText(total.roas)}
          hint={`손익분기 ${num(baseBreakEven)}% 기준`}
          tone={total.roas === null ? "default" : total.roas >= baseBreakEven ? "good" : "loss"}
        />
        <Stat label="클릭 · 전환율" value={`${num(total.clicks)}회`} hint={`CTR ${rateText(total.ctr)} · CVR ${rateText(total.cvr)} · CPC ${total.cpc === null ? "-" : won(total.cpc)}`} />
      </div>

      <Card title="이번 보고서에서 할 일">
        <ul className="space-y-3 text-sm">
          {exclude.length > 0 && (
            <li className="flex flex-wrap items-start justify-between gap-2">
              <span>
                <Badge tone="loss">제외 후보</Badge> 클릭은 10번 넘게 받았는데 주문이 없는 키워드 <b>{exclude.length}개</b>에 광고비 <b>{won(spend.exclude)}</b>
                {total.cost > 0 && ` (전체의 ${percent(spend.exclude / total.cost, 0)})`}가 나갔어요. 제외 키워드로 등록하세요: {exclude.slice(0, 5).map((g) => g.key).join(", ")}
                {exclude.length > 5 && ` 외 ${exclude.length - 5}개`}
              </span>
              <CopyButton text={exclude.map((g) => g.key).join("\n")} label="제외 키워드 복사" />
            </li>
          )}
          {cut.length > 0 && (
            <li>
              <Badge tone="warn">적자</Badge> 손익분기 ROAS에 못 미치는 키워드 <b>{cut.length}개</b> — 입찰가를 낮추세요: {cut.slice(0, 5).map((g) => `${g.key}(${roasText(g.metrics.roas)})`).join(", ")}
            </li>
          )}
          {scale.length > 0 && (
            <li>
              <Badge tone="good">효자</Badge> 손익분기의 1.3배 넘게 버는 키워드 <b>{scale.length}개</b> — 입찰가를 올려 노출을 늘리세요: {scale.slice(0, 5).map((g) => `${g.key}(${roasText(g.metrics.roas)})`).join(", ")}
            </li>
          )}
          {losingProducts.length > 0 && (
            <li>
              <Badge tone="loss">상품</Badge> 광고할수록 손해인 상품: {losingProducts.map((g) => `${g.key}(${roasText(g.metrics.roas)} / 손익분기 ${roasText(g.breakEven)})`).join(", ")} — 판매가·원가를 먼저 점검하세요.
            </li>
          )}
          {!exclude.length && !cut.length && !scale.length && !losingProducts.length && <li className="text-stone-500">눈에 띄게 손해 보는 키워드가 없어요. 데이터가 더 쌓이면 다시 올려 보세요.</li>}
        </ul>
      </Card>

      <Card
        title="상세"
        actions={<Tabs tabs={VIEWS} value={view} onChange={setView} />}
      >
        {view === "keyword" && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(["all", "exclude", "cut", "scale", "ok", "watch"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilter(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${filter === v ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
              >
                {v === "all" ? `전체 ${keywords.length}` : `${VERDICT_META[v].label} ${keywords.filter((g) => g.verdict === v).length}`}
              </button>
            ))}
          </div>
        )}
        {view === "keyword" && <p className="mb-2 text-xs text-stone-400">{NON_SEARCH}: 키워드 없이 상품 상세·추천 지면에 노출된 광고예요.</p>}
        <Table>
          <thead>
            <tr>
              <th>{VIEWS.find((v) => v.id === view)!.label}</th>
              <th className="text-right">광고비</th>
              <th className="text-right">광고 매출</th>
              <th className="text-right">ROAS</th>
              <th className="text-right">손익분기</th>
              <th className="text-right">주문</th>
              <th className="text-right">클릭</th>
              <th className="text-right">CTR</th>
              <th className="text-right">CPC</th>
              <th className="text-right">전환율</th>
              {view !== "date" && <th>진단</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => {
              const m = g.metrics;
              const linked = view === "product" ? linkedSkuOf(g.key) : null;
              return (
                <tr key={g.key}>
                  <td className="max-w-64">
                    <p className="truncate font-medium text-stone-800" title={g.key}>
                      {g.key}
                    </p>
                    {view === "product" && <p className="text-xs text-stone-400">{linked ? `마진 계산기: ${linked}` : "마진 계산기 상품과 연결 안 됨 → 기본 손익분기 사용"}</p>}
                    {view === "date" && (
                      <div className="mt-1 h-1.5 rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-violet-400" style={{ width: `${(m.cost / maxDailyCost) * 100}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{won(m.cost)}</td>
                  <td className="text-right tabular-nums">{won(m.revenue)}</td>
                  <td className={`text-right font-semibold tabular-nums ${m.roas !== null && g.breakEven !== null ? (m.roas >= g.breakEven ? "text-emerald-600" : "text-rose-600") : ""}`}>{roasText(m.roas)}</td>
                  <td className="text-right tabular-nums text-stone-400">{roasText(g.breakEven)}</td>
                  <td className="text-right tabular-nums">{num(m.orders)}</td>
                  <td className="text-right tabular-nums">{num(m.clicks)}</td>
                  <td className="text-right tabular-nums">{rateText(m.ctr)}</td>
                  <td className="text-right tabular-nums">{m.cpc === null ? "-" : won(m.cpc)}</td>
                  <td className="text-right tabular-nums">{rateText(m.cvr)}</td>
                  {view !== "date" && (
                    <td title={VERDICT_META[g.verdict].action}>
                      <Badge tone={VERDICT_META[g.verdict].tone}>{VERDICT_META[g.verdict].label}</Badge>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
        {!shown.length && <Notice className="mt-3">이 조건에 맞는 줄이 없어요.</Notice>}
      </Card>
    </div>
  );
}
