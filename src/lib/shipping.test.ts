import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { holidayShipPlan } from "./holidayPlan.ts";
import { dateKey, deliveryDate, nextShipDate, upcomingMajorHolidays, type ShipRule } from "./shipping.ts";

// 2026-10-28 수 · 10-29 목 · 10-30 금 · 10-31 토 · 11-01 일 · 11-02 월
const rule: ShipRule = { cutoffTime: "14:00", shipWeekdays: [1, 2, 3, 4, 5], freshBlockedWeekdays: [5] };
const at = (key: string, hour: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0);
};
const key = (d: Date | null) => (d ? dateKey(d) : null);

describe("nextShipDate", () => {
  it("마감 전이면 오늘, 지나면 다음 출고일", () => {
    assert.equal(key(nextShipDate(at("2026-10-28", 10), rule, {}, false)), "2026-10-28");
    assert.equal(key(nextShipDate(at("2026-10-28", 15), rule, {}, false)), "2026-10-29");
  });

  it("신선품은 금요일 출고를 건너뛴다", () => {
    assert.equal(key(nextShipDate(at("2026-10-29", 15), rule, {}, false)), "2026-10-30");
    assert.equal(key(nextShipDate(at("2026-10-29", 15), rule, {}, true)), "2026-11-02");
  });

  it("공휴일엔 출고하지 않고, 출고 요일이 없으면 null", () => {
    assert.equal(key(nextShipDate(at("2026-10-28", 10), rule, { "2026-10-28": "임시공휴일" }, false)), "2026-10-29");
    assert.equal(nextShipDate(at("2026-10-28", 10), { ...rule, shipWeekdays: [] }, {}, false), null);
  });
});

describe("deliveryDate", () => {
  it("일요일·공휴일은 배송일로 세지 않는다", () => {
    assert.equal(key(deliveryDate(at("2026-10-30", 0), {})), "2026-10-31");
    assert.equal(key(deliveryDate(at("2026-10-30", 0), { "2026-10-31": "택배 없는 날" })), "2026-11-02");
  });
});

describe("명절 일정", () => {
  const holidays = { "2027-02-06": "설날 연휴", "2027-02-07": "설날", "2027-02-08": "설날 연휴", "2027-02-09": "대체공휴일" };

  it("설날 본날로 연휴 전체(첫날~마지막 날)를 찾는다", () => {
    const [seol] = upcomingMajorHolidays(holidays, at("2026-12-01", 0));
    assert.equal(seol.name, "설날");
    assert.equal(key(seol.first), "2027-02-06");
    assert.equal(key(seol.last), "2027-02-09");
  });

  it("연휴 2일 전 도착하도록 마지막 출고일, 연휴 뒤 첫 출고일", () => {
    const [seol] = upcomingMajorHolidays(holidays, at("2026-12-01", 0));
    // 연휴 첫날 2/6(토) − 2일 = 2/4(목)까지 도착 → 신선품은 금요일 출고 금지라 2/3(수) 출고 → 2/4 도착
    const fresh = holidayShipPlan(seol, rule, holidays, true, 2);
    assert.equal(key(fresh.lastShip), "2027-02-03");
    assert.equal(key(fresh.lastArrive), "2027-02-04");
    assert.equal(key(fresh.resumeShip), "2027-02-10");
    // 여유 0일이면 금요일(2/5) 출고 → 토요일(2/6)은 연휴 첫날이라 안 되므로 2/4(목) 출고 → 2/5 도착
    const dry = holidayShipPlan(seol, rule, holidays, false, 0);
    assert.equal(key(dry.lastShip), "2027-02-04");
    assert.equal(key(dry.lastArrive), "2027-02-05");
  });
});
