import type { Sku } from "@/types";

/** 마켓 파일에 찍힌 상품 표기 */
export interface ProductLabel {
  productName: string;
  optionName: string;
  /** 판매자 상품코드 (없으면 "") */
  skuCode: string;
}

/** "상품명 / 옵션" — SKU 별칭으로 기억하는 단위 */
export const productLabel = (p: Pick<ProductLabel, "productName" | "optionName">) => [p.productName, p.optionName].filter(Boolean).join(" / ");

const compact = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * 마켓 상품 → SKU 매칭 순서: 판매자 상품코드 → 기억된 별칭 → 상품명·옵션 포함 관계(후보가 하나일 때만).
 * 애매하면 null을 돌려 판매자가 직접 고르게 한다.
 */
export function matchSku(product: ProductLabel, skus: Sku[]): Sku | null {
  if (product.skuCode) {
    const byCode = skus.find((s) => s.code && compact(s.code) === compact(product.skuCode));
    if (byCode) return byCode;
  }
  const label = productLabel(product);
  const byAlias = skus.find((s) => s.aliases.includes(label));
  if (byAlias) return byAlias;

  const haystack = compact(`${product.productName} ${product.optionName}`);
  const candidates = skus.filter((s) => {
    const name = compact(s.productName);
    const option = compact(s.optionName);
    return name !== "" && haystack.includes(name) && (option === "" || haystack.includes(option));
  });
  if (candidates.length === 1) return candidates[0];
  // 옵션까지 맞는 후보가 하나면 그것으로 (예: 5kg·10kg 중 10kg)
  const withOption = candidates.filter((s) => compact(s.optionName) !== "");
  if (withOption.length === 1) return withOption[0];
  // 옵션이 길게 맞는 후보가 유일하게 가장 길면 선택 (예: "5kg"과 "15kg"이 모두 포함될 때 15kg)
  const longest = Math.max(...withOption.map((s) => compact(s.optionName).length));
  const top = withOption.filter((s) => compact(s.optionName).length === longest);
  return top.length === 1 ? top[0] : null;
}
