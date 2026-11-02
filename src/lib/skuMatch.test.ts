import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Sku } from "@/types";
import { matchSku } from "./skuMatch.ts";

const sku = (id: string, productName: string, optionName: string, patch: Partial<Sku> = {}): Sku => ({
  id,
  code: "",
  productName,
  optionName,
  category: "과일",
  supplierId: "farm",
  supplyPrice: 20000,
  extraShippingCost: 0,
  packagingCost: 0,
  taxFree: true,
  listings: {},
  aliases: [],
  priceHistory: [],
  ...patch,
});

describe("matchSku", () => {
  const skus = [sku("a5", "청송 사과", "5kg"), sku("a15", "청송 사과", "15kg"), sku("m2", "성주 참외", "2kg", { code: "CH-2" })];

  it("판매자 상품코드가 가장 먼저", () => {
    assert.equal(matchSku({ productName: "아무 이름", optionName: "", skuCode: "ch-2" }, skus)?.id, "m2");
  });

  it("옵션이 겹치면(5kg ⊂ 15kg) 더 길게 맞는 옵션", () => {
    assert.equal(matchSku({ productName: "[산지직송] 청송 사과", optionName: "15kg", skuCode: "" }, skus)?.id, "a15");
    assert.equal(matchSku({ productName: "청송 사과", optionName: "5kg", skuCode: "" }, skus)?.id, "a5");
  });

  it("기억된 별칭으로 연결, 애매하면 null", () => {
    const withAlias = [...skus, sku("p", "샤인머스캣", "2kg", { aliases: ["망고포도 / 2키로"] })];
    assert.equal(matchSku({ productName: "망고포도", optionName: "2키로", skuCode: "" }, withAlias)?.id, "p");
    assert.equal(matchSku({ productName: "사과", optionName: "", skuCode: "" }, skus), null);
  });
});
