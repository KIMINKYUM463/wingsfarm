import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dateChunks, money, summarizeOrderSheets, toIsoDate, totalSalesView, type WingOrderSheet } from "./coupangWing.ts";

describe("쿠팡 윙 매출 집계", () => {
  it("보고서 날짜 형식을 YYYY-MM-DD로 맞춘다", () => {
    assert.equal(toIsoDate("20261020"), "2026-10-20");
    assert.equal(toIsoDate("2026.10.5"), "2026-10-05");
    assert.equal(toIsoDate("2026/10/20 (화)"), "2026-10-20");
    assert.equal(toIsoDate("합계"), null);
    assert.equal(toIsoDate("20261320"), null);
  });

  it("기간을 30일씩 끊는다 (양 끝 포함)", () => {
    assert.deepEqual(dateChunks("2026-10-01", "2026-10-14"), [["2026-10-01", "2026-10-14"]]);
    assert.deepEqual(dateChunks("2026-09-01", "2026-10-31"), [
      ["2026-09-01", "2026-09-30"],
      ["2026-10-01", "2026-10-30"],
      ["2026-10-31", "2026-10-31"],
    ]);
  });

  it("금액은 숫자·{units} 둘 다 읽는다", () => {
    assert.equal(money(19900), 19900);
    assert.equal(money({ units: 19900, nanos: 0 }), 19900);
    assert.equal(money(null), 0);
  });

  it("주문일 기준으로 취소 수량을 빼고, 같은 배송번호는 한 번만 센다", () => {
    const sheets: WingOrderSheet[] = [
      {
        shipmentBoxId: 1,
        orderId: 11,
        orderedAt: "2026-10-20T09:10:00+09:00",
        orderItems: [{ sellerProductName: "홍게 2kg", salesPrice: { units: 30000 }, shippingCount: 2, cancelCount: 1 }],
      },
      { shipmentBoxId: 1, orderId: 11, orderedAt: "2026-10-20T09:10:00+09:00", orderItems: [{ sellerProductName: "홍게 2kg", salesPrice: 30000, shippingCount: 2 }] },
      { shipmentBoxId: 2, orderId: 12, orderedAt: "2026-10-21T23:59:00+09:00", orderItems: [{ vendorItemName: "사과 5kg", salesPrice: 25000, shippingCount: 1 }] },
      { shipmentBoxId: 3, orderId: 13, orderedAt: "2026-10-21T10:00:00+09:00", orderItems: [{ sellerProductName: "홍게 2kg", salesPrice: 30000, shippingCount: 1, holdCountForCancel: 1 }] },
      { shipmentBoxId: 4, orderId: 14, orderedAt: "2026-10-22T00:00:01+09:00", orderItems: [{ sellerProductName: "홍게 2kg", salesPrice: 30000, shippingCount: 1 }] },
    ];
    const s = summarizeOrderSheets(sheets, "2026-10-20", "2026-10-21");
    assert.deepEqual(s.total, { sales: 55000, orders: 2, units: 2 });
    assert.deepEqual(s.days, [
      { date: "2026-10-20", sales: 30000, orders: 1 },
      { date: "2026-10-21", sales: 25000, orders: 1 },
    ]);
    assert.deepEqual(s.products.map((p) => p.name), ["홍게 2kg", "사과 5kg"]);
  });

  it("전체 매출 대비 광고비를 광고 전 이익률과 비교한다", () => {
    // 손익분기 ROAS 400% → 이익률 25%. 광고비 100만 / 전체 매출 500만 = 20% → 감당 가능
    const v = totalSalesView(1_000_000, 3_000_000, 5_000_000, 400);
    assert.equal(v.tacos, 0.2);
    assert.equal(v.limit, 0.25);
    assert.equal(v.adShare, 0.6);
    assert.equal(v.organic, 2_000_000);
    assert.equal(v.healthy, true);
    assert.equal(totalSalesView(1_000_000, 0, 0, 400).healthy, null);
  });
});
