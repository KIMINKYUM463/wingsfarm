"use client";

import { Activity, useEffect, useMemo, useState, type ReactNode } from "react";
import { Tabs } from "@/components/ui";
import { productCoach } from "@/lib/adCoach";
import { createFollowup, evaluateFollowup, reportSnapshot, samePeriod } from "@/lib/adFollowup";
import { analyzeAdReport, type AdAction, type ReportPeriod } from "@/lib/adInsights";
import { groupRows, type AdField, type AdRow, type BreakEvenOf } from "@/lib/coupangAds";
import { num, toDateKey, uid, won } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";
import { ActionPlan } from "./ActionPlan";
import { AdSummary } from "./AdSummary";
import { BehaviorPanel } from "./BehaviorPanel";
import { FollowupPanel } from "./FollowupPanel";
import { KeywordPanel } from "./KeywordPanel";
import { DataTable, Panel, SectionHeader, TableHead, profitText, rateText, roasText, td, th } from "./parts";
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
  /** 보고서 정보 줄 오른쪽에 넣을 설정 (손익분기·부가세) */
  settings: ReactNode;
  /** "실제 매출" 탭 내용 (쿠팡 윙 매출 비교) */
  sales: ReactNode;
}

type TabId = "actions" | "products" | "keywords" | "audience" | "breakdown" | "sales";

/** 스크롤해도 위에 붙어 있는 밑줄형 탭 (이름 옆에 개수) */
function ReportTabs({ tabs, value, onChange }: { tabs: { id: TabId; label: string; count?: number }[]; value: TabId; onChange: (id: TabId) => void }) {
  return (
    <div role="tablist" className="sticky top-0 z-20 -mx-1 flex gap-1 overflow-x-auto border-b border-stone-200 bg-stone-50/95 px-1 backdrop-blur">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-3 text-sm font-medium transition ${
              active ? "border-emerald-600 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && <span className={`rounded-md px-1.5 text-[11px] tabular-nums ${active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** 광고 보고서 정밀 분석: 요약(지표) 아래 탭으로 할 일 · 상품 · 키워드 · 지면·고객 · 캠페인 · 실제 매출을 나눠 본다 */
export function AdReport({ rows, fields, fileName, window, period, breakEvenOf, costMultiplier, settings, sales }: Props) {
  const [tab, setTab] = useState<TabId>("actions");
  const analysis = useMemo(
    () =>
      analyzeAdReport(rows, fields, {
        breakEvenOf,
        costMultiplier,
        minClicks: MIN_CLICKS,
      }),
    [rows, fields, breakEvenOf, costMultiplier],
  );
  const coaches = useMemo(
    () =>
      productCoach(rows, {
        breakEvenOf,
        costMultiplier,
        minClicks: MIN_CLICKS,
      }),
    [rows, breakEvenOf, costMultiplier],
  );
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

  const views = useMemo(
    () =>
      followups.map((followup) => ({
        followup,
        result: evaluateFollowup(followup, rows, period),
      })),
    [followups, rows, period],
  );
  const recorded = useMemo(() => (period ? followups.filter((f) => samePeriod(f.baseline, period)) : []), [followups, period]);

  const record = (action: AdAction) => {
    const followup = createFollowup(action, {
      rows,
      period,
      breakEvenOf,
      costMultiplier,
      doneAt: toDateKey(new Date()),
      id: uid(),
    });
    if (followup) addAdFollowup(followup);
  };

  // 결과가 나온 조치나 추이가 있으면 할 일보다 먼저, 기다리는 조치뿐이면 할 일 뒤에
  const hasResults = views.some((v) => v.result.after !== null) || reports.length >= 2;
  const followupPanel = (views.length > 0 || reports.length >= 2) && (
    <FollowupPanel views={views} reports={reports} period={period} costMultiplier={costMultiplier} onRemove={removeAdFollowup} onRemoveReport={removeAdReport} />
  );

  const breakdowns = useMemo(() => availableBreakdowns(rows), [rows]);
  const tabs = [
    { id: "actions" as const, label: "할 일", count: analysis.actions.length },
    { id: "products" as const, label: "상품", count: analysis.products.length },
    ...(analysis.keywords
      ? [
          {
            id: "keywords" as const,
            label: "키워드",
            count: analysis.keywords.groups.length,
          },
        ]
      : []),
    { id: "audience" as const, label: "지면" },
    ...(breakdowns.length ? [{ id: "breakdown" as const, label: "추이" }] : []),
    { id: "sales" as const, label: "실제 매출" },
  ];
  const current = tabs.some((t) => t.id === tab) ? tab : "actions";
  const panels: Record<TabId, ReactNode> = {
    actions: (
      <>
        {hasResults && followupPanel}
        <ActionPlan actions={analysis.actions} period={period} recorded={recorded} onRecord={record} onUndo={removeAdFollowup} />
        {!hasResults && followupPanel}
      </>
    ),
    products: (
      <>
        <ProductCoachPanel coaches={coaches} />
        <ProductMatrix products={analysis.products} />
      </>
    ),
    keywords: analysis.keywords && <KeywordPanel keywords={analysis.keywords} minClicks={MIN_CLICKS} />,
    audience: (
      <>
        <PlacementPanel placements={analysis.placements} />
        <BehaviorPanel overview={analysis.overview} timing={analysis.timing} cross={analysis.cross} />
      </>
    ),
    breakdown: breakdowns.length > 0 && <Breakdown rows={rows} available={breakdowns} breakEvenOf={breakEvenOf} costMultiplier={costMultiplier} />,
    sales,
  };

  return (
    <div className="space-y-4">
      <AdSummary overview={analysis.overview} period={period} fileName={fileName} window={window} withVat={costMultiplier > 1} settings={settings} />
      <ReportTabs tabs={tabs} value={current} onChange={setTab} />
      {tabs.map(({ id }) => (
        // 숨긴 탭도 상태(펼친 카드·불러온 매출)를 잃지 않도록 Activity로 감춘다
        <Activity key={id} mode={id === current ? "visible" : "hidden"}>
          <div role="tabpanel" className="space-y-5">
            {panels[id]}
          </div>
        </Activity>
      ))}
    </div>
  );
}

const BREAKDOWNS = [
  { id: "date", label: "일별", keyOf: (r: AdRow) => r.date },
  { id: "campaign", label: "캠페인", keyOf: (r: AdRow) => r.campaign },
  { id: "adGroup", label: "광고그룹", keyOf: (r: AdRow) => r.adGroup },
] as const;
type BreakdownId = (typeof BREAKDOWNS)[number]["id"];
type BreakdownDef = (typeof BREAKDOWNS)[number];

/** 일별 보고서이거나 캠페인·광고그룹이 여러 개일 때만 나눠 볼 수 있다 */
const availableBreakdowns = (rows: AdRow[]): BreakdownDef[] => BREAKDOWNS.filter((b) => new Set(rows.map(b.keyOf).filter(Boolean)).size > 1);

function Breakdown({ rows, available, breakEvenOf, costMultiplier }: { rows: AdRow[]; available: BreakdownDef[]; breakEvenOf: BreakEvenOf; costMultiplier: number }) {
  const [view, setView] = useState<BreakdownId | null>(null);
  const active = available.find((b) => b.id === view) ?? available[0];
  const groups = useMemo(() => {
    if (!active) return [];
    const list = groupRows(
      rows.filter((r) => active.keyOf(r)),
      active.keyOf,
      breakEvenOf,
      costMultiplier,
    );
    return active.id === "date" ? list.sort((a, b) => a.key.localeCompare(b.key)) : list;
  }, [rows, active, breakEvenOf, costMultiplier]);
  if (!active) return null;
  const maxCost = Math.max(1, ...groups.map((g) => g.metrics.cost));

  return (
    <Panel>
      <SectionHeader title={`${active.label}별 성과`} actions={available.length > 1 && <Tabs tabs={available} value={active.id} onChange={setView} />} />
      <DataTable>
        <TableHead>
          <tr>
            <th className={th("left")}>{active.label}</th>
            <th className={th()}>광고비</th>
            <th className={th()}>매출</th>
            <th className={th()}>ROAS</th>
            <th className={th()}>남긴 돈</th>
            <th className={th()}>주문</th>
            <th className={th()}>클릭률</th>
            <th className={th()}>전환율</th>
          </tr>
        </TableHead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-t border-stone-100">
              <td className={`${td("max-w-64")}`}>
                <p className="truncate font-medium text-stone-800" title={g.key}>
                  {g.key}
                </p>
                <div className="mt-1 h-1 rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(g.metrics.cost / maxCost) * 100}%` }} />
                </div>
              </td>
              <td className={`${td()} text-right tabular-nums`}>{won(g.metrics.cost)}</td>
              <td className={`${td()} text-right tabular-nums`}>{won(g.metrics.revenue)}</td>
              <td className={`${td()} text-right font-semibold tabular-nums ${g.metrics.roas !== null && g.breakEven ? (g.metrics.roas >= g.breakEven ? "text-emerald-600" : "text-rose-600") : ""}`}>
                {roasText(g.metrics.roas)}
              </td>
              <td className={`${td()} text-right tabular-nums ${(g.profit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{profitText(g.profit)}</td>
              <td className={`${td()} text-right tabular-nums`}>{num(g.metrics.orders)}</td>
              <td className={`${td()} text-right tabular-nums`}>{rateText(g.metrics.ctr, 2)}</td>
              <td className={`${td()} text-right tabular-nums`}>{rateText(g.metrics.cvr)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </Panel>
  );
}
