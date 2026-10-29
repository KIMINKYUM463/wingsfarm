import type { Channel, CostDefaults, Sku } from "@/types";

export interface MarginInput {
  supplyPrice: number;
  extraShippingCost: number;
  packagingCost: number;
  salePrice: number;
  customerShippingFee: number;
  /** 아래 비율은 모두 % 단위 */
  saleFeeRate: number;
  paymentFeeRate: number;
  shippingFeeRate: number;
  adRate: number;
  lossRate: number;
  taxFree: boolean;
}

export interface MarginResult {
  revenue: number;
  channelFee: number;
  cost: number;
  adCost: number;
  lossReserve: number;
  vat: number;
  settlement: number;
  profit: number;
  marginRate: number;
  markupRate: number;
  /** 광고비를 제외한 이익 기준, 적자가 나지 않는 최소 ROAS(%) */
  breakEvenRoas: number | null;
}

export type MarginStatus = "good" | "warn" | "loss";

const pct = (rate: number) => rate / 100;

export function calcMargin(input: MarginInput): MarginResult {
  const { salePrice, customerShippingFee } = input;
  const revenue = salePrice + customerShippingFee;
  const channelFee =
    salePrice * pct(input.saleFeeRate + input.paymentFeeRate) +
    customerShippingFee * pct(input.shippingFeeRate);
  const cost = input.supplyPrice + input.extraShippingCost + input.packagingCost;
  const adCost = salePrice * pct(input.adRate);
  const lossReserve = salePrice * pct(input.lossRate);
  // 과세상품: 매출세액 − 매입세액. 원가·수수료·광고비가 모두 VAT 포함 과세매입이라고 가정한다.
  const vat = input.taxFree ? 0 : Math.max(0, (revenue - cost - channelFee - adCost) / 11);
  const profit = revenue - channelFee - cost - adCost - lossReserve - vat;
  const profitBeforeAd = profit + adCost;

  return {
    revenue,
    channelFee,
    cost,
    adCost,
    lossReserve,
    vat,
    settlement: revenue - channelFee,
    profit,
    marginRate: revenue > 0 ? profit / revenue : 0,
    markupRate: input.supplyPrice > 0 ? profit / input.supplyPrice : 0,
    breakEvenRoas: profitBeforeAd > 0 ? (salePrice / profitBeforeAd) * 100 : null,
  };
}

const MAX_PRICE = 100_000_000;

/**
 * 목표 마진율(%)을 달성하는 최소 판매가.
 * 이익률은 판매가에 대해 단조 증가하므로 이분 탐색으로 구한다.
 */
export function solvePriceForMargin(
  input: Omit<MarginInput, "salePrice">,
  targetMarginPct: number,
  roundUnit = 10,
): number | null {
  const target = pct(targetMarginPct);
  const meets = (price: number) => {
    const r = calcMargin({ ...input, salePrice: price });
    return r.revenue > 0 && r.profit / r.revenue >= target;
  };
  if (!meets(MAX_PRICE)) return null;

  let lo = 0;
  let hi = MAX_PRICE;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (meets(mid)) hi = mid;
    else lo = mid;
  }
  return roundUp(hi, roundUnit);
}

export function roundUp(value: number, unit: number) {
  if (unit <= 1) return Math.ceil(value);
  return Math.ceil(value / unit) * unit;
}

export function marginStatus(marginRate: number, targetMarginPct: number): MarginStatus {
  if (marginRate < 0) return "loss";
  if (marginRate < pct(targetMarginPct)) return "warn";
  return "good";
}

/** SKU + 채널 + 기본비용 설정을 계산 엔진 입력으로 변환 (판매가 제외) */
export function buildSkuInput(
  sku: Sku,
  channel: Channel,
  defaults: CostDefaults,
  supplyMultiplier = 1,
): Omit<MarginInput, "salePrice"> {
  return {
    supplyPrice: sku.supplyPrice * supplyMultiplier,
    extraShippingCost: sku.extraShippingCost,
    packagingCost: sku.packagingCost,
    customerShippingFee: defaults.customerShippingFee,
    saleFeeRate: channel.saleFeeRate,
    paymentFeeRate: channel.paymentFeeRate,
    shippingFeeRate: channel.shippingFeeRate,
    adRate: defaults.adRate,
    lossRate: defaults.lossRate,
    taxFree: sku.taxFree,
  };
}

export interface ListingEval {
  skuId: string;
  channelId: string;
  salePrice: number;
  result: MarginResult;
  status: MarginStatus;
  /** 목표 마진을 맞추는 최소 판매가 (올림 단위 적용) */
  recommended: number | null;
}

/**
 * 판매 중인(판매가가 입력된) 모든 SKU × 채널의 마진을 한 번에 계산한다.
 * supplyMultiplier로 "공급가가 x% 오르면?"을 시뮬레이션한다.
 */
export function evaluateListings(skus: Sku[], channels: Channel[], defaults: CostDefaults, supplyMultiplier = 1): ListingEval[] {
  const evals: ListingEval[] = [];
  for (const sku of skus) {
    for (const channel of channels) {
      const salePrice = sku.listings[channel.id];
      if (!salePrice || salePrice <= 0) continue;
      const input = buildSkuInput(sku, channel, defaults, supplyMultiplier);
      const result = calcMargin({ ...input, salePrice });
      evals.push({
        skuId: sku.id,
        channelId: channel.id,
        salePrice,
        result,
        status: marginStatus(result.marginRate, defaults.targetMargin),
        recommended: solvePriceForMargin(input, defaults.targetMargin, defaults.roundUnit),
      });
    }
  }
  return evals;
}

export function countByStatus(evals: ListingEval[]): Record<MarginStatus, number> {
  const counts: Record<MarginStatus, number> = { good: 0, warn: 0, loss: 0 };
  for (const e of evals) counts[e.status] += 1;
  return counts;
}

/** 가격 이력의 처음 대비 마지막 변화율 (이력이 2개 미만이면 null) */
export function priceChangeRate(history: { price: number }[]): number | null {
  if (history.length < 2 || history[0].price <= 0) return null;
  return history.at(-1)!.price / history[0].price - 1;
}