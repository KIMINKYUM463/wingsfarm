/**
 * 광고 조치 전후 비교 (순수 함수)
 * - 실행 계획에서 "실행했어요"를 누르면 대상 키워드·상품의 이번 보고서 성과를 기준값으로 저장한다.
 * - 조치일 이후 기간의 보고서를 올리면 같은 대상의 "하루 평균" 성과를 비교한다 (보고서마다 기간 길이가 달라서).
 * - 손익분기·부가세 배율은 기록 당시 값을 전후 양쪽에 똑같이 써서, 설정을 바꿔도 조치 효과만 비교되게 한다.
 */
import { adProfit, effectiveBreakEven, summarize, type AdRow, type BreakEvenOf } from "./coupangAds.ts";
import { productKeyOf, type AdAction, type ReportPeriod } from "./adInsights.ts";

export const FOLLOWUP_KINDS = ["exclude", "products", "cut", "scale", "rising"] as const;
export type FollowupKind = (typeof FOLLOWUP_KINDS)[number];
type Scope = "keyword" | "product";

/** focus: 이 조치에서 가장 먼저 봐야 할 지표 */
export const FOLLOWUP_META: Record<FollowupKind, { label: string; scope: Scope; goal: string; focus: "cost" | "roas" | "revenue" }> = {
  exclude: { label: "제외 키워드 등록", scope: "keyword", goal: "이 키워드에 나가던 광고비가 0에 가까워져야 해요", focus: "cost" },
  products: { label: "손해 상품 광고 줄이기", scope: "product", goal: "손실이 줄거나 이익으로 돌아서야 해요", focus: "cost" },
  cut: { label: "적자 키워드 입찰가 낮추기", scope: "keyword", goal: "ROAS가 손익분기 위로 올라와야 해요", focus: "roas" },
  scale: { label: "효자 키워드 입찰가 올리기", scope: "keyword", goal: "매출과 남긴 돈이 함께 늘어야 해요", focus: "revenue" },
  rising: { label: "숨은 효자 상품 예산 늘리기", scope: "product", goal: "매출과 남긴 돈이 함께 늘어야 해요", focus: "revenue" },
};

export const isFollowupKind = (id: string): id is FollowupKind => (FOLLOWUP_KINDS as readonly string[]).includes(id);

const SCOPE_KEY: Record<Scope, (r: AdRow) => string> = { keyword: (r) => r.keyword, product: productKeyOf };
const HAS_SCOPE: Record<Scope, (r: AdRow) => boolean> = { keyword: (r) => Boolean(r.keyword), product: (r) => Boolean(r.product) };

interface Totals {
  /** 부가세 미포함 광고비 */
  cost: number;
  revenue: number;
  orders: number;
  clicks: number;
}

export interface FollowupItem extends Totals {
  key: string;
  /** 기록 당시 이 대상의 손익분기 ROAS (%) */
  breakEven: number | null;
}

export interface AdFollowup {
  id: string;
  kind: FollowupKind;
  /** 조치한 날 (YYYY-MM-DD) — 이날부터가 "조치 후" */
  doneAt: string;
  /** 기준값을 잰 보고서 기간 */
  baseline: ReportPeriod;
  costMultiplier: number;
  items: FollowupItem[];
}

/** 대상이 아주 많아도 저장 공간이 커지지 않게 */
const MAX_ITEMS = 200;
const MAX_FOLLOWUPS = 50;

function rowsByKey(rows: AdRow[], scope: Scope, keys: ReadonlySet<string>) {
  const keyOf = SCOPE_KEY[scope];
  const map = new Map<string, AdRow[]>();
  for (const r of rows) {
    const key = keyOf(r);
    if (!keys.has(key)) continue;
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  return map;
}

const totalsOf = (rows: AdRow[]): Totals => {
  const { cost, revenue, orders, clicks } = summarize(rows);
  return { cost, revenue, orders, clicks };
};

export interface FollowupInput {
  rows: AdRow[];
  period: ReportPeriod | null;
  breakEvenOf: BreakEvenOf;
  costMultiplier: number;
  doneAt: string;
  id: string;
}

/** 실행 계획 항목 → 조치 기록 (비교할 수 없는 항목이면 null) */
export function createFollowup(action: AdAction, { rows, period, breakEvenOf, costMultiplier, doneAt, id }: FollowupInput): AdFollowup | null {
  if (!isFollowupKind(action.id) || !action.targets?.length || !period) return null;
  const keys = action.targets.slice(0, MAX_ITEMS);
  const byKey = rowsByKey(rows, FOLLOWUP_META[action.id].scope, new Set(keys));
  const items = keys.flatMap((key) => {
    const list = byKey.get(key);
    return list ? [{ key, ...totalsOf(list), breakEven: effectiveBreakEven(list, breakEvenOf) }] : [];
  });
  return items.length ? { id, kind: action.id, doneAt, baseline: period, costMultiplier, items } : null;
}

/** 같은 보고서·같은 조치를 다시 기록하면 교체, 최근 것부터 MAX_FOLLOWUPS개 */
export function withFollowup(list: AdFollowup[], f: AdFollowup) {
  const others = list.filter((x) => !(x.kind === f.kind && samePeriod(x.baseline, f.baseline)));
  return [f, ...others].slice(0, MAX_FOLLOWUPS);
}

export const samePeriod = (a: ReportPeriod, b: ReportPeriod) => a.from === b.from && a.to === b.to;

/* ───────────── 비교 ───────────── */

export interface DailyStats {
  cost: number;
  revenue: number;
  orders: number;
  roas: number | null;
  /** 하루 남긴 돈(추정) */
  profit: number | null;
}

function daily(items: (Totals & { breakEven: number | null })[], days: number, costMultiplier: number): DailyStats {
  let cost = 0;
  let revenue = 0;
  let orders = 0;
  let profit = 0;
  let known = false;
  for (const it of items) {
    cost += it.cost * costMultiplier;
    revenue += it.revenue;
    orders += it.orders;
    if (it.breakEven && it.breakEven > 0) {
      known = true;
      profit += (it.revenue * 100) / it.breakEven - it.cost * costMultiplier;
    }
  }
  return { cost: cost / days, revenue: revenue / days, orders: orders / days, roas: cost > 0 ? (revenue / cost) * 100 : null, profit: known ? profit / days : null };
}

/**
 * - waiting: 조치 전 기간이거나 기준과 같은 보고서 → 다음 보고서를 기다린다
 * - unsupported: 이 보고서엔 키워드(또는 상품) 열이 없어 비교할 수 없다
 * - partial: 조치 전 날짜가 일부 섞인 보고서 → 효과가 덜 보인다
 * - ready: 조치 후 기간만 담긴 보고서
 */
export type FollowupStatus = "waiting" | "unsupported" | "partial" | "ready";
export type FollowupVerdict = "better" | "flat" | "worse";

export interface FollowupResult {
  status: FollowupStatus;
  before: DailyStats;
  after: DailyStats | null;
  /** 하루 남긴 돈 변화 (조치 후 − 조치 전) */
  profitDelta: number | null;
  verdict: FollowupVerdict | null;
  /** 새 보고서에 다시 나타난 대상 수 */
  matched: number;
}

/** 하루 광고비의 3%(최소 100원)보다 작은 변화는 "변화 없음" */
const FLAT_SHARE = 0.03;
const FLAT_MIN = 100;

const verdictOf = (delta: number | null, before: DailyStats): FollowupVerdict | null =>
  delta === null ? null : Math.abs(delta) < Math.max(FLAT_MIN, before.cost * FLAT_SHARE) ? "flat" : delta > 0 ? "better" : "worse";

export function followupStatus(f: AdFollowup, rows: AdRow[], period: ReportPeriod | null): FollowupStatus {
  if (!period || period.to < f.doneAt || samePeriod(period, f.baseline)) return "waiting";
  if (!rows.some(HAS_SCOPE[FOLLOWUP_META[f.kind].scope])) return "unsupported";
  return period.from >= f.doneAt ? "ready" : "partial";
}

export function evaluateFollowup(f: AdFollowup, rows: AdRow[], period: ReportPeriod | null): FollowupResult {
  const before = daily(f.items, f.baseline.days, f.costMultiplier);
  const status = followupStatus(f, rows, period);
  if (!period || status === "waiting" || status === "unsupported") return { status, before, after: null, profitDelta: null, verdict: null, matched: 0 };

  // 대상이 새 보고서에 없으면 광고비·매출 모두 0 (제외 키워드라면 바라던 결과)
  const byKey = rowsByKey(rows, FOLLOWUP_META[f.kind].scope, new Set(f.items.map((it) => it.key)));
  const after = daily(
    f.items.map((it) => ({ ...totalsOf(byKey.get(it.key) ?? []), breakEven: it.breakEven })),
    period.days,
    f.costMultiplier,
  );
  const profitDelta = before.profit === null || after.profit === null ? null : after.profit - before.profit;
  return { status, before, after, profitDelta, verdict: verdictOf(profitDelta, before), matched: byKey.size };
}

/* ───────────── 보고서 기록 (추이) ───────────── */

export interface AdReportSnapshot extends ReportPeriod {
  /** 부가세 미포함 광고비 — 화면의 부가세 설정에 따라 다시 곱한다 */
  cost: number;
  revenue: number;
  orders: number;
  /** 광고비를 빼기 전 이익(추정) = Σ 매출 ÷ 손익분기 ROAS */
  gross: number | null;
}

const MAX_REPORTS = 24;

export function reportSnapshot(rows: AdRow[], period: ReportPeriod | null, breakEvenOf: BreakEvenOf): AdReportSnapshot | null {
  if (!period || !rows.length) return null;
  const { cost, revenue, orders } = summarize(rows);
  return { ...period, cost, revenue, orders, gross: adProfit(rows, breakEvenOf, 0) };
}

/** 같은 기간은 교체, 기간 순으로 최근 MAX_REPORTS개 */
export const withReport = (list: AdReportSnapshot[], s: AdReportSnapshot) =>
  [...list.filter((x) => !samePeriod(x, s)), s].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)).slice(-MAX_REPORTS);

export function snapshotDaily(s: AdReportSnapshot, costMultiplier: number): DailyStats {
  const cost = s.cost * costMultiplier;
  return {
    cost: cost / s.days,
    revenue: s.revenue / s.days,
    orders: s.orders / s.days,
    roas: cost > 0 ? (s.revenue / cost) * 100 : null,
    profit: s.gross === null ? null : (s.gross - cost) / s.days,
  };
}
