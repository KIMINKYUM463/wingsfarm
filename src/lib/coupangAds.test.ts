import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Channel, CostDefaults, Sku } from "../types/index.ts";
import { NON_SEARCH, groupRows, keywordOf, parseAdReport, productBreakEven, spendByVerdict, summarize, verdictOf, type AdRow } from "./coupangAds.ts";

/** 쿠팡 광고센터 상품광고 보고서(일별·키워드) 모양: 제목 줄 + 머리글 + 내용 + 합계 */
const REPORT = [
  ["상품광고 보고서 (2026.10.01 ~ 2026.10.14)"],
  [],
  ["날짜", "캠페인명", "광고그룹", "광고집행 상품명", "키워드", "노출수", "클릭수", "광고비", "클릭률", "총 주문수(1일)", "총 주문수(14일)", "총 전환매출액(1일)", "총 전환매출액(14일)"],
  ["20261001", "홍게 캠페인", "기본", "박달홍게 2kg", "홍게", "10,000", "200", "40,000", "2%", "3", "5", "90,000", "150,000"],
  ["20261001", "홍게 캠페인", "기본", "박달홍게 2kg", "대게", "5,000", "50", "15,000", "1%", "0", "0", "0", "0"],
  ["20261002", "홍게 캠페인", "기본", "박달홍게 2kg", "-", "3,000", "5", "1,000", "0.2%", "0", "1", "0", "30,000"],
  ["합계", "", "", "", "", "18,000", "255", "56,000", "", "3", "6", "90,000", "180,000"],
];

const row = (patch: Partial<AdRow>): AdRow => ({
  date: "", campaign: "", adGroup: "", product: "", keyword: "", placement: "",
  impressions: 0, clicks: 0, cost: 0, orders: 0, revenue: 0, ...patch,
});

describe("쿠팡 광고 보고서 읽기", () => {
  it("제목 줄을 건너뛰고 머리글을 찾아, 14일 기준 열을 먼저 잡는다", () => {
    const { rows, missing, window } = parseAdReport(REPORT);
    assert.deepEqual(missing, []);
    assert.equal(window, "14일");
    assert.equal(rows.length, 3, "합계 줄은 빼야 한다");
    assert.deepEqual(rows[0], row({ date: "20261001", campaign: "홍게 캠페인", adGroup: "기본", product: "박달홍게 2kg", keyword: "홍게", impressions: 10000, clicks: 200, cost: 40000, orders: 5, revenue: 150000 }));
    assert.equal(rows[2].keyword, "", "'-' 키워드는 비검색 영역");
  });

  it("필수 열이 없으면 무엇이 빠졌는지 알려 준다", () => {
    const { rows, missing } = parseAdReport([["날짜", "노출수", "클릭수"], ["20261001", "1", "1"]]);
    assert.equal(rows.length, 0);
    assert.deepEqual(missing.map((f) => f.label), ["광고비", "전환매출"]);
  });
});

describe("지표·진단", () => {
  it("CTR·CPC·전환율·ROAS를 계산하고 광고비 배율(부가세)을 반영한다", () => {
    const m = summarize([row({ impressions: 1000, clicks: 50, cost: 10000, orders: 2, revenue: 40000 })], 1.1);
    assert.equal(m.ctr, 0.05);
    assert.equal(m.cost, 11000);
    assert.equal(m.cpc, 220);
    assert.equal(m.cvr, 0.04);
    assert.ok(Math.abs(m.roas! - 363.64) < 0.01);
  });

  it("클릭이 충분한데 주문이 없으면 제외 후보, 적으면 지켜보기", () => {
    assert.equal(verdictOf(summarize([row({ clicks: 50, cost: 15000 })]), 300), "exclude");
    assert.equal(verdictOf(summarize([row({ clicks: 5, cost: 1000 })]), 300), "watch");
  });

  it("손익분기 미달은 적자, 1.3배 이상이고 주문 2건 이상이면 효자", () => {
    const of = (revenue: number, orders = 3) => verdictOf(summarize([row({ clicks: 100, cost: 10000, orders, revenue })]), 300);
    assert.equal(of(25000), "cut");
    assert.equal(of(35000), "ok");
    assert.equal(of(40000), "scale");
    assert.equal(of(40000, 1), "ok", "주문 1건으로는 효자로 보지 않는다");
  });

  it("키워드로 묶고 광고비 많은 순으로, 판정별 광고비를 모은다", () => {
    const { rows } = parseAdReport(REPORT);
    const groups = groupRows(rows, keywordOf, () => 300);
    assert.deepEqual(groups.map((g) => [g.key, g.verdict]), [["홍게", "ok"], ["대게", "exclude"], [NON_SEARCH, "ok"]]);
    assert.equal(spendByVerdict(groups).exclude, 15000);
  });
});

describe("상품 손익분기 ROAS", () => {
  const channel: Channel = { id: "coupang", name: "쿠팡", saleFeeRate: 10, paymentFeeRate: 0, shippingFeeRate: 0 };
  const defaults: CostDefaults = { adRate: 10, lossRate: 0, targetMargin: 15, customerShippingFee: 0, roundUnit: 10 };
  const sku: Sku = {
    id: "s1", code: "", productName: "박달홍게", optionName: "2kg", category: "수산", supplierId: "p1",
    supplyPrice: 20000, extraShippingCost: 0, packagingCost: 0, taxFree: true,
    listings: { coupang: 30000 }, aliases: [], priceHistory: [],
  };

  it("마진 계산기 상품과 이름이 맞으면 광고비를 뺀 이익으로 손익분기를 구한다", () => {
    // 30,000 − 수수료 3,000 − 원가 20,000 = 이익 7,000 → 30,000 ÷ 7,000 = 428.6%
    const found = productBreakEven("박달홍게 2kg 산지직송", [sku], channel, defaults);
    assert.equal(found?.sku.id, "s1");
    assert.ok(Math.abs(found!.roas - 428.57) < 0.01);
  });

  it("맞는 상품이 없거나 쿠팡 판매가가 없으면 null", () => {
    assert.equal(productBreakEven("사과 5kg", [sku], channel, defaults), null);
    assert.equal(productBreakEven("박달홍게 2kg", [{ ...sku, listings: {} }], channel, defaults), null);
  });
});
