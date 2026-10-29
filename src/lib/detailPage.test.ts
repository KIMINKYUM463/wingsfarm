import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PLACEHOLDER,
  VOLUME_PLANS,
  aiPlan,
  countPlaceholders,
  createSection,
  groupByHeight,
  moveItem,
  pendingAiImages,
  projectToText,
  resolveImageSrc,
} from "./detailPage.ts";
import { LIMITS, normalizeDraft, type DraftOutput } from "./detailPageAi.ts";

type RawSection = DraftOutput["sections"][number];

const raw = (type: RawSection["type"], image: Partial<RawSection["image"]> = {}): RawSection => ({
  type,
  eyebrow: " 라벨 ",
  headline: `${type} 제목`,
  body: "본문",
  items: [
    { title: "항목", text: "설명" },
    { title: "", text: "" },
  ],
  image: { choice: "none", productIndex: 0, prompt: "", ...image },
});

describe("normalizeDraft", () => {
  it("계획 순서대로 섹션을 만들고 교환·반품 안내를 끼워 넣는다", () => {
    const plan = aiPlan("standard");
    const { sections } = normalizeDraft({ projectName: "참외", sections: plan.map((t) => raw(t)) }, "standard", 2);
    assert.deepEqual(
      sections.map((s) => s.type),
      VOLUME_PLANS.standard,
    );
    const notice = sections.find((s) => s.type === "notice")!;
    assert.ok(notice.items.length > 0);
  });

  it("빈 항목을 버리고 문구 앞뒤 공백을 정리한다", () => {
    const { sections } = normalizeDraft({ projectName: "", sections: aiPlan("simple").map((t) => raw(t)) }, "simple", 0);
    const summary = sections.find((s) => s.type === "summary")!;
    assert.equal(summary.eyebrow, "라벨");
    assert.equal(summary.items.length, 1);
    assert.equal(sections[0].items.length, 0, "hero는 항목을 쓰지 않는다");
  });

  it("상품 사진 번호를 범위 안으로 맞추고, 사진이 없으면 AI 사진으로 바꾼다", () => {
    const plan = aiPlan("simple");
    const sections = plan.map((t) => raw(t, { choice: "product", productIndex: 9, prompt: "farm scene" }));
    const withPhotos = normalizeDraft({ projectName: "", sections }, "simple", 2).sections;
    assert.equal(withPhotos[0].image.source, "product");
    assert.equal(withPhotos[0].image.productIndex, 1);

    const noPhotos = normalizeDraft({ projectName: "", sections }, "simple", 0).sections;
    assert.equal(noPhotos[0].image.source, "ai");
  });

  it(`AI 사진은 ${LIMITS.aiImages}장까지만 지정한다`, () => {
    const sections = aiPlan("rich").map((t) => raw(t, { choice: "ai", prompt: "orchard at dawn" }));
    const result = normalizeDraft({ projectName: "", sections }, "rich", 0).sections;
    assert.equal(result.filter((s) => s.image.source === "ai").length, LIMITS.aiImages);
    assert.equal(pendingAiImages(result).length, LIMITS.aiImages);
  });

  it("사진이 지정되지 않은 hero에는 대표 상품 사진을 쓴다", () => {
    const { sections } = normalizeDraft({ projectName: "", sections: aiPlan("simple").map((t) => raw(t)) }, "simple", 3);
    assert.deepEqual([sections[0].image.source, sections[0].image.productIndex], ["product", 0]);
  });

  it("AI 응답 섹션이 모자라면 기본 섹션으로 채운다", () => {
    const { sections } = normalizeDraft({ projectName: "", sections: [raw("hero")] }, "simple", 0);
    assert.equal(sections.length, VOLUME_PLANS.simple.length);
  });
});

describe("상세페이지 유틸", () => {
  it("groupByHeight는 최대 높이를 넘지 않게 순서대로 묶는다", () => {
    assert.deepEqual(groupByHeight([6000, 6000, 6000, 20000, 100], 15000), [[0, 1], [2], [3], [4]]);
    assert.deepEqual(groupByHeight([], 15000), []);
  });

  it("moveItem은 범위를 벗어나면 그대로 둔다", () => {
    assert.deepEqual(moveItem(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
    const same = ["a", "b"];
    assert.equal(moveItem(same, 0, -1), same);
  });

  it("resolveImageSrc는 상품 사진은 원본을, 없음은 빈 문자열을 돌려준다", () => {
    const s = createSection("point", { image: { source: "product", productIndex: 1, prompt: "", src: "" } });
    assert.equal(resolveImageSrc(s.image, ["a", "b"]), "b");
    assert.equal(resolveImageSrc({ ...s.image, source: "none", src: "x" }, ["a"]), "");
  });

  it("[입력 필요]가 남은 섹션 수를 센다", () => {
    const sections = [createSection("spec"), createSection("hero"), createSection("faq", { body: `산지 ${PLACEHOLDER}` })];
    assert.equal(countPlaceholders(sections), 2);
  });

  it("projectToText는 빈 항목을 건너뛴다", () => {
    const text = projectToText({ sections: [createSection("summary", { headline: "제목", items: [{ title: "", text: "" }, { title: "당도", text: "높음" }] })] });
    assert.match(text, /· 당도: 높음/);
    assert.doesNotMatch(text, /· \n|· $/);
  });
});
