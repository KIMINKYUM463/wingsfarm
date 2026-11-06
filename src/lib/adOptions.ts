/**
 * 예전 광고분석기에만 있던 화면을 지금 보고서 구조에 맞게 다시 짠 계산.
 * 옵션 성적, 실제로 팔린 줄, 노출이 적은 효자(수동 입찰), 매출 0인데 상품명과 겹치는 키워드.
 */
import { groupRows, type AdGroup, type AdRow, type BreakEvenOf } from "./coupangAds.ts";
import { splitProductName } from "./adInsights.ts";

const STOP = new Set(["국내산", "농가직송", "직송", "무료배송", "특가", "국산", "신선", "산지", "박스", "개입", "세트", "구성", "택배", "당일"]);

/** 옵션ID가 있으면 그걸로, 없으면 상품명에 붙은 옵션 글 */
export function optionKey(r: AdRow) {
  if (r.optionId) return r.optionId;
  const { option, base } = splitProductName(r.product);
  return option || base || "(옵션 없음)";
}

export function optionLabel(rows: AdRow[]) {
  const named = rows.find((r) => r.product)?.product ?? "";
  const { base, option } = splitProductName(named);
  return option ? `${base} · ${option}` : base || named || "(옵션 없음)";
}

export interface OptionStat extends AdGroup {
  label: string;
}

export function optionBoard(rows: AdRow[], breakEvenOf: BreakEvenOf, costMultiplier = 1, minClicks = 10): OptionStat[] {
  return groupRows(
    rows.filter((r) => r.product || r.optionId),
    optionKey,
    breakEvenOf,
    costMultiplier,
    minClicks,
  ).map((g) => ({ ...g, label: optionLabel(g.rows) }));
}

export interface SoldLine {
  date: string;
  option: string;
  keyword: string;
  revenue: number;
  orders: number;
}

/** 매출이 난 줄만, 날짜가 최근인 것부터 */
export function soldLines(rows: AdRow[]): SoldLine[] {
  return rows
    .filter((r) => r.revenue > 0)
    .map((r) => ({
      date: r.date,
      option: optionLabel([r]),
      keyword: r.keyword || "(비검색)",
      revenue: r.revenue,
      orders: r.orders,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.revenue - a.revenue);
}

/**
 * 예전 기준은 ROAS 400%·노출 50 미만이었다.
 * 지금은 손익분기 이상인데 노출이 80 미만인 키워드를 수동 입찰 후보로 본다.
 * 주문이 2건 이상인 효자(scale)와 겹치지 않게, 아직 노출이 안 열린 쪽만 고른다.
 */
export function manualBidGroups(groups: AdGroup[], impressionCap = 80): AdGroup[] {
  return groups
    .filter((g) => {
      const m = g.metrics;
      if (m.impressions <= 0 || m.impressions >= impressionCap || m.orders < 1 || m.roas === null) return false;
      return m.roas >= (g.breakEven ?? 400);
    })
    .sort((a, b) => (b.metrics.roas ?? 0) - (a.metrics.roas ?? 0));
}

export interface KeywordSale {
  productName: string;
  orders: number;
  units: number;
  revenue: number;
}

/** 그 키워드로 실제로 팔린 상품. 전환 상품명이 없으면 광고한 상품명을 쓴다 */
export function keywordSales(group: AdGroup): KeywordSale[] {
  const map = new Map<string, KeywordSale>();
  for (const r of group.rows) {
    if (r.revenue <= 0 && r.orders <= 0) continue;
    const name = r.convProduct || r.product || "(상품명 없음)";
    const cur = map.get(name) ?? { productName: name, orders: 0, units: 0, revenue: 0 };
    cur.orders += r.orders;
    cur.units += r.units;
    cur.revenue += r.revenue;
    map.set(name, cur);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

/** 상품명에서 품목 단어. 대괄호 안(의성마늘)도 포함하고, 네 글자 이상이면 끝 두 글자(마늘)도 품목으로 본다 */
export function productCores(name: string): string[] {
  const words = name.replace(/[\[\]()]/g, " ").match(/[가-힣]{2,}/g) ?? [];
  const cores = new Set<string>();
  for (const word of words) {
    if (STOP.has(word)) continue;
    cores.add(word);
    if (word.length >= 4) {
      cores.add(word.slice(-2));
      cores.add(word.slice(-3));
    }
  }
  return [...cores].filter((c) => c.length >= 2 && !STOP.has(c));
}

export const mentionsCore = (keyword: string, product: string) => productCores(product).some((core) => keyword.includes(core));

export interface SpendKeyword {
  product: string;
  keyword: string;
  spend: number;
}

/** 광고비는 나갔는데 매출이 0인 키워드. '-' 비검색은 넣지 않는다 */
export function zeroSaleKeywords(rows: AdRow[], costMultiplier = 1): SpendKeyword[] {
  const map = new Map<string, SpendKeyword>();
  for (const r of rows) {
    if (!r.keyword || r.keyword === "-" || !r.product || r.revenue > 0) continue;
    const spend = r.cost * costMultiplier;
    if (spend <= 0) continue;
    const key = `${r.product}\n${r.keyword}`;
    const cur = map.get(key) ?? { product: r.product, keyword: r.keyword, spend: 0 };
    cur.spend += spend;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.spend - a.spend);
}

export interface UnsureProduct {
  product: string;
  spend: number;
  keywords: { keyword: string; spend: number }[];
}

/** 품목 단어가 들어 있으면 관련(제외하지 않음). 나머지는 상품별 상위 10개만 AI에 넘긴다 */
export function splitRelatedSpend(rows: AdRow[], costMultiplier = 1) {
  const all = zeroSaleKeywords(rows, costMultiplier);
  const related = all.filter((k) => mentionsCore(k.keyword, k.product));
  const unsure = all.filter((k) => !mentionsCore(k.keyword, k.product));
  const byProduct = new Map<string, UnsureProduct>();
  for (const item of unsure) {
    const group = byProduct.get(item.product) ?? { product: item.product, spend: 0, keywords: [] };
    group.spend += item.spend;
    group.keywords.push({ keyword: item.keyword, spend: item.spend });
    byProduct.set(item.product, group);
  }
  const products = [...byProduct.values()]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10)
    .map((p) => ({ ...p, keywords: p.keywords.sort((a, b) => b.spend - a.spend).slice(0, 30) }));
  return { related, unsure, products };
}
