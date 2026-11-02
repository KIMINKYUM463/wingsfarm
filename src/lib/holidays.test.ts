import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dateKey, upcomingMajorHolidays } from "./holidays.ts";

describe("명절 일정", () => {
  const holidays = { "2027-02-06": "설날 연휴", "2027-02-07": "설날", "2027-02-08": "설날 연휴", "2027-02-09": "대체공휴일" };

  it("설날 본날로 연휴 전체(첫날~마지막 날)를 찾는다", () => {
    const [seol] = upcomingMajorHolidays(holidays, new Date(2026, 11, 1));
    assert.equal(seol.name, "설날");
    assert.equal(dateKey(seol.first), "2027-02-06");
    assert.equal(dateKey(seol.last), "2027-02-09");
  });

  it("지난 명절은 빼고 가까운 순으로", () => {
    assert.deepEqual(upcomingMajorHolidays(holidays, new Date(2027, 1, 8)), []);
  });
});
