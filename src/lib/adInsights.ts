/**
 * 쿠팡 광고 보고서 심층 분석 (순수 함수) — 지면·상품·키워드·고객 행동을 보고 "무엇을 하면 얼마가 남는지"까지 계산한다.
 * 모든 이익은 손익분기 ROAS(= 광고 전 이익률의 역수)로 추정한 값이다.
 */
import { effectiveBreakEven, adProfit, groupRows, summarize, type AdField, type AdGroup, type AdMetrics, type AdRow, type BreakEvenOf } from "./coupangAds.ts";
import { toIsoDate } from "./coupangWing.ts";
import { percent, won } from "./format.ts";

export interface AnalysisContext {
  breakEvenOf: BreakEvenOf;
  /** 광고비 배율 (부가세 포함이면 1.1) */
  costMultiplier: number;
  /** 주문 없이 이만큼 클릭되면 제외 후보 */
  minClicks: number;
}

const DAY_MS = 86_400_000;
const sumOf = <T>(items: T[], pick: (item: T) => number) => items.reduce((acc, item) => acc + pick(item), 0);
const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
const group = (rows: AdRow[], keyOf: (r: AdRow) => string, ctx: AnalysisContext) => groupRows(rows, keyOf, ctx.breakEvenOf, ctx.costMultiplier, ctx.minClicks);

/* ───────────── 기간 ───────────── */

export interface ReportPeriod {
  from: string;
  to: string;
  days: number;
}

/** 일별 보고서는 날짜 열, 기간 합계 보고서는 파일 이름(…_20261012_20261102.xlsx)에서 기간을 읽는다 */
export function reportPeriod(rows: AdRow[], fileName: string): ReportPeriod | null {
  const fromRows = rows.flatMap((r) => toIsoDate(r.date) ?? []).sort();
  // 파일 이름 앞의 업체코드(A01760253)도 8자리라, 20xx로 시작하는 날짜만 고른다
  const fromName = (fileName.match(/(?<!\d)20\d{6}(?!\d)/g) ?? []).flatMap((s) => toIsoDate(s) ?? []).slice(-2);
  const dates = fromRows.length ? fromRows : fromName;
  const from = dates[0];
  const to = dates.at(-1);
  if (!from || !to || from > to) return null;
  return { from, to, days: Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1 };
}

/** 보고서 기간 금액 → 30일 환산 */
export const perMonth = (value: number, period: ReportPeriod | null) => (period ? (value * 30) / period.days : null);

/* ───────────── 전체 ───────────── */

export type Grade = "A" | "B" | "C" | "D";

export const GRADE_META: Record<Grade, { label: string; hint: string }> = {
  A: { label: "잘 남는 광고", hint: "손익분기의 1.5배 이상 — 예산을 늘려도 되는 상태" },
  B: { label: "양호", hint: "손익분기보다 15% 이상 높아요 — 새는 곳만 막으면 돼요" },
  C: { label: "본전 근처", hint: "광고비를 빼면 거의 남지 않아요 — 낭비 키워드부터 정리" },
  D: { label: "적자 광고", hint: "광고할수록 손해 — 아래 실행 계획을 바로 적용하세요" },
};

export function gradeOf(roas: number | null, breakEven: number | null): Grade | null {
  if (roas === null || !breakEven) return null;
  const ratio = roas / breakEven;
  return ratio >= 1.5 ? "A" : ratio >= 1.15 ? "B" : ratio >= 1 ? "C" : "D";
}

export interface Overview {
  metrics: AdMetrics;
  breakEven: number | null;
  profit: number | null;
  grade: Grade | null;
  /** 주문 1건 경제학 */
  aov: number | null;
  cpa: number | null;
  /** 주문 1건의 광고 전 이익 */
  grossPerOrder: number | null;
  unitsPerOrder: number | null;
  campaigns: string[];
  adTypes: string[];
}

export function overview(rows: AdRow[], ctx: AnalysisContext, fields: AdField[]): Overview {
  const metrics = summarize(rows, ctx.costMultiplier);
  const breakEven = effectiveBreakEven(rows, ctx.breakEvenOf);
  const perOrder = (value: number) => (metrics.orders > 0 ? value / metrics.orders : null);
  const aov = perOrder(metrics.revenue);
  const distinct = (pick: (r: AdRow) => string) => [...new Set(rows.map(pick).filter(Boolean))];
  return {
    metrics,
    breakEven,
    profit: adProfit(rows, ctx.breakEvenOf, ctx.costMultiplier),
    grade: gradeOf(metrics.roas, breakEven),
    aov,
    cpa: perOrder(metrics.cost),
    grossPerOrder: aov !== null && breakEven ? (aov * 100) / breakEven : null,
    unitsPerOrder: fields.includes("units") ? perOrder(sumOf(rows, (r) => r.units)) : null,
    campaigns: distinct((r) => r.campaign),
    adTypes: distinct((r) => r.adType),
  };
}

/* ───────────── 노출 지면 ───────────── */

export type PlacementKind = "search" | "nonSearch" | "external" | "other";

export const PLACEMENT_META: Record<PlacementKind, { label: string; hint: string }> = {
  search: { label: "검색 영역", hint: "고객이 검색한 결과에 노출 — 살 마음이 있는 고객" },
  nonSearch: { label: "비검색 영역", hint: "상품 상세·장바구니·추천 영역 — 둘러보는 고객" },
  external: { label: "외부 채널", hint: "오디언스 플러스 — 쿠팡 밖 사이트·앱에서 데려오는 고객" },
  other: { label: "기타 지면", hint: "보고서에 적힌 지면 이름 그대로" },
};

export function placementKind(r: AdRow): PlacementKind {
  const p = r.placement;
  if (!p) return r.keyword ? "search" : "nonSearch";
  if (/외부|오디언스/.test(p)) return "external";
  if (p.includes("비검색")) return "nonSearch";
  return p.includes("검색") ? "search" : "other";
}

export interface ShareGroup extends AdGroup {
  costShare: number;
  revenueShare: number;
}

function withShares(groups: AdGroup[]): ShareGroup[] {
  const cost = sumOf(groups, (g) => g.metrics.cost);
  const revenue = sumOf(groups, (g) => g.metrics.revenue);
  return groups.map((g) => ({ ...g, costShare: share(g.metrics.cost, cost), revenueShare: share(g.metrics.revenue, revenue) }));
}

export interface PlacementStat extends ShareGroup {
  kind: PlacementKind;
}

export const placementBreakdown = (rows: AdRow[], ctx: AnalysisContext): PlacementStat[] =>
  withShares(group(rows, placementKind, ctx)).map((g) => ({ ...g, kind: g.key as PlacementKind }));

/* ───────────── 상품 포트폴리오 ───────────── */

/** 쿠팡 상품명 "기본 이름,1박스,1박스,대 1kg,대 1kg" → 기본 이름 + 옵션 */
export function splitProductName(name: string) {
  const [base, ...rest] = name.split(",").map((s) => s.trim());
  return { base: base || name, option: [...new Set(rest.filter(Boolean))].join(" · ") };
}

/** 상품 포트폴리오의 묶음 기준 — 옵션을 뗀 기본 이름 */
export const productKeyOf = (r: AdRow) => splitProductName(r.product || "(상품명 없음)").base;

export type Quadrant = "star" | "rising" | "leak" | "drain";

export const QUADRANT_META: Record<Quadrant, { label: string; hint: string; tone: "good" | "info" | "loss" | "warn" }> = {
  star: { label: "주력 효자", hint: "광고비를 많이 쓰고도 남아요 — 예산 유지·확대", tone: "good" },
  rising: { label: "숨은 효자", hint: "적게 쓰는데 남아요 — 예산을 늘려 볼 후보", tone: "info" },
  leak: { label: "새는 곳", hint: "광고비를 많이 쓰는데 손해 — 가장 먼저 손볼 상품", tone: "loss" },
  drain: { label: "정리 후보", hint: "적게 쓰지만 손해 — 광고 끄기·판매가 점검", tone: "warn" },
};

/** 이보다 클릭이 적으면 판단 근거가 약하다 */
export const MIN_PRODUCT_CLICKS = 30;

export interface OptionStat extends AdGroup {
  option: string;
}

export interface ProductStat extends ShareGroup {
  quadrant: Quadrant;
  lowData: boolean;
  options: OptionStat[];
}

export function productPortfolio(rows: AdRow[], ctx: AnalysisContext): ProductStat[] {
  const groups = withShares(group(rows, productKeyOf, ctx));
  const averageCost = share(sumOf(groups, (g) => g.metrics.cost), groups.length);
  return groups.map((g) => {
    const profitable = (g.profit ?? 0) >= 0;
    const heavy = g.metrics.cost >= averageCost;
    return {
      ...g,
      quadrant: heavy ? (profitable ? "star" : "leak") : profitable ? "rising" : "drain",
      lowData: g.metrics.clicks < MIN_PRODUCT_CLICKS,
      options: group(g.rows, (r) => r.product, ctx).map((o) => ({ ...o, option: splitProductName(o.key).option || "단일 옵션" })),
    };
  });
}

/* ───────────── 키워드 ───────────── */

export const KEYWORD_LENGTHS = [
  { id: "1", label: "한 단어", example: "무" },
  { id: "2", label: "두 단어", example: "국산 무" },
  { id: "3", label: "세 단어 이상", example: "국산 김장무 10kg" },
] as const;

export type KeywordLength = (typeof KEYWORD_LENGTHS)[number]["id"];

const lengthOf = (keyword: string): KeywordLength => {
  const words = keyword.trim().split(/\s+/).length;
  return words >= 3 ? "3" : words === 2 ? "2" : "1";
};

export interface KeywordInsights {
  groups: AdGroup[];
  metrics: AdMetrics;
  /** 주문이 한 건도 없는 키워드 전체 */
  noOrder: { count: number; cost: number };
  exclude: AdGroup[];
  cut: AdGroup[];
  scale: AdGroup[];
  converting: number;
  /** 광고비 상위 10개 키워드가 쓴 비중 */
  top10CostShare: number;
  /** 키워드 매출의 80%를 만드는 키워드 수 */
  revenue80Count: number;
  lengths: (ShareGroup & { id: KeywordLength })[];
}

export function keywordInsights(rows: AdRow[], ctx: AnalysisContext): KeywordInsights | null {
  const search = rows.filter((r) => r.keyword);
  if (!search.length) return null;
  const groups = group(search, (r) => r.keyword, ctx);
  const metrics = summarize(search, ctx.costMultiplier);
  const noOrder = groups.filter((g) => g.metrics.orders === 0);

  let covered = 0;
  let revenue80Count = 0;
  for (const g of [...groups].sort((a, b) => b.metrics.revenue - a.metrics.revenue)) {
    if (covered >= metrics.revenue * 0.8 || g.metrics.revenue <= 0) break;
    covered += g.metrics.revenue;
    revenue80Count++;
  }

  const lengths = withShares(group(search, (r) => lengthOf(r.keyword), ctx));
  return {
    groups,
    metrics,
    noOrder: { count: noOrder.length, cost: sumOf(noOrder, (g) => g.metrics.cost) },
    exclude: groups.filter((g) => g.verdict === "exclude"),
    cut: groups.filter((g) => g.verdict === "cut"),
    scale: groups.filter((g) => g.verdict === "scale"),
    converting: groups.length - noOrder.length,
    top10CostShare: share(sumOf(groups.slice(0, 10), (g) => g.metrics.cost), metrics.cost),
    revenue80Count,
    lengths: KEYWORD_LENGTHS.flatMap((l) => lengths.find((g) => g.key === l.id) ?? []).map((g) => ({ ...g, id: g.key as KeywordLength })),
  };
}

/* ───────────── 고객 행동 ───────────── */

export interface CrossSellPair {
  base: string;
  from: string;
  to: string;
  sameProduct: boolean;
  revenue: number;
  orders: number;
}

export interface CrossSell {
  revenue: number;
  share: number;
  /** 같은 상품의 다른 옵션을 산 매출 */
  optionSwitch: number;
  /** 아예 다른 상품을 산 매출 */
  otherProduct: number;
  pairs: CrossSellPair[];
}

/** 광고한 상품과 실제로 팔린 상품이 다른 매출 */
export function crossSell(rows: AdRow[], fields: AdField[], limit = 6): CrossSell | null {
  if (!fields.includes("convProduct")) return null;
  const total = sumOf(rows, (r) => r.revenue);
  const pairs = new Map<string, CrossSellPair>();
  for (const r of rows) {
    if (!r.convProduct || r.convProduct === r.product || r.revenue <= 0) continue;
    const from = splitProductName(r.product);
    const to = splitProductName(r.convProduct);
    const key = `${r.product}\n${r.convProduct}`;
    const pair = pairs.get(key) ?? {
      base: from.base,
      from: from.option || from.base,
      to: from.base === to.base ? to.option || to.base : to.base,
      sameProduct: from.base === to.base,
      revenue: 0,
      orders: 0,
    };
    pair.revenue += r.revenue;
    pair.orders += r.orders;
    pairs.set(key, pair);
  }
  const list = [...pairs.values()].sort((a, b) => b.revenue - a.revenue);
  const revenue = sumOf(list, (p) => p.revenue);
  const optionSwitch = sumOf(list.filter((p) => p.sameProduct), (p) => p.revenue);
  return { revenue, share: share(revenue, total), optionSwitch, otherProduct: revenue - optionSwitch, pairs: list.slice(0, limit) };
}

export interface ConversionTiming {
  /** 14일 매출 중 클릭 다음 날까지 난 비중 */
  sameDayShare: number | null;
  /** 쿠팡이 "직접 전환"으로 분류한 매출 비중 */
  directShare: number | null;
}

export function conversionTiming(rows: AdRow[], fields: AdField[]): ConversionTiming {
  const revenue = sumOf(rows, (r) => r.revenue);
  const ratio = (field: "revenue1d" | "directRevenue") => (fields.includes(field) && revenue > 0 ? Math.min(1, sumOf(rows, (r) => r[field]) / revenue) : null);
  return { sameDayShare: ratio("revenue1d"), directShare: ratio("directRevenue") };
}

/* ───────────── 실행 계획 ───────────── */

export type ActionTone = "loss" | "warn" | "good" | "info";

export interface AdAction {
  id: string;
  tone: ActionTone;
  title: string;
  detail: string;
  /** 보고서 기간 기준 금액 (아끼는 광고비 또는 지키는 이익) */
  impact: number | null;
  impactLabel?: string;
  items?: string[];
  copy?: { label: string; text: string };
  /** 조치 대상 키워드·상품(기본 이름) 전체 — 조치 전후 비교의 기준이 된다 */
  targets?: string[];
}

const TONE_ORDER: Record<ActionTone, number> = { loss: 0, warn: 1, good: 2, info: 3 };
const loss = (groups: AdGroup[]) => sumOf(groups, (g) => Math.max(0, -(g.profit ?? 0)));
const keysOf = (groups: AdGroup[]) => groups.map((g) => g.key);
const roasText = (g: AdGroup) => (g.metrics.roas === null ? "-" : `${Math.round(g.metrics.roas)}%`);

export interface ActionInput {
  overview: Overview;
  placements: PlacementStat[];
  products: ProductStat[];
  keywords: KeywordInsights | null;
  cross: CrossSell | null;
}

/** 손실을 막는 일 → 줄이는 일 → 키우는 일 순서, 같은 순서면 금액이 큰 것부터 */
export function actionPlan({ overview, placements, products, keywords, cross }: ActionInput): AdAction[] {
  const actions: AdAction[] = [];

  if (keywords?.exclude.length) {
    const cost = sumOf(keywords.exclude, (g) => g.metrics.cost);
    actions.push({
      id: "exclude",
      tone: "loss",
      title: `주문 0건 키워드 ${keywords.exclude.length}개를 제외 키워드로 등록`,
      detail: `클릭은 충분히 받았는데 한 건도 안 팔렸어요. 등록하면 이 광고비가 그대로 남아요.`,
      impact: cost,
      impactLabel: "아끼는 광고비",
      items: keywords.exclude.slice(0, 8).map((g) => `${g.key} · 클릭 ${g.metrics.clicks}회 · ${won(g.metrics.cost)}`),
      copy: { label: "제외 키워드 복사", text: keywords.exclude.map((g) => g.key).join("\n") },
      targets: keysOf(keywords.exclude),
    });
  }

  const losing = products.filter((p) => (p.quadrant === "leak" || p.quadrant === "drain") && !p.lowData);
  if (losing.length) {
    actions.push({
      id: "products",
      tone: "loss",
      title: `광고할수록 손해인 상품 ${losing.length}개 — 입찰가 낮추기 또는 광고 끄기`,
      detail: "광고 매출로 번 이익보다 광고비가 커요. 광고를 줄이기 전에 판매가·공급가(마진 계산기)도 함께 점검하세요.",
      impact: loss(losing),
      impactLabel: "막을 수 있는 손실",
      items: losing.slice(0, 6).map((p) => `${p.key} · ROAS ${roasText(p)} / 손익분기 ${p.breakEven ? Math.round(p.breakEven) : "-"}%`),
      targets: keysOf(losing),
    });
  }

  if (keywords?.cut.length) {
    actions.push({
      id: "cut",
      tone: "warn",
      title: `손익분기에 못 미치는 키워드 ${keywords.cut.length}개 — 입찰가 낮추기`,
      detail: "팔리긴 하지만 광고비만큼 못 벌어요. 입찰가를 10~20% 내리고 1~2주 뒤 다시 보세요.",
      impact: loss(keywords.cut),
      impactLabel: "막을 수 있는 손실",
      items: keywords.cut.slice(0, 6).map((g) => `${g.key} · ROAS ${roasText(g)}`),
      targets: keysOf(keywords.cut),
    });
  }

  const weakPlacement = placements.find((p) => p.costShare >= 0.1 && (p.profit ?? 0) < 0);
  if (weakPlacement) {
    const meta = PLACEMENT_META[weakPlacement.kind];
    actions.push({
      id: "placement",
      tone: "warn",
      title: `${meta.label}에서 손해 — 광고비의 ${percent(weakPlacement.costShare, 0)}가 여기서 나가요`,
      detail: `${meta.label} ROAS ${roasText(weakPlacement)}로 손익분기에 못 미쳐요. 매출 최적화 캠페인은 지면을 AI가 고르므로, 잘 팔리는 키워드는 수동 캠페인으로 옮겨 검색 영역 위주로 돌려 보세요.`,
      impact: Math.max(0, -(weakPlacement.profit ?? 0)),
      impactLabel: "이 지면의 손실",
    });
  }

  if (keywords?.scale.length) {
    actions.push({
      id: "scale",
      tone: "good",
      title: `효자 키워드 ${keywords.scale.length}개 — 입찰가 올려 노출 늘리기`,
      detail: "손익분기의 1.3배 넘게 벌고 주문도 2건 이상이에요. 입찰가를 10~20% 올리거나 수동 캠페인 키워드로 따로 관리하세요.",
      impact: sumOf(keywords.scale, (g) => Math.max(0, g.profit ?? 0)),
      impactLabel: "지금 남기는 이익",
      items: keywords.scale.slice(0, 6).map((g) => `${g.key} · ROAS ${roasText(g)} · 주문 ${g.metrics.orders}건`),
      copy: { label: "효자 키워드 복사", text: keywords.scale.map((g) => g.key).join("\n") },
      targets: keysOf(keywords.scale),
    });
  }

  const rising = products.filter((p) => p.quadrant === "rising" && !p.lowData && p.metrics.orders >= 2);
  if (rising.length) {
    actions.push({
      id: "rising",
      tone: "good",
      title: `숨은 효자 상품 ${rising.length}개 — 광고 예산 늘려 보기`,
      detail: "광고비는 적게 쓰는데 손익분기를 넘겨요. 노출을 늘리면 매출이 더 날 여지가 있어요.",
      impact: sumOf(rising, (p) => Math.max(0, p.profit ?? 0)),
      impactLabel: "지금 남기는 이익",
      items: rising.slice(0, 6).map((p) => `${p.key} · ROAS ${roasText(p)}`),
      targets: keysOf(rising),
    });
  }

  if (cross && cross.optionSwitch > 0 && share(cross.optionSwitch, overview.metrics.revenue) >= 0.05) {
    const top = cross.pairs.find((p) => p.sameProduct);
    actions.push({
      id: "option",
      tone: "info",
      title: `광고 매출의 ${percent(share(cross.optionSwitch, overview.metrics.revenue), 0)}는 다른 옵션으로 팔렸어요`,
      detail: top
        ? `예: ${top.base}의 "${top.from}" 광고를 보고 "${top.to}"를 샀어요. 실제로 팔리는 옵션을 대표 옵션·광고 상품으로 두면 전환율이 오를 수 있어요.`
        : "실제로 팔리는 옵션을 대표 옵션·광고 상품으로 두면 전환율이 오를 수 있어요.",
      impact: cross.optionSwitch,
      impactLabel: "다른 옵션 매출",
    });
  }

  return actions.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || (b.impact ?? 0) - (a.impact ?? 0));
}

/** 화면 한 번에 필요한 분석을 모두 계산 */
export function analyzeAdReport(rows: AdRow[], fields: AdField[], ctx: AnalysisContext) {
  const summary = overview(rows, ctx, fields);
  const placements = placementBreakdown(rows, ctx);
  const products = productPortfolio(rows, ctx);
  const keywords = keywordInsights(rows, ctx);
  const cross = crossSell(rows, fields);
  return {
    overview: summary,
    placements,
    products,
    keywords,
    cross,
    timing: conversionTiming(rows, fields),
    actions: actionPlan({ overview: summary, placements, products, keywords, cross }),
  };
}

export type AdAnalysis = ReturnType<typeof analyzeAdReport>;
