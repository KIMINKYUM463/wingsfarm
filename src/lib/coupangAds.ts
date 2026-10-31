/**
 * 쿠팡 광고 분석 — 광고센터 "광고 보고서"(엑셀) → 지표·손익분기 ROAS 비교·키워드 진단.
 * 쿠팡은 판매자 광고 데이터 API를 열어 두지 않아 파일만 다룬다. 실제 주문 매출은 coupangWing.ts(윙 Open API).
 */
import type { Channel, CostDefaults, Sku } from "@/types";
import { buildSkuInput, calcMargin } from "./margin.ts";
import { matchSku } from "./orders.ts";
import { findHeaderRowBy, matchColumns, normalizeHeader } from "./table.ts";

/** 보고서 열 — 같은 지표가 1일·14일 기준으로 둘 다 있으면 14일(쿠팡 광고센터 기본)을 먼저 잡는다 */
export const AD_FIELDS = [
  { field: "date", label: "날짜", synonyms: ["날짜", "일자", "기간"] },
  { field: "campaign", label: "캠페인", synonyms: ["캠페인명", "캠페인"] },
  { field: "adGroup", label: "광고그룹", synonyms: ["광고그룹명", "광고그룹"] },
  { field: "product", label: "광고 상품", synonyms: ["광고집행상품명", "광고전환매출발생상품명", "상품명"] },
  { field: "keyword", label: "키워드", synonyms: ["키워드", "검색키워드", "검색어"] },
  { field: "placement", label: "노출 지면", synonyms: ["광고노출지면", "노출지면", "지면"] },
  { field: "impressions", label: "노출수", required: true, synonyms: ["노출수"] },
  { field: "clicks", label: "클릭수", required: true, synonyms: ["클릭수"] },
  { field: "cost", label: "광고비", required: true, synonyms: ["광고비", "집행광고비", "광고비용"] },
  { field: "orders", label: "주문수", synonyms: ["총주문수14일", "총주문수1일", "총주문수", "주문수"] },
  { field: "revenue", label: "전환매출", required: true, synonyms: ["총전환매출액14일", "총전환매출액1일", "총전환매출액", "전환매출액", "광고전환매출", "매출액"] },
] as const satisfies readonly { field: string; label: string; required?: boolean; synonyms: string[] }[];

export type AdField = (typeof AD_FIELDS)[number]["field"];
export type AdMapping = Partial<Record<AdField, number>>;

export interface AdRow {
  date: string;
  campaign: string;
  adGroup: string;
  product: string;
  keyword: string;
  placement: string;
  impressions: number;
  clicks: number;
  cost: number;
  orders: number;
  revenue: number;
}

export interface AdMetrics {
  impressions: number;
  clicks: number;
  cost: number;
  orders: number;
  revenue: number;
  /** 클릭률 (0~1) */
  ctr: number | null;
  /** 클릭당 비용 (원) */
  cpc: number | null;
  /** 전환율 = 주문 ÷ 클릭 (0~1) */
  cvr: number | null;
  /** 광고 매출 ÷ 광고비 × 100 (%) */
  roas: number | null;
}

/** 키워드가 비어 있는 줄 = 검색이 아닌 지면(상품 상세·추천 영역 등)에 노출된 광고 */
export const NON_SEARCH = "(비검색 영역)";

const toNum = (value: string | undefined) => {
  const n = Number(String(value ?? "").replace(/[,원%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const SUMMARY_ROW = /^(합계|총계|전체|total)$/i;

export const detectAdMapping = (headers: string[]): AdMapping => matchColumns(headers, AD_FIELDS);

export const missingAdFields = (mapping: AdMapping) => AD_FIELDS.filter((f) => "required" in f && f.required && mapping[f.field] === undefined);

/** 1일·14일 중 어떤 전환 기준으로 읽었는지 (머리글에서) */
export function attributionWindow(headers: string[], mapping: AdMapping) {
  const header = mapping.revenue === undefined ? "" : normalizeHeader(headers[mapping.revenue] ?? "");
  return header.includes("14일") ? "14일" : header.includes("1일") ? "1일" : null;
}

/** 보고서 표 → 광고 줄 (머리글 자동 찾기, 합계·빈 줄 제외) */
export function parseAdReport(table: string[][]) {
  const headerRow = findHeaderRowBy(table, (row) => Object.keys(detectAdMapping(row)).length, 10);
  const headers = table[headerRow] ?? [];
  const mapping = detectAdMapping(headers);
  const missing = missingAdFields(mapping);
  const text = (row: string[], field: AdField) => (mapping[field] === undefined ? "" : String(row[mapping[field]!] ?? "").trim());
  const value = (row: string[], field: AdField) => (mapping[field] === undefined ? 0 : toNum(row[mapping[field]!]));

  const rows: AdRow[] = missing.length
    ? []
    : table
        .slice(headerRow + 1)
        .map((row) => ({
          date: text(row, "date"),
          campaign: text(row, "campaign"),
          adGroup: text(row, "adGroup"),
          product: text(row, "product"),
          keyword: text(row, "keyword").replace(/^-$/, ""),
          placement: text(row, "placement"),
          impressions: value(row, "impressions"),
          clicks: value(row, "clicks"),
          cost: value(row, "cost"),
          orders: value(row, "orders"),
          revenue: value(row, "revenue"),
        }))
        .filter((r) => ![r.date, r.campaign, r.product].some((t) => SUMMARY_ROW.test(t)))
        .filter((r) => r.impressions || r.clicks || r.cost || r.revenue);

  return { rows, mapping, missing, window: attributionWindow(headers, mapping) };
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export function summarize(rows: AdRow[], costMultiplier = 1): AdMetrics {
  const t = rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      cost: acc.cost + r.cost * costMultiplier,
      orders: acc.orders + r.orders,
      revenue: acc.revenue + r.revenue,
    }),
    { impressions: 0, clicks: 0, cost: 0, orders: 0, revenue: 0 },
  );
  const roas = ratio(t.revenue, t.cost);
  return { ...t, ctr: ratio(t.clicks, t.impressions), cpc: ratio(t.cost, t.clicks), cvr: ratio(t.orders, t.clicks), roas: roas === null ? null : roas * 100 };
}

export interface AdGroup {
  key: string;
  metrics: AdMetrics;
  /** 이 묶음에 적용한 손익분기 ROAS (%) */
  breakEven: number | null;
  verdict: Verdict;
}

/**
 * 진단
 * - exclude: 클릭이 충분한데 주문 0 → 제외 키워드 후보
 * - cut: 손익분기 ROAS 미달 → 입찰가 낮추기
 * - scale: 손익분기의 1.3배 이상 + 주문 2건 이상 → 입찰가 올리기
 * - watch: 클릭이 아직 적어 판단 보류
 */
export type Verdict = "exclude" | "cut" | "ok" | "scale" | "watch";

export const VERDICT_META: Record<Verdict, { label: string; tone: "loss" | "warn" | "default" | "good" | "info"; action: string }> = {
  exclude: { label: "제외 후보", tone: "loss", action: "제외 키워드로 등록" },
  cut: { label: "적자", tone: "warn", action: "입찰가 낮추기" },
  ok: { label: "유지", tone: "default", action: "그대로 유지" },
  scale: { label: "효자", tone: "good", action: "입찰가 올리기" },
  watch: { label: "지켜보기", tone: "info", action: "데이터가 더 쌓일 때까지 대기" },
};

export const SCALE_MULTIPLIER = 1.3;

export function verdictOf(m: AdMetrics, breakEven: number | null, minClicks = 10): Verdict {
  if (m.orders === 0) return m.clicks >= minClicks ? "exclude" : "watch";
  if (breakEven === null || m.roas === null) return "ok";
  if (m.roas < breakEven) return "cut";
  if (m.roas >= breakEven * SCALE_MULTIPLIER && m.orders >= 2) return "scale";
  return "ok";
}

/**
 * 묶어서 지표·진단 (광고비 많은 순)
 * @param breakEvenOf 줄마다의 손익분기 ROAS — 묶음에는 광고비를 가장 많이 쓴 줄의 값을 쓴다
 */
export function groupRows(rows: AdRow[], keyOf: (r: AdRow) => string, breakEvenOf: (r: AdRow) => number | null, costMultiplier = 1, minClicks = 10): AdGroup[] {
  const groups = new Map<string, AdRow[]>();
  for (const r of rows) {
    const key = keyOf(r);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups]
    .map(([key, list]) => {
      const metrics = summarize(list, costMultiplier);
      const top = list.reduce((a, b) => (b.cost > a.cost ? b : a));
      const breakEven = breakEvenOf(top);
      return { key, metrics, breakEven, verdict: verdictOf(metrics, breakEven, minClicks) };
    })
    .sort((a, b) => b.metrics.cost - a.metrics.cost);
}

export const keywordOf = (r: AdRow) => r.keyword || NON_SEARCH;

/**
 * 상품의 손익분기 ROAS — 마진 계산기에 등록한 상품(쿠팡 판매가가 있을 때)으로 계산.
 * 광고비를 뺀 이익 기준이라 광고비율은 0으로 둔다.
 */
export function productBreakEven(productName: string, skus: Sku[], channel: Channel | undefined, defaults: CostDefaults) {
  if (!channel || !productName) return null;
  const sku = matchSku({ productName, optionName: "", skuCode: "" }, skus);
  const price = sku?.listings[channel.id];
  if (!sku || !price) return null;
  const roas = calcMargin({ ...buildSkuInput(sku, channel, { ...defaults, adRate: 0 }), salePrice: price }).breakEvenRoas;
  return roas === null ? null : { sku, roas };
}

/** 판정별 광고비 합계 — "광고비의 몇 %가 주문 없는 키워드에 나갔나" */
export function spendByVerdict(groups: AdGroup[]) {
  const spend: Record<Verdict, number> = { exclude: 0, cut: 0, ok: 0, scale: 0, watch: 0 };
  for (const g of groups) spend[g.verdict] += g.metrics.cost;
  return spend;
}
