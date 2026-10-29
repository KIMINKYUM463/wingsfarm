import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countThemes, splitReviews } from "./reviewKeywords.ts";

const themesOf = (review: string) => countThemes([review]).map((t) => t.theme.id);

describe("리뷰 빠른 집계", () => {
  it("빈 줄이 있으면 빈 줄 기준, 없으면 줄 단위로 나눈다", () => {
    assert.deepEqual(splitReviews("달아요\n최고\n\n작아요"), ["달아요 최고", "작아요"]);
    assert.deepEqual(splitReviews("달아요\r\n작아요\n.\n"), ["달아요", "작아요"]);
  });

  it("자주 쓰는 활용형을 잡는다", () => {
    assert.deepEqual(themesOf("두 개가 터져서 왔어요"), ["damage"]);
    assert.deepEqual(themesOf("포장도 꼼꼼해요"), ["good-pack"]);
    assert.deepEqual(themesOf("당도가 높아요"), ["good-taste"]);
    assert.deepEqual(themesOf("아이스팩도 녹아서 왔네요"), ["packaging"]);
    assert.deepEqual(themesOf("상한 게 있었어요"), ["spoiled"]);
  });

  it("비율은 전체 리뷰 수 기준", () => {
    const [taste] = countThemes(["맛있어요", "작아요", "달고 좋아요", "늦게 왔어요"]).filter((t) => t.theme.id === "good-taste");
    assert.equal(taste.count, 2);
    assert.equal(taste.share, 0.5);
  });
});
