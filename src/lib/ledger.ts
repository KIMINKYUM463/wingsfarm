/** 매출·순이익 장부 계산 (순수 함수) */
import type { Channel, LedgerEntry, Sku } from "@/types";

export interface LedgerTotals {
  count: number;
  qty: number;
  revenue: number;
  cost: number;
  fee: number;
  ad: number;
  other: number;
  profit: number;
  marginRate: number;
}

export const entryProfit = (e: LedgerEntry) => e.revenue - e.cost - e.fee - e.ad - e.other;

export function totals(entries: LedgerEntry[]): LedgerTotals {
  const sum = (pick: (e: LedgerEntry) => number) => entries.reduce((s, e) => s + pick(e), 0);
  const revenue = sum((e) => e.revenue);
  const profit = sum(entryProfit);
  return {
    count: entries.length,
    qty: sum((e) => e.qty),
    revenue,
    cost: sum((e) => e.cost),
    fee: sum((e) => e.fee),
    ad: sum((e) => e.ad),
    other: sum((e) => e.other),
    profit,
    marginRate: revenue > 0 ? profit / revenue : 0,
  };
}

/** YYYY-MM으로 시작하는 줄만 */
export const inMonth = (entries: LedgerEntry[], month: string) => entries.filter((e) => e.date.startsWith(month));

export function groupTotals(entries: LedgerEntry[], keyOf: (e: LedgerEntry) => string) {
  const groups = new Map<string, LedgerEntry[]>();
  for (const e of entries) groups.set(keyOf(e), [...(groups.get(keyOf(e)) ?? []), e]);
  return [...groups.entries()].map(([key, list]) => ({ key, ...totals(list) })).sort((a, b) => b.revenue - a.revenue);
}

/** 판매수수료 + 결제수수료 (배송비 수수료는 매출에 배송비가 섞여 있어 판매가 기준으로 근사) */
export const estimateFee = (revenue: number, channel: Channel | undefined) =>
  channel ? Math.round((revenue * (channel.saleFeeRate + channel.paymentFeeRate)) / 100) : 0;

export const skuUnitCost = (sku: Sku) => sku.supplyPrice + sku.extraShippingCost + sku.packagingCost;

export interface VatEstimate {
  taxableRevenue: number;
  taxFreeRevenue: number;
  /** 과세 매출의 1/11 */
  outputVat: number;
  /** (과세 상품 원가 + 수수료·광고비 × 과세 매출 비율)의 1/11 (모두 세금계산서·카드 증빙이 있다고 가정) */
  inputVat: number;
  payable: number;
}

/**
 * 일반과세자 기준 부가세 대략치. 수수료·광고비처럼 과세·면세에 함께 쓴 비용은 매출 비율로 나눠(공통매입 안분) 과세분만 공제한다.
 * 간이과세자, 의제매입세액 공제 등은 반영하지 않는다. 정확한 신고는 세무사·홈택스에서.
 */
export function estimateVat(entries: LedgerEntry[]): VatEstimate {
  const taxable = entries.filter((e) => !e.taxFree);
  const taxableRevenue = taxable.reduce((s, e) => s + e.revenue, 0);
  const taxFreeRevenue = entries.reduce((s, e) => s + (e.taxFree ? e.revenue : 0), 0);
  const totalRevenue = taxableRevenue + taxFreeRevenue;
  const taxableShare = totalRevenue > 0 ? taxableRevenue / totalRevenue : 0;
  const outputVat = taxableRevenue / 11;
  const commonCost = entries.reduce((s, e) => s + e.fee + e.ad, 0);
  const inputBase = taxable.reduce((s, e) => s + e.cost, 0) + commonCost * taxableShare;
  const inputVat = inputBase / 11;
  return { taxableRevenue, taxFreeRevenue, outputVat, inputVat, payable: Math.max(0, outputVat - inputVat) };
}

export const LEDGER_CSV_HEADER = ["날짜", "채널", "상품", "수량", "매출", "원가", "수수료", "광고비", "기타", "순이익", "과세구분"];

export function ledgerCsvRows(entries: LedgerEntry[], channelName: (id: string) => string): string[][] {
  return [
    LEDGER_CSV_HEADER,
    ...[...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => [e.date, channelName(e.channelId), e.label, e.qty, e.revenue, e.cost, e.fee, e.ad, e.other, entryProfit(e), e.taxFree ? "면세" : "과세"].map(String)),
  ];
}
