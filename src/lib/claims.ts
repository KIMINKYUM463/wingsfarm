/** 클레임 기록 → 공급처 스코어카드 (순수 함수) */
import type { ClaimRecord, ClaimResolution, ClaimType, LedgerEntry, Sku, Supplier } from "@/types";

export const RESOLUTION_LABEL: Record<ClaimResolution, string> = {
  partial: "부분 환불",
  refund: "전액 환불",
  resend: "재발송",
  coupon: "적립금·쿠폰",
  none: "보상 없음(안내만)",
};

/** 클레임 손실을 장부에 함께 기록할 때 쓰는 장부 줄 id (클레임 수정·삭제 시 같이 고친다) */
export const claimLedgerId = (claimId: string) => `claim:${claimId}`;

export type Grade = "A" | "B" | "C" | "D" | "-";

export interface SupplierScore {
  supplier: Supplier;
  claims: number;
  /** 같은 기간 장부에 기록된 판매 수량 (클레임률 분모) */
  sold: number;
  /** 0~1, 판매 기록이 없으면 null */
  claimRate: number | null;
  loss: number;
  byType: Partial<Record<ClaimType, number>>;
  topType: ClaimType | null;
  /** 최근 공급가 변화율 (연결 상품 평균, 이력 없으면 null) */
  priceChange: number | null;
  grade: Grade;
  /** 판매 수량이 적어 등급을 참고로만 봐야 할 때 */
  lowSample: boolean;
}

/** 이보다 적게 팔린 공급처는 클레임 1~2건에 등급이 크게 흔들린다 */
export const MIN_SAMPLE = 30;

/** 신선 농수산물 위탁 기준 경험치: 1% 미만 우수, 3% 미만 보통, 6% 미만 주의, 그 이상 교체 검토 */
export function gradeOf(claimRate: number | null): Grade {
  if (claimRate === null) return "-";
  if (claimRate < 0.01) return "A";
  if (claimRate < 0.03) return "B";
  if (claimRate < 0.06) return "C";
  return "D";
}

export const GRADE_ADVICE: Record<Grade, string> = {
  A: "우수 — 물량을 늘려도 좋아요",
  B: "보통 — 주된 클레임 유형만 공유하세요",
  C: "주의 — 포장·선별 기준을 서면으로 다시 맞추세요",
  D: "교체 검토 — 대체 공급처를 준비하세요",
  "-": "판매 기록이 없어 클레임률을 계산할 수 없어요 (장부에 판매를 기록하세요)",
};

export const sinceDate = (days: number, today = new Date()) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function priceChangeOf(skus: Sku[]) {
  const rates = skus
    .filter((s) => s.priceHistory.length >= 2 && s.priceHistory[0].price > 0)
    .map((s) => s.priceHistory.at(-1)!.price / s.priceHistory[0].price - 1);
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
}

export function supplierScores(suppliers: Supplier[], skus: Sku[], claims: ClaimRecord[], ledger: LedgerEntry[], since: string): SupplierScore[] {
  return suppliers
    .map((supplier) => {
      const supplierSkus = skus.filter((s) => s.supplierId === supplier.id);
      const skuIds = new Set(supplierSkus.map((s) => s.id));
      const list = claims.filter((c) => c.supplierId === supplier.id && c.date >= since);
      const sold = ledger.filter((e) => e.date >= since && e.skuId && skuIds.has(e.skuId)).reduce((s, e) => s + e.qty, 0);
      const byType: Partial<Record<ClaimType, number>> = {};
      for (const c of list) byType[c.type] = (byType[c.type] ?? 0) + 1;
      const topType = (Object.entries(byType) as [ClaimType, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const claimRate = sold > 0 ? list.length / sold : null;
      return {
        supplier,
        claims: list.length,
        sold,
        claimRate,
        loss: list.reduce((s, c) => s + c.loss, 0),
        byType,
        topType,
        priceChange: priceChangeOf(supplierSkus),
        grade: gradeOf(claimRate),
        lowSample: sold > 0 && sold < MIN_SAMPLE,
      };
    })
    .sort((a, b) => (b.claimRate ?? -1) - (a.claimRate ?? -1) || b.claims - a.claims);
}
