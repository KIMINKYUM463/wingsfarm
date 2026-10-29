import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDelayNotices, koreanDate, type DelayNoticeInput } from "./delayNotice.ts";

const input: DelayNoticeInput = {
  storeName: "윙스팜",
  product: "제주 감귤 5kg",
  reason: "weather",
  newDate: "2026-10-31",
  compensation: "none",
  couponAmount: 1000,
  extraItem: "",
};

describe("koreanDate", () => {
  it("날짜 키를 요일이 붙은 한국어로", () => {
    assert.equal(koreanDate("2026-10-31"), "10월 31일(토)");
  });
});

describe("buildDelayNotices", () => {
  it("톡톡·문자·공지 3종을 만들고 상품·날짜·스토어가 들어간다", () => {
    const notices = buildDelayNotices(input);
    assert.deepEqual(
      notices.map((n) => n.channel),
      ["talk", "sms", "notice"],
    );
    for (const n of notices) {
      assert.ok(n.text.includes("제주 감귤 5kg"));
      assert.ok(n.text.includes("10월 31일(토)"));
    }
    assert.ok(notices[0].text.startsWith("안녕하세요, 윙스팜입니다."));
  });

  it("보상이 없으면 보상 문구가 없고, 쿠폰이면 금액이 들어간다", () => {
    assert.ok(!buildDelayNotices(input)[0].text.includes("적립금"));
    assert.ok(buildDelayNotices({ ...input, compensation: "coupon", couponAmount: 2000 })[0].text.includes("2,000원 적립금"));
  });

  it("빈 줄이 연속으로 생기지 않는다", () => {
    for (const n of buildDelayNotices(input)) assert.ok(!n.text.includes("\n\n\n"));
  });
});
