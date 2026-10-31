/**
 * 쿠팡 윙 Open API "발주서 목록 조회(일단위 페이징)"로 광고 기간의 실제 쿠팡 매출을 구한다.
 * 광고 보고서 ROAS는 광고를 거친 주문만 세므로, 전체 매출 대비 광고비(TACoS)로 보완한다.
 * 서버 전용 코드(서명·호출)는 lib/server/coupangWing.ts — 여기는 브라우저에서도 쓰는 계산만 둔다.
 */

/** 금액 — 문서 버전에 따라 숫자 또는 { units, nanos } */
type Money = number | { units?: number; nanos?: number } | null | undefined;

export interface WingOrderItem {
  sellerProductName?: string;
  vendorItemName?: string;
  shippingCount?: number;
  cancelCount?: number;
  holdCountForCancel?: number;
  salesPrice?: Money;
}

export interface WingOrderSheet {
  shipmentBoxId?: number;
  orderId: number;
  orderedAt?: string;
  paidAt?: string;
  orderItems?: WingOrderItem[];
}

export interface WingDay {
  date: string;
  sales: number;
  orders: number;
}

export interface WingProduct {
  name: string;
  sales: number;
  units: number;
}

export interface WingSales {
  from: string;
  to: string;
  total: { sales: number; orders: number; units: number };
  days: WingDay[];
  products: WingProduct[];
}

export type WingSalesResponse = { configured: false } | { configured: true; error: string } | ({ configured: true } & WingSales);

/** 취소된 주문은 별도 API로 빠지므로 이 상태들을 모두 돌면 살아 있는 주문 전부 */
export const ORDER_STATUSES = ["ACCEPT", "INSTRUCT", "DEPARTURE", "DELIVERING", "FINAL_DELIVERY", "NONE_TRACKING"] as const;
/** 문서상 한 번에 최대 31일 — 경계 해석 차이를 피해 30일씩 나눈다 */
export const MAX_RANGE_DAYS = 30;

export const money = (v: Money) => (typeof v === "number" ? v : (v?.units ?? 0) + (v?.nanos ?? 0) / 1e9);

/** "20261020" · "2026-10-20" · "2026.10.20" · "2026/10/20 (월)" → "2026-10-20" */
export function toIsoDate(value: string): string | null {
  const m = value.trim().match(/^(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** [from, to]를 최대 MAX_RANGE_DAYS일씩 끊는다 (양 끝 포함) */
export function dateChunks(from: string, to: string, maxDays = MAX_RANGE_DAYS): [string, string][] {
  const chunks: [string, string][] = [];
  for (let start = from; start <= to; start = addDays(start, maxDays)) {
    const end = addDays(start, maxDays - 1);
    chunks.push([start, end < to ? end : to]);
  }
  return chunks;
}

const liveUnits = (item: WingOrderItem) => Math.max(0, (item.shippingCount ?? 0) - (item.cancelCount ?? 0) - (item.holdCountForCancel ?? 0));

/**
 * 발주서 → 주문일(한국 시간) 기준 매출. 매출 = 개당 판매가 × (주문 수량 − 취소·환불대기 수량).
 * 상태별로 따로 받은 목록을 합치므로 같은 배송번호는 한 번만 센다.
 */
export function summarizeOrderSheets(sheets: WingOrderSheet[], from: string, to: string): WingSales {
  const seen = new Set<string>();
  const days = new Map<string, WingDay>();
  const products = new Map<string, WingProduct>();
  const total = { sales: 0, orders: 0, units: 0 };

  for (const sheet of sheets) {
    const id = String(sheet.shipmentBoxId ?? sheet.orderId);
    const date = (sheet.orderedAt || sheet.paidAt || "").slice(0, 10);
    if (seen.has(id) || date < from || date > to) continue;
    seen.add(id);

    let sheetSales = 0;
    for (const item of sheet.orderItems ?? []) {
      const units = liveUnits(item);
      if (!units) continue;
      const sales = money(item.salesPrice) * units;
      const name = item.sellerProductName || item.vendorItemName || "(상품명 없음)";
      const p = products.get(name) ?? { name, sales: 0, units: 0 };
      products.set(name, { name, sales: p.sales + sales, units: p.units + units });
      sheetSales += sales;
      total.units += units;
    }
    if (!sheetSales) continue;
    const day = days.get(date) ?? { date, sales: 0, orders: 0 };
    days.set(date, { date, sales: day.sales + sheetSales, orders: day.orders + 1 });
    total.sales += sheetSales;
    total.orders += 1;
  }

  return {
    from,
    to,
    total,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    products: [...products.values()].sort((a, b) => b.sales - a.sales),
  };
}

/**
 * 광고비를 전체 매출과 비교.
 * - tacos: 광고비 ÷ 쿠팡 전체 매출
 * - limit: 광고비로 써도 되는 매출 비율 = 1 ÷ 손익분기 ROAS (광고비 빼기 전 이익률)
 */
export function totalSalesView(adCost: number, adRevenue: number, totalSales: number, breakEvenRoas: number) {
  const tacos = totalSales > 0 ? adCost / totalSales : null;
  const limit = breakEvenRoas > 0 ? 100 / breakEvenRoas : null;
  return {
    tacos,
    limit,
    adShare: totalSales > 0 ? Math.min(1, adRevenue / totalSales) : null,
    organic: Math.max(0, totalSales - adRevenue),
    healthy: tacos !== null && limit !== null ? tacos <= limit : null,
  };
}
