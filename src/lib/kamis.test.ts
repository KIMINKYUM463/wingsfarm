import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { priceIcon, splitItemName } from "./kamis.ts";

describe("splitItemName", () => {
  it("품목과 품종을 나눈다", () => {
    assert.deepEqual(splitItemName("오이/가시계통", "10kg"), { main: "오이", sub: "가시계통" });
  });

  it("품목과 같은 품종·단위는 생략한다", () => {
    assert.deepEqual(splitItemName("가지/가지", "5kg"), { main: "가지", sub: "" });
    assert.deepEqual(splitItemName("쌀/20kg", "20kg"), { main: "쌀", sub: "" });
    assert.deepEqual(splitItemName("쌀/20kg(햅쌀)", "20kg"), { main: "쌀", sub: "햅쌀" });
  });

  it("품종이 없으면 품목만", () => {
    assert.deepEqual(splitItemName("감자"), { main: "감자", sub: "" });
  });
});

describe("priceIcon", () => {
  it("품목 아이콘을 먼저 쓴다", () => {
    assert.equal(priceIcon({ name: "양배추/양배추", category: "채소류" }), "🥬");
    assert.equal(priceIcon({ name: "배/신고", category: "과일류" }), "🍐");
    assert.equal(priceIcon({ name: "새송이버섯/새송이", category: "특용작물" }), "🍄");
  });

  it("모르는 품목은 부류 아이콘, 부류도 모르면 상자", () => {
    assert.equal(priceIcon({ name: "단감/단감", category: "과일류" }), "🍎");
    assert.equal(priceIcon({ name: "알수없음", category: "기타" }), "📦");
  });
});
