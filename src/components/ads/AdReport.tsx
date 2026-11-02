"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui";
import { productCoach } from "@/lib/adCoach";
import { createFollowup, evaluateFollowup, reportSnapshot, samePeriod } from "@/lib/adFollowup";
import { analyzeAdReport, type AdAction, type ReportPeriod } from "@/lib/adInsights";
import { groupRows, type AdField, type AdRow, type BreakEvenOf } from "@/lib/coupangAds";
import { num, toDateKey, uid, won } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";
import { ActionPlan } from "./ActionPlan";
import { AdHero } from "./AdHero";
import { BehaviorPanel } from "./BehaviorPanel";
import { FollowupPanel } from "./FollowupPanel";
import { KeywordPanel } from "./KeywordPanel";
import { Panel, SectionHeader, profitText, rateText, roasText } from "./parts";
import { PlacementPanel } from "./PlacementPanel";
import { ProductCoachPanel } from "./ProductCoachPanel";
import { ProductMatrix } from "./ProductMatrix";

/** 주문 없이 이만큼 클릭되면 제외 후보 */
const MIN_CLICKS = 10;

interface Props {
  rows: AdRow[];
  fields: AdField[];
  fileName: string;
  window: string | null;
  period: ReportPeriod | null;
  breakEvenOf: BreakEvenOf;
  costMultiplier: number;
  /** 히어로 바로 아래에 넣을 설정 영역 */
  settings: ReactNode;
}

/** 광고 보고서 정밀 분석: 등급·돈 → (지난 조치 결과) → 할 일 → 지면·고객 → 상품 → 키워드 → 기간·캠페인 */
export function AdReport({ rows, fields, fileName, window, period, breakEvenOf, costMultiplier, settings }: Props) {
  const analysis = useMemo(() => analyzeAdReport(rows, fields, { breakEvenOf, costMultiplier, minClicks: MIN_CLICKS }), [rows, fields, breakEvenOf, costMultiplier]);
  const coaches = useMemo(() => productCoach(rows, { breakEvenOf, costMultiplier, minClicks: MIN_CLICKS }), [rows, breakEvenOf, costMultiplier]);
  const followups = useAppStore((s) => s.adFollowups);
  const reports = useAppStore((s) => s.adReports);
  const addAdFollowup = useAppStore((s) => s.addAdFollowup);
  const removeAdFollowup = useAppStore((s) => s.removeAdFollowup);
  const saveAdReport = useAppStore((s) => s.saveAdReport);
  const removeAdReport = useAppStore((s) => s.removeAdReport);

  // 올린 보고서는 추이용으로 요약해 둔다 (같은 기간은 손익분기를 바꿀 때마다 덮어쓴다)
  useEffect(() => {
    const snapshot = reportSnapshot(rows, period, breakEvenOf);
    if (snapshot) saveAdReport(snapshot);
  }, [rows, period, breakEvenOf, saveAdReport]);

  const views = useMemo(() => followups.map((followup) => ({ followup, result: evaluateFollowup(followup, rows, period) })), [followups, rows, period]);
  const recorded = useMemo(() => (period ? followups.filter((f) => samePeriod(f.baseline, period)) : []), [followups, period]);

  const record = (action: AdAction) => {
    const followup = createFollowup(action, { rows, period, breakEvenOf, costMultiplier, doneAt: toDateKey(new Date()), id: uid() });
    if (followup) addAdFollowup(followup);
  };

  // 결과가 나온 조치나 추이가 있으면 할 일보다 먼저, 기다리는 조치뿐이면 할 일 뒤에
  const hasResults = views.some((v) => v.result.after !== null) || reports.length >= 2;
  const followupPanel = (views.length > 0 || reports.length >= 2) && (
    <FollowupPanel views={views} reports={reports} period={period} costMultiplier={costMultiplier} onRemove={removeAdFollowup} onRemoveReport={removeAdReport} />
  );

  return (
    <div className="space-y-6">
      <AdHero overview={analysis.overview} period={period} fileName={fileName} window={window} withVat={costMultiplier > 1} />
      {settings}
      {hasResults && followupPanel}
      <ActionPlan actions={analysis.actions} period={period} recorded={recorded} onRecord={record} onUndo={removeAdFollowup} />
      <ProductCoachPanel coaches={coaches} />
      {!hasResults && followupPanel}
      <PlacementPanel placements={analysis.placements} />
      <BehaviorPanel overview={analysis.overview} timing={analysis.timing} cross={analysis.cross} />
      <ProductMatrix products={analysis.products} />
      {analysis.keywords && <KeywordPanel keywords={analysis.keywords} minClicks={MIN_CLICKS} />}
      <Breakdown rows={rows} breakEvenOf={breakEvenOf} costMultiplier={costMultiplier} />
    </div>
  );
}

const BREAKDOWNS = [
  { id: "date", label: "일별", keyOf: (r: AdRow) => r.date },
  { id: "campaign", label: "캠페인", keyOf: (r: AdRow) => r.campaign },
  { id: "adGroup", label: "광고그룹", keyOf: (r: AdRow) => r.adGroup },
] as const;
type BreakdownId = (typeof BREAKDOWNS)[number]["id"];

/** 일별 보고서이거나 캠페인·광고그룹이 여러 개일 때만 보이는 표 */
function Breakdown({ rows, breakEvenOf, costMultiplier }: { rows: AdRow[]; breakEvenOf: BreakEvenOf; costMultiplier: number }) {
  const available = BREAKDOWNS.filter((b) => new Set(rows.map(b.keyOf).filter(Boolean)).size > 1);
  const [view, setView] = useState<BreakdownId | null>(null);
  const active = available.find((b) => b.id === view) ?? available[0];
  const groups = useMemo(() => {
    if (!active) return [];
    const list = groupRows(rows.filter((r) => active.keyOf(r)), active.keyOf, breakEvenOf, costMultiplier);
    return active.id === "date" ? list.sort((a, b) => a.key.localeCompare(b.key)) : list;
  }, [rows, active, breakEvenOf, costMultiplier]);
  if (!active) return null;
  const maxCost = Math.max(1, ...groups.map((g) => g.metrics.cost));

  return (
    <Panel>
      <SectionHeader eyebrow="Breakdown" title="기간·캠페인별 흐름" actions={available.length > 1 && <Tabs tabs={available} value={active.id} onChange={setView} />} />
      <div className="overflow-x-auto rounded-2xl border border-stone-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-stone-50 text-xs text-stone-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{active.label}</th>
              <th className="px-3 py-2 text-right font-medium">광고비</th>
              <th className="px-3 py-2 text-right font-medium">매출</th>
              <th className="px-3 py-2 text-right font-medium">ROAS</th>
              <th className="px-3 py-2 text-right font-medium">남긴 돈</th>
              <th className="px-3 py-2 text-right font-medium">주문</th>
              <th className="px-3 py-2 text-right font-medium">클릭률</th>
              <th className="px-3 py-2 text-right font-medium">전환율</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} className="border-t border-stone-100">
                <td className="max-w-64 px-3 py-2">
                  <p className="truncate font-medium text-stone-800" title={g.key}>
                    {g.key}
                  </p>
                  <div className="mt-1 h-1 rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(g.metrics.cost / maxCost) * 100}%` }} />
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{won(g.metrics.cost)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{won(g.metrics.revenue)}</td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${g.metrics.roas !== null && g.breakEven ? (g.metrics.roas >= g.breakEven ? "text-emerald-600" : "text-rose-600") : ""}`}>
                  {roasText(g.metrics.roas)}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${(g.profit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{profitText(g.profit)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{num(g.metrics.orders)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{rateText(g.metrics.ctr, 2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{rateText(g.metrics.cvr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
