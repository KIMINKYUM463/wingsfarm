import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Channel, CostDefaults, Sku } from "../types/index.ts";
import { calcMargin, countByStatus, evaluateListings, marginStatus, priceChangeRate, solvePriceForMargin, type MarginInput } from "./margin.ts";

const base: MarginInput = {
  supplyPrice: 20000,
  extraShippingCost: 0,
  packagingCost: 0,
  salePrice: 30000,
  customerShippingFee: 0,
  saleFeeRate: 10,
  paymentFeeRate: 0,
  shippingFeeRate: 0,
  adRate: 0,
  lossRate: 0,
  taxFree: true,
};

describe("calcMargin", () => {
  it("면세 상품: 순이익 = 판매가 − 수수료 − 원가", () => {
    const r = calcMargin(base);
    assert.equal(r.channelFee, 3000);
    assert.equal(r.vat, 0);
    assert.equal(r.profit, 7000);
    assert.equal(r.marginRate, 7000 / 30000);
    assert.equal(r.settlement, 27000);
  });

  it("과세 상품: (매출 − 원가 − 수수료 − 광고비) / 11 만큼 부가세를 뺀다", () => {
    const r = calcMargin({ ...base, taxFree: false });
    assert.equal(r.vat, (30000 - 20000 - 3000) / 11);
    assert.ok(Math.abs(r.profit - (7000 - 7000 / 11)) < 1e-9);
  });

  it("과세 상품이라도 남는 게 없으면 부가세는 0 (음수 금지)", () => {
    const r = calcMargin({ ...base, taxFree: false, salePrice: 10000 });
    assert.equal(r.vat, 0);
    assert.ok(r.profit < 0);
  });

  it("고객 배송비는 매출에 들어가고 배송비 수수료가 붙는다", () => {
    const r = calcMargin({ ...base, customerShippingFee: 3000, shippingFeeRate: 3.3 });
    assert.equal(r.revenue, 33000);
    assert.ok(Math.abs(r.channelFee - (3000 + 99)) < 1e-9);
  });

  it("광고 전 이익이 0 이하면 손익분기 ROAS는 null", () => {
    assert.equal(calcMargin({ ...base, salePrice: 15000 }).breakEvenRoas, null);
    assert.equal(calcMargin(base).breakEvenRoas, (30000 / 7000) * 100);
  });
});

describe("solvePriceForMargin", () => {
  const input: Omit<MarginInput, "salePrice"> = base;

  it("구한 가격은 목표 마진을 만족하고, 올림 단위 하나 아래는 만족하지 않는다", () => {
    const price = solvePriceForMargin(input, 20, 100)!;
    assert.equal(price % 100, 0);
    assert.ok(calcMargin({ ...input, salePrice: price }).marginRate >= 0.2);
    assert.ok(calcMargin({ ...input, salePrice: price - 100 }).marginRate < 0.2);
  });

  it("수수료가 목표보다 커서 불가능하면 null", () => {
    assert.equal(solvePriceForMargin({ ...input, saleFeeRate: 95 }, 10), null);
  });
});

describe("marginStatus", () => {
  it("음수 = 역마진, 목표 미만 = 미달, 이상 = 정상", () => {
    assert.equal(marginStatus(-0.01, 15), "loss");
    assert.equal(marginStatus(0.1, 15), "warn");
    assert.equal(marginStatus(0.15, 15), "good");
  });
});

describe("evaluateListings", () => {
  const channels: Channel[] = [
    { id: "a", name: "A", saleFeeRate: 10, paymentFeeRate: 0, shippingFeeRate: 0 },
    { id: "b", name: "B", saleFeeRate: 0, paymentFeeRate: 0, shippingFeeRate: 0 },
  ];
  const costs: CostDefaults = { adRate: 0, lossRate: 0, targetMargin: 15, customerShippingFee: 0, roundUnit: 10 };
  const sku: Sku = {
    id: "s1",
    code: "",
    productName: "사과",
    optionName: "5kg",
    category: "과일",
    supplierId: "p1",
    supplyPrice: 20000,
    extraShippingCost: 0,
    packagingCost: 0,
    taxFree: true,
    listings: { a: 22000, b: 30000 },
    aliases: [],
    priceHistory: [],
  };

  it("판매가가 있는 채널만 평가하고 상태를 매긴다", () => {
    const evals = evaluateListings([sku, { ...sku, id: "s2", listings: {} }], channels, costs);
    assert.equal(evals.length, 2);
    assert.deepEqual(countByStatus(evals), { good: 1, warn: 0, loss: 1 });
  });

  it("권장가로 바꾸면 목표 마진을 만족한다", () => {
    const loss = evaluateListings([sku], channels, costs).find((e) => e.channelId === "a")!;
    const fixed = calcMargin({ ...base, salePrice: loss.recommended! });
    assert.ok(fixed.marginRate >= 0.15);
  });

  it("공급가 +30% 시뮬레이션이면 정상이던 채널도 나빠진다", () => {
    const shocked = evaluateListings([sku], channels, costs, 1.3).find((e) => e.channelId === "b")!;
    assert.equal(shocked.status, "warn");
  });
});

describe("priceChangeRate", () => {
  it("처음 대비 마지막 변화율, 이력이 부족하면 null", () => {
    assert.equal(priceChangeRate([{ price: 100 }]), null);
    assert.ok(Math.abs(priceChangeRate([{ price: 100 }, { price: 90 }, { price: 120 }])! - 0.2) < 1e-9);
  });
});
