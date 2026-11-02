import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AdRow } from "./coupangAds.ts";
import type { AdAction, ReportPeriod } from "./adInsights.ts";
import { createFollowup, evaluateFollowup, reportSnapshot, snapshotDaily, withFollowup, withReport, type AdFollowup } from "./adFollowup.ts";

const row = (patch: Partial<AdRow>): AdRow => ({
  date: "", campaign: "", adGroup: "", adType: "", product: "", optionId: "", convProduct: "", keyword: "", placement: "",
  impressions: 0, clicks: 0, cost: 0, orders: 0, revenue: 0, units: 0, directRevenue: 0, revenue1d: 0, ...patch,
});

const OCT: ReportPeriod = { from: "2026-10-01", to: "2026-10-10", days: 10 };
const NOV: ReportPeriod = { from: "2026-11-05", to: "2026-11-09", days: 5 };
const breakEvenOf = () => 300;

const BEFORE = [
  row({ keyword: "무 싸게", product: "국산 무,10kg", clicks: 20, cost: 10000 }),
  row({ keyword: "무 10kg", product: "국산 무,10kg", clicks: 40, cost: 30000, orders: 3, revenue: 60000 }),
];

const action = (id: string, targets: string[]): AdAction => ({ id, tone: "loss", title: "", detail: "", impact: null, targets });
const record = (id: string, targets: string[], rows = BEFORE): AdFollowup =>
  createFollowup(action(id, targets), { rows, period: OCT, breakEvenOf, costMultiplier: 1, doneAt: "2026-11-03", id: "f1" })!;

describe("조치 기록", () => {
  it("대상의 기준값을 담고, 비교할 수 없는 항목은 null", () => {
    const f = record("exclude", ["무 싸게", "없는 키워드"]);
    assert.deepEqual(f.items, [{ key: "무 싸게", cost: 10000, revenue: 0, orders: 0, clicks: 20, breakEven: 300 }]);
    assert.equal(createFollowup(action("option", ["무 싸게"]), { rows: BEFORE, period: OCT, breakEvenOf, costMultiplier: 1, doneAt: "2026-11-03", id: "x" }), null);
    assert.equal(createFollowup(action("exclude", ["무 싸게"]), { rows: BEFORE, period: null, breakEvenOf, costMultiplier: 1, doneAt: "2026-11-03", id: "x" }), null);
  });

  it("같은 보고서·같은 조치는 교체", () => {
    const a = record("exclude", ["무 싸게"]);
    const list = withFollowup(withFollowup([], a), { ...a, id: "f2" });
    assert.deepEqual(list.map((f) => f.id), ["f2"]);
  });
});

describe("전후 비교", () => {
  it("제외 키워드가 사라지면 하루 광고비만큼 남긴 돈이 는다", () => {
    const r = evaluateFollowup(record("exclude", ["무 싸게"]), [row({ keyword: "무 10kg", clicks: 5, cost: 1000 })], NOV);
    assert.equal(r.status, "ready");
    assert.equal(r.before.cost, 1000);
    assert.equal(r.after?.cost, 0);
    assert.equal(r.profitDelta, 1000);
    assert.equal(r.verdict, "better");
    assert.equal(r.matched, 0);
  });

  it("기간 길이가 달라도 하루 평균으로 비교", () => {
    // 전: 10일 광고비 30000 매출 60000 → 하루 3000 / 6000, 이익 (20000-30000)/10 = -1000
    // 후: 5일 광고비 10000 매출 45000 → 하루 2000 / 9000, 이익 (15000-10000)/5 = +1000
    const r = evaluateFollowup(record("cut", ["무 10kg"]), [row({ keyword: "무 10kg", cost: 10000, orders: 2, revenue: 45000 })], NOV);
    assert.deepEqual([r.before.cost, r.before.revenue, r.before.profit], [3000, 6000, -1000]);
    assert.deepEqual([r.after?.cost, r.after?.revenue, r.after?.profit], [2000, 9000, 1000]);
    assert.equal(r.after?.roas, 450);
    assert.equal(r.profitDelta, 2000);
  });

  it("조치 전 보고서·같은 보고서는 기다리고, 날짜가 섞이면 partial", () => {
    const f = record("exclude", ["무 싸게"]);
    assert.equal(evaluateFollowup(f, BEFORE, OCT).status, "waiting");
    assert.equal(evaluateFollowup(f, BEFORE, { from: "2026-10-20", to: "2026-11-02", days: 14 }).status, "waiting");
    assert.equal(evaluateFollowup(f, BEFORE, { from: "2026-10-25", to: "2026-11-08", days: 15 }).status, "partial");
    assert.equal(evaluateFollowup(f, BEFORE, null).status, "waiting");
  });

  it("키워드 열이 없는 보고서는 0으로 착각하지 않는다", () => {
    const r = evaluateFollowup(record("exclude", ["무 싸게"]), [row({ product: "국산 무,10kg", cost: 5000 })], NOV);
    assert.equal(r.status, "unsupported");
    assert.equal(r.profitDelta, null);
  });

  it("상품 조치는 옵션을 뗀 이름으로 묶는다", () => {
    const f = record("products", ["국산 무"]);
    assert.equal(f.items[0].cost, 40000);
    const r = evaluateFollowup(f, [row({ product: "국산 무,20kg", cost: 5000 })], NOV);
    assert.equal(r.matched, 1);
    assert.equal(r.after?.cost, 1000);
  });

  it("작은 변화는 변화 없음", () => {
    const r = evaluateFollowup(record("cut", ["무 10kg"]), [row({ keyword: "무 10kg", cost: 15000, revenue: 30000 })], NOV);
    assert.equal(r.profitDelta, 0);
    assert.equal(r.verdict, "flat");
  });
});

describe("보고서 기록", () => {
  it("같은 기간은 교체하고 기간 순으로 정렬", () => {
    const oct = reportSnapshot(BEFORE, OCT, breakEvenOf)!;
    const nov = reportSnapshot(BEFORE.slice(1), NOV, breakEvenOf)!;
    const list = withReport(withReport(withReport([], nov), oct), { ...oct, cost: 1 });
    assert.deepEqual(list.map((s) => [s.from, s.cost]), [["2026-10-01", 1], ["2026-11-05", 30000]]);
    assert.equal(reportSnapshot(BEFORE, null, breakEvenOf), null);
  });

  it("하루 지표는 부가세 배율을 다시 곱한다", () => {
    const d = snapshotDaily(reportSnapshot(BEFORE, OCT, breakEvenOf)!, 1.1);
    assert.equal(d.cost, 4400);
    assert.equal(d.revenue, 6000);
    assert.equal(Math.round(d.profit!), -2400);
  });
});
