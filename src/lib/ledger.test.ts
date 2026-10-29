import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ClaimRecord, LedgerEntry, Sku, Supplier } from "@/types";
import { gradeOf, sinceDate, supplierScores } from "./claims.ts";
import { estimateFee, estimateVat, groupTotals, inMonth, ledgerCsvRows, totals } from "./ledger.ts";

const entry = (patch: Partial<LedgerEntry>): LedgerEntry => ({
  id: Math.random().toString(36),
  date: "2026-10-15",
  channelId: "naver",
  skuId: "a",
  label: "사과 5kg",
  qty: 1,
  revenue: 33000,
  cost: 22000,
  fee: 1800,
  ad: 0,
  other: 0,
  taxFree: true,
  source: "manual",
  ...patch,
});

describe("ledger", () => {
  const entries = [entry({}), entry({ date: "2026-10-20", channelId: "coupang", revenue: 11000, cost: 5500, fee: 1100, taxFree: false }), entry({ date: "2026-09-30", revenue: 99999 })];

  it("월 필터와 합계·마진율", () => {
    const oct = inMonth(entries, "2026-10");
    assert.equal(oct.length, 2);
    const t = totals(oct);
    assert.equal(t.revenue, 44000);
    assert.equal(t.profit, 44000 - 27500 - 2900);
    assert.equal(t.marginRate, t.profit / 44000);
  });

  it("채널별 묶음은 매출 큰 순", () => {
    assert.deepEqual(
      groupTotals(inMonth(entries, "2026-10"), (e) => e.channelId).map((g) => g.key),
      ["naver", "coupang"],
    );
  });

  it("수수료 추정 = 판매 + 결제 수수료율", () => {
    assert.equal(estimateFee(10000, { id: "x", name: "x", saleFeeRate: 2, paymentFeeRate: 3.63, shippingFeeRate: 0 }), 563);
    assert.equal(estimateFee(10000, undefined), 0);
  });

  it("부가세는 과세 매출만 1/11, 수수료는 과세 매출 비율만큼만 공제, 납부액은 음수가 되지 않는다", () => {
    const vat = estimateVat(inMonth(entries, "2026-10"));
    assert.equal(vat.taxableRevenue, 11000);
    assert.equal(vat.taxFreeRevenue, 33000);
    assert.equal(vat.outputVat, 1000);
    const input = (5500 + (1800 + 1100) * (11000 / 44000)) / 11;
    assert.equal(vat.inputVat, input);
    assert.equal(vat.payable, Math.max(0, 1000 - input));
  });

  it("면세 매출만 있으면 매입세액 공제도 0", () => {
    assert.equal(estimateVat([entry({})]).inputVat, 0);
  });

  it("CSV는 날짜순, 순이익·과세구분 포함", () => {
    const rows = ledgerCsvRows(entries, (id) => id.toUpperCase());
    assert.equal(rows[1][0], "2026-09-30");
    assert.equal(rows[2].at(-1), "면세");
    assert.equal(rows[2][9], String(33000 - 22000 - 1800));
  });
});

describe("claims", () => {
  const suppliers: Supplier[] = [
    { id: "s1", name: "청송농장", cutoffTime: "14:00", shipWeekdays: [1], freshBlockedWeekdays: [], template: [] },
    { id: "s2", name: "성주농원", cutoffTime: "14:00", shipWeekdays: [1], freshBlockedWeekdays: [], template: [] },
  ];
  const sku = (id: string, supplierId: string, history: number[] = []): Sku => ({
    id,
    code: "",
    productName: id,
    optionName: "",
    category: "과일",
    supplierId,
    supplyPrice: 10000,
    extraShippingCost: 0,
    packagingCost: 0,
    taxFree: true,
    fresh: true,
    listings: {},
    aliases: [],
    priceHistory: history.map((price, i) => ({ date: `2026-0${i + 1}-01`, price })),
  });
  const claim = (patch: Partial<ClaimRecord>): ClaimRecord => ({ id: Math.random().toString(36), date: "2026-10-10", supplierId: "s1", skuId: "a", type: "damage", orderNo: "", resolution: "partial", loss: 5000, evidence: [], note: "", ...patch });

  it("등급 기준", () => {
    assert.equal(gradeOf(null), "-");
    assert.equal(gradeOf(0.005), "A");
    assert.equal(gradeOf(0.02), "B");
    assert.equal(gradeOf(0.05), "C");
    assert.equal(gradeOf(0.1), "D");
  });

  it("기간 안의 클레임 ÷ 장부 판매 수량, 최다 유형, 공급가 변화", () => {
    const scores = supplierScores(
      suppliers,
      [sku("a", "s1", [10000, 11000]), sku("b", "s2")],
      [claim({}), claim({ type: "spoiled" }), claim({ type: "damage", loss: 3000 }), claim({ date: "2026-01-01" })],
      [entry({ skuId: "a", qty: 40 }), entry({ skuId: "b", qty: 10 })],
      "2026-09-01",
    );
    const s1 = scores.find((s) => s.supplier.id === "s1")!;
    assert.equal(s1.claims, 3);
    assert.equal(s1.sold, 40);
    assert.equal(s1.claimRate, 3 / 40);
    assert.equal(s1.grade, "D");
    assert.equal(s1.loss, 13000);
    assert.equal(s1.topType, "damage");
    assert.ok(Math.abs(s1.priceChange! - 0.1) < 1e-9);
    const s2 = scores.find((s) => s.supplier.id === "s2")!;
    assert.equal(s2.claimRate, 0);
    assert.equal(s2.grade, "A");
    assert.equal(s1.lowSample, false);
    assert.equal(s2.lowSample, true);
    assert.equal(scores[0].supplier.id, "s1");
  });

  it("sinceDate는 오늘에서 N일 전", () => {
    assert.equal(sinceDate(30, new Date(2026, 9, 30)), "2026-09-30");
  });
});
