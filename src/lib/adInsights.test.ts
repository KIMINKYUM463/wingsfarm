import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AdField, AdRow } from "./coupangAds.ts";
import {
  analyzeAdReport,
  conversionTiming,
  crossSell,
  gradeOf,
  keywordInsights,
  perMonth,
  placementBreakdown,
  placementKind,
  productPortfolio,
  reportPeriod,
  splitProductName,
  type AnalysisContext,
} from "./adInsights.ts";

const row = (patch: Partial<AdRow>): AdRow => ({
  date: "", campaign: "", adGroup: "", adType: "", product: "", optionId: "", convProduct: "", keyword: "", placement: "",
  impressions: 0, clicks: 0, cost: 0, orders: 0, revenue: 0, units: 0, directRevenue: 0, revenue1d: 0, ...patch,
});

/** 손익분기 300% = 광고 전 이익률 1/3 */
const ctx: AnalysisContext = { breakEvenOf: () => 300, costMultiplier: 1, minClicks: 10 };
const ALL: AdField[] = ["convProduct", "units", "revenue1d", "directRevenue"];

const RADISH = "국산 무,1박스,10kg,10kg";
const RADISH_20 = "국산 무,1박스,20kg,20kg";
const GINGER = "세척생강,1박스,1kg";

const ROWS = [
  row({ product: RADISH, convProduct: RADISH, placement: "검색 영역", keyword: "무", impressions: 1000, clicks: 100, cost: 10000, orders: 5, units: 6, revenue: 60000, directRevenue: 60000, revenue1d: 50000 }),
  row({ product: RADISH, convProduct: RADISH_20, placement: "검색 영역", keyword: "국산 무", impressions: 500, clicks: 20, cost: 2000, orders: 1, units: 1, revenue: 30000, directRevenue: 30000, revenue1d: 30000 }),
  row({ product: RADISH, convProduct: RADISH, placement: "비검색 영역", impressions: 9000, clicks: 50, cost: 9000, orders: 1, units: 1, revenue: 12000, directRevenue: 12000, revenue1d: 12000 }),
  row({ product: GINGER, convProduct: GINGER, placement: "검색 영역", keyword: "햇생강 10kg 국산", impressions: 300, clicks: 15, cost: 3000, orders: 0 }),
  row({ product: GINGER, convProduct: GINGER, placement: "오디언스 플러스(외부 채널) - Product Ad", impressions: 200, clicks: 30, cost: 1000, orders: 0 }),
];

describe("기간·이름", () => {
  it("날짜 열이 없으면 파일 이름에서 기간을 읽는다", () => {
    assert.deepEqual(reportPeriod([row({})], "A01760253_pa_total_campaign_20261012_20261102.xlsx"), { from: "2026-10-12", to: "2026-11-02", days: 22 });
    assert.deepEqual(reportPeriod([row({ date: "20261001" }), row({ date: "2026.10.03" })], "x.xlsx"), { from: "2026-10-01", to: "2026-10-03", days: 3 });
    assert.equal(reportPeriod([row({})], "report.xlsx"), null);
    assert.equal(perMonth(2200, { from: "", to: "", days: 22 }), 3000);
  });

  it("쿠팡 상품명은 기본 이름과 옵션(중복 제거)으로 나눈다", () => {
    assert.deepEqual(splitProductName("[산지직송] 숫꽃게,1박스,1박스,대 1kg 내외,대 1kg 내외"), { base: "[산지직송] 숫꽃게", option: "1박스 · 대 1kg 내외" });
    assert.deepEqual(splitProductName("사과선물세트"), { base: "사과선물세트", option: "" });
  });

  it("ROAS ÷ 손익분기로 등급", () => {
    assert.equal(gradeOf(450, 300), "A");
    assert.equal(gradeOf(350, 300), "B");
    assert.equal(gradeOf(300, 300), "C");
    assert.equal(gradeOf(200, 300), "D");
    assert.equal(gradeOf(null, 300), null);
  });
});

describe("지면·상품", () => {
  it("지면 이름을 검색·비검색·외부로 나누고 비중을 낸다", () => {
    assert.equal(placementKind(row({ placement: "오디언스 플러스(외부 채널) - Product Ad" })), "external");
    assert.equal(placementKind(row({ placement: "비검색 영역" })), "nonSearch");
    assert.equal(placementKind(row({ keyword: "무" })), "search", "지면 열이 없으면 키워드로 판단");
    const [search, nonSearch, external] = placementBreakdown(ROWS, ctx);
    assert.equal(search.kind, "search");
    assert.equal(search.metrics.cost, 15000);
    assert.equal(nonSearch.costShare, 9000 / 25000);
    assert.equal(external.revenueShare, 0);
    // 검색: 매출 90,000 × 1/3 − 광고비 15,000 = 15,000
    assert.equal(Math.round(search.profit!), 15000);
  });

  it("상품을 기본 이름으로 묶고 광고비·이익으로 사분면을 나눈다", () => {
    const [radish, ginger] = productPortfolio(ROWS, ctx);
    assert.equal(radish.key, "국산 무");
    assert.equal(radish.quadrant, "star", "평균보다 많이 쓰고 남는다");
    assert.deepEqual(radish.options.map((o) => o.option), ["1박스 · 10kg"]);
    assert.equal(ginger.quadrant, "drain", "평균보다 적게 쓰고 손해");
    assert.equal(ginger.lowData, false);
  });
});

describe("키워드", () => {
  it("주문 없는 키워드 낭비·길이별 성과·매출 80% 키워드 수", () => {
    const k = keywordInsights(ROWS, ctx)!;
    assert.deepEqual(k.groups.map((g) => g.key), ["무", "햇생강 10kg 국산", "국산 무"]);
    assert.deepEqual(k.noOrder, { count: 1, cost: 3000 });
    assert.deepEqual(k.exclude.map((g) => g.key), ["햇생강 10kg 국산"]);
    assert.equal(k.revenue80Count, 2, "60,000 + 30,000 ≥ 90,000 × 80%");
    assert.deepEqual(k.lengths.map((l) => [l.id, l.metrics.cost]), [["1", 10000], ["2", 2000], ["3", 3000]]);
  });

  it("검색 키워드가 없으면 null", () => {
    assert.equal(keywordInsights([row({ cost: 100 })], ctx), null);
  });
});

describe("고객 행동", () => {
  it("광고한 옵션과 다른 옵션이 팔린 매출을 찾는다", () => {
    const cross = crossSell(ROWS, ALL)!;
    assert.equal(cross.revenue, 30000);
    assert.equal(cross.optionSwitch, 30000);
    assert.deepEqual(cross.pairs[0], { base: "국산 무", from: "1박스 · 10kg", to: "1박스 · 20kg", sameProduct: true, revenue: 30000, orders: 1 });
    assert.equal(crossSell(ROWS, []), null, "실제 팔린 상품 열이 없으면 계산하지 않는다");
  });

  it("1일 안에 난 매출 비중과 직접 전환 비중", () => {
    assert.deepEqual(conversionTiming(ROWS, ALL), { sameDayShare: 92000 / 102000, directShare: 1 });
    assert.deepEqual(conversionTiming(ROWS, []), { sameDayShare: null, directShare: null });
  });
});

describe("실행 계획", () => {
  it("손실을 막는 일부터, 금액이 큰 순서로", () => {
    const { overview, actions } = analyzeAdReport(ROWS, ALL, ctx);
    assert.equal(overview.metrics.cost, 25000);
    assert.equal(overview.unitsPerOrder, 8 / 7);
    assert.equal(Math.round(overview.cpa!), Math.round(25000 / 7));
    // 손실: 생강 상품 4,000원 > 제외 키워드 3,000원 / 주의: 비검색 영역(12,000 × 1/3 − 9,000) / 확대: "무" ROAS 600% / 참고: 20kg 옵션 매출
    assert.deepEqual(actions.map((a) => a.id), ["products", "exclude", "placement", "scale", "option"]);
    assert.deepEqual(actions.map((a) => Math.round(a.impact ?? 0)), [4000, 3000, 5000, 10000, 30000]);
    assert.equal(actions[1].copy?.text, "햇생강 10kg 국산");
  });
});
