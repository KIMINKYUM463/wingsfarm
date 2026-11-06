import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdRow } from "./coupangAds.ts";
import { keywordSales, manualBidGroups, mentionsCore, optionBoard, soldLines, splitRelatedSpend } from "./adOptions.ts";
import { groupRows } from "./coupangAds.ts";

const row = (patch: Partial<AdRow>): AdRow => ({
  date: "",
  campaign: "",
  adGroup: "",
  adType: "",
  product: "",
  optionId: "",
  convProduct: "",
  keyword: "",
  placement: "",
  impressions: 0,
  clicks: 0,
  cost: 0,
  orders: 0,
  revenue: 0,
  units: 0,
  directRevenue: 0,
  revenue1d: 0,
  ...patch,
});

const be = () => 300;

describe("옵션과 팔린 줄", () => {
  const rows = [
    row({ date: "20261101", product: "홍게,1kg", optionId: "A", keyword: "홍게", cost: 1000, revenue: 0, orders: 0, clicks: 4, impressions: 40 }),
    row({ date: "20261105", product: "홍게,1kg", optionId: "A", keyword: "손질", cost: 500, revenue: 20000, orders: 1, clicks: 3, impressions: 20 }),
    row({ date: "20261102", product: "홍게,2kg", optionId: "B", keyword: "홍게", cost: 800, revenue: 9000, orders: 1, clicks: 2, impressions: 10 }),
  ];

  it("옵션ID로 묶고 광고비가 큰 순이다", () => {
    const board = optionBoard(rows, be);
    assert.deepEqual(board.map((o) => o.key), ["A", "B"]);
    assert.equal(board[0]?.label, "홍게 · 1kg");
    assert.equal(board[0]?.metrics.revenue, 20000);
  });

  it("매출이 난 줄만 최근 날짜부터", () => {
    const sold = soldLines(rows);
    assert.deepEqual(sold.map((s) => s.date), ["20261105", "20261102"]);
    assert.equal(sold[0]?.keyword, "손질");
  });
});

describe("수동 입찰과 전환 상품", () => {
  it("손익분기를 넘고 노출이 적으면 수동 입찰 후보", () => {
    const groups = groupRows(
      [
        row({ keyword: "숨은", impressions: 30, clicks: 4, cost: 1000, orders: 1, revenue: 8000 }),
        row({ keyword: "이미큼", impressions: 500, clicks: 40, cost: 4000, orders: 3, revenue: 40000 }),
      ],
      (r) => r.keyword,
      be,
    );
    assert.deepEqual(manualBidGroups(groups).map((g) => g.key), ["숨은"]);
  });

  it("키워드로 팔린 상품을 매출 순으로", () => {
    const group = groupRows(
      [
        row({ keyword: "홍게", product: "홍게", convProduct: "홍게 1kg", orders: 1, revenue: 10000, units: 1 }),
        row({ keyword: "홍게", product: "홍게", convProduct: "홍게 2kg", orders: 2, revenue: 30000, units: 2 }),
      ],
      (r) => r.keyword,
      be,
    )[0]!;
    const sales = keywordSales(group);
    assert.equal(sales[0]?.productName, "홍게 2kg");
    assert.equal(sales[0]?.orders, 2);
  });
});

describe("상품명과 키워드", () => {
  const garlic = "[알 굵은 의성마늘] 향 강하고 알찬 국내산 농가직송 육쪽마늘";

  it("품목 단어가 있으면 관련으로 두고, 없으면 확인 목록에 넣는다", () => {
    assert.equal(mentionsCore("깐마늘", garlic), true);
    assert.equal(mentionsCore("의성마늘", garlic), true);
    assert.equal(mentionsCore("김치", garlic), false);
    assert.equal(mentionsCore("깐마늘", "[알 굵은 의성마늘] 향 강하고 알찬 국내산"), true);
    const split = splitRelatedSpend([
      row({ product: garlic, keyword: "깐마늘", cost: 3000 }),
      row({ product: garlic, keyword: "김치", cost: 5000 }),
      row({ product: garlic, keyword: "-", cost: 9000 }),
    ]);
    assert.deepEqual(split.related.map((k) => k.keyword), ["깐마늘"]);
    assert.deepEqual(split.products[0]?.keywords.map((k) => k.keyword), ["김치"]);
  });
});
