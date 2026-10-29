import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkListing, highlightParts, listingScore } from "./listingCheck.ts";
import { buildOriginLabel, buildQualityLine, missingNoticeFields } from "./productNotice.ts";

const ids = (title: string, body = "", origin = "국내산(경북 청송군)") => checkListing({ title, body, origin }).map((f) => f.id);

describe("checkListing", () => {
  it("효능 표현은 위험, 상품명의 배송·할인 문구는 주의", () => {
    const findings = checkListing({ title: "청송 사과 무료배송 면역력 강화", body: "", origin: "국내산(경북 청송군)" });
    assert.equal(findings[0].severity, "danger");
    assert.ok(findings.some((f) => f.id === "efficacy" && f.match === "면역력"));
    assert.ok(findings.some((f) => f.id === "title-policy" && f.match === "무료배송"));
  });

  it("'파손 예방 포장'은 효능 표현이 아니다", () => {
    assert.ok(!ids("청송 사과 5kg", "파손 예방 포장으로 보내드려요").includes("efficacy"));
    assert.ok(ids("청송 사과 5kg", "질병 예방에 좋아요").includes("efficacy"));
  });

  it("Brix 수치가 있으면 '고당도'를, 개당 중량이 있으면 '대과'를 넘어간다", () => {
    assert.ok(ids("고당도 사과").includes("brix"));
    assert.ok(!ids("고당도 사과 13Brix 선별").includes("brix"));
    assert.ok(ids("사과 대과 5kg").includes("size"));
    assert.ok(!ids("사과 대과 5kg 16~18과").includes("size"));
  });

  it("상품명 산지와 원산지가 다르면 위험, 수입산에 나라가 없으면 위험", () => {
    const mismatch = checkListing({ title: "성주 참외 2kg", body: "", origin: "국내산(경북 상주시)" });
    assert.ok(mismatch.some((f) => f.id === "origin-mismatch" && f.severity === "danger"));
    assert.ok(ids("체리 1kg", "", "수입산").includes("origin-country"));
    assert.ok(!ids("체리 1kg", "", "미국산").includes("origin-country"));
    assert.ok(ids("체리 1kg", "", "").includes("origin-missing"));
  });

  it("폐지된 저농약 인증, 반복 단어, 이모지", () => {
    const list = ids("사과 사과 저농약 🍎");
    assert.ok(list.includes("low-pesticide"));
    assert.ok(list.includes("repeat"));
    assert.ok(list.includes("emoji"));
  });

  it("깨끗한 상품명은 100점", () => {
    const findings = checkListing({ title: "청송 부사 사과 5kg 16~18과 13Brix 선별", body: "", origin: "국내산(경북 청송군)" });
    assert.deepEqual(findings, []);
    assert.equal(listingScore(findings), 100);
  });
});

describe("highlightParts", () => {
  it("문제 구간만 잘라 표시하고 나머지는 그대로 이어 붙인다", () => {
    const title = "사과 무료배송 특가";
    const parts = highlightParts(title, checkListing({ title, body: "", origin: "국내산" }), "title");
    assert.equal(parts.map((p) => p.text).join(""), title);
    assert.deepEqual(
      parts.filter((p) => p.severity).map((p) => p.text),
      ["무료배송", "특가"],
    );
  });
});

describe("productNotice", () => {
  it("원산지 표기", () => {
    assert.equal(buildOriginLabel({ domestic: true, region: "경북 성주군" }), "원산지: 국내산(경북 성주군)");
    assert.equal(buildOriginLabel({ domestic: false, region: "칠레산" }), "원산지: 칠레산");
    assert.equal(buildOriginLabel({ domestic: false, region: "" }), "");
  });

  it("크기·당도·등급 한 줄 (과수는 개당 중량 범위로 계산)", () => {
    assert.equal(buildQualityLine({ totalKg: 5, minGram: 250, maxGram: 300, brix: 13, grade: "특" }), "총 5kg (16~20과 내외) · 개당 250~300g · 당도 13Brix 이상 선별 · 등급 특 (농산물 표준규격)");
  });

  it("필수 고시 항목 누락", () => {
    assert.ok(missingNoticeFields("fresh", { name: "참외" }).some((f) => f.key === "origin"));
  });
});
