/** KAMIS 시세 화면·마진 연결에서 쓰는 타입과 계산 (클라이언트·서버 공용) */
import type { Sku } from "@/types";

export interface KamisPrice {
  cls: "도매" | "소매";
  category: string;
  /** 예: "사과/후지(10kg)" — KAMIS 품목명 */
  name: string;
  unit: string;
  latestDate: string;
  today: number | null;
  dayAgo: number | null;
  monthAgo: number | null;
  yearAgo: number | null;
}

export interface KamisResponse {
  items: KamisPrice[];
  updatedAt: string;
  error?: string;
  missingKey?: boolean;
}

export const changeRate = (now: number | null, before: number | null) => (now && before ? now / before - 1 : null);

/** KAMIS 품목명의 첫 단어 (예: "사과/후지" → "사과") */
export const baseItemName = (name: string) => name.split(/[/(\s]/)[0];

/** 내 상품명에 KAMIS 품목명이 들어 있으면 연결 (도매 우선) */
export function matchSkuPrices(skus: Sku[], items: KamisPrice[]) {
  const wholesale = items.filter((i) => i.cls === "도매" && i.today);
  return skus
    .map((sku) => {
      const match = wholesale.find((i) => {
        const base = baseItemName(i.name);
        return base.length >= 1 && sku.productName.replace(/\s/g, "").includes(base);
      });
      return match ? { sku, price: match, monthChange: changeRate(match.today, match.monthAgo) } : null;
    })
    .filter((x) => x !== null);
}

/** 한 달 새 10% 넘게 오르면 공급가 인상에 대비 */
export const PRICE_ALERT_RATE = 0.1;
