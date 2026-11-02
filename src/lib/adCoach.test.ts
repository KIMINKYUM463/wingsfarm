import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AdRow } from "./coupangAds.ts";
import type { AnalysisContext } from "./adInsights.ts";
import { excludeText, productCoach } from "./adCoach.ts";

const row = (patch: Partial<AdRow>): AdRow => ({
  date: "", campaign: "", adGroup: "", adType: "", product: "", optionId: "", convProduct: "", keyword: "", placement: "",
  impressions: 0, clicks: 0, cost: 0, orders: 0, revenue: 0, units: 0, directRevenue: 0, revenue1d: 0, ...patch,
});

/** 손익분기 300% */
const ctx: AnalysisContext = { breakEvenOf: () => 300, costMultiplier: 1, minClicks: 10 };

const APPLE = "부사 사과,5kg";
const PEAR = "신고배,7.5kg";
const GRAPE = "샤인머스캣,2kg";

const ROWS = [
  row({ product: APPLE, adGroup: "과일 수동", keyword: "사과", impressions: 4000, clicks: 120, cost: 12000, orders: 12, revenue: 120000 }),
  row({ product: APPLE, adGroup: "과일 수동", keyword: "부사", impressions: 1000, clicks: 30, cost: 3000, orders: 1, revenue: 30000 }),
  row({ product: PEAR, adGroup: "과일 수동", keyword: "배", impressions: 5000, clicks: 25, cost: 5000, orders: 1, revenue: 10000 }),
  row({ product: GRAPE, adGroup: "포도 자동", keyword: "포도", impressions: 1500, clicks: 100, cost: 10000 }),
  row({ product: GRAPE, adGroup: "포도 자동", keyword: "사과", impressions: 500, clicks: 20, cost: 2000 }),
];

const coach = productCoach(ROWS, ctx);
const of = (name: string) => coach.find((c) => c.key === name.split(",")[0])!;

describe("상품별 광고 코칭", () => {
  it("상품마다 뺄 키워드·낮출 키워드·더 태울 키워드를 나눈다", () => {
    const apple = of(APPLE);
    assert.deepEqual(apple.scale.map((k) => k.key), ["사과"]);
    assert.deepEqual(apple.promising.map((k) => k.key), ["부사"]);
    assert.deepEqual(apple.exclude, []);
    assert.deepEqual(apple.adGroups, ["과일 수동"]);
    assert.deepEqual(of(PEAR).cut.map((k) => k.key), ["배"]);

    const grape = of(GRAPE);
    assert.deepEqual(grape.exclude.map((k) => k.key), ["포도", "사과"]);
    assert.equal(grape.wasted, 12000);
  });

  it("다른 상품에서 팔린 키워드는 따로 표시하고 복사 목록에서 뺀다", () => {
    assert.deepEqual(of(GRAPE).soldElsewhere, ["사과"]);
    assert.equal(excludeText(coach), "[샤인머스캣]\n포도");
  });

  it("클릭률이 다른 상품보다 낮으면 썸네일, 클릭은 되는데 안 팔리면 리뷰·상세페이지", () => {
    assert.deepEqual(of(APPLE).issues, []);
    assert.deepEqual(of(PEAR).issues.map((i) => i.kind), ["thumbnail"]);
    assert.deepEqual(of(GRAPE).issues.map((i) => i.kind), ["conversion"]);
    assert.match(of(GRAPE).issues[0].detail, /클릭 120회인데 주문이 없어요/);
  });

  it("비교할 상품이 없으면 클릭률·전환율은 판단하지 않고, 남지 않으면 가격·마진을 짚는다", () => {
    const [only] = productCoach([row({ product: PEAR, keyword: "배", impressions: 5000, clicks: 40, cost: 8000, orders: 2, revenue: 20000 })], ctx);
    assert.equal(only.peerCtr, null);
    assert.deepEqual(only.issues.map((i) => i.kind), ["margin"]);
  });
});
