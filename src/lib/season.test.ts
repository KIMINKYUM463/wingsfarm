import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SeasonItem } from "@/types";
import { buildContentPlan } from "./contentCalendar.ts";
import { SEASON_ITEMS } from "./data/season.ts";
import { findSeasonItem } from "./season.ts";
import { parseDelimited, toTsv } from "./table.ts";

const items: SeasonItem[] = [
  { name: "사과", category: "과일", months: [9, 10, 11, 12], tip: "" },
  { name: "딸기", category: "과일", months: [12, 1, 2, 3, 4], tip: "" },
  { name: "참외", category: "과일", months: [4, 5, 6, 7], tip: "" },
  { name: "귤", category: "과일", months: [11, 12, 1, 2], tip: "" },
];
const OCT = new Date(2026, 9, 15);

describe("findSeasonItem", () => {
  const find = (name: string) => findSeasonItem(name, SEASON_ITEMS)?.name;

  it("흔한 표기·띄어쓰기도 찾는다", () => {
    assert.equal(find("샤인머스켓 2kg"), "샤인머스캣");
    assert.equal(find("샤인 머스캣 선물세트"), "샤인머스캣");
  });

  it("여러 품목이 걸리면 가장 긴 이름", () => {
    assert.equal(find("해남 절임배추 20kg"), "절임배추");
    assert.equal(find("성주 꿀참외"), "참외");
    assert.equal(find(""), undefined);
    assert.equal(find("수제 잼"), undefined);
  });
});

describe("buildContentPlan", () => {
  const holidays = { "2027-02-06": "설날 연휴", "2027-02-07": "설날", "2027-02-08": "설날 연휴" };

  it("주마다 2개(짧은 형식 1 + 긴 형식 1), 월요일 시작", () => {
    const plan = buildContentPlan(SEASON_ITEMS, [], {}, OCT, 4);
    assert.equal(plan.length, 8);
    assert.equal(plan[0].weekStart, "2026-10-12");
    assert.ok(["shorts", "threads", "chat"].includes(plan[0].format));
    assert.ok(["carousel", "blog"].includes(plan[1].format));
  });

  it("명절 7~35일 전 주에는 선물세트 글이 먼저, 시즌 직전 품목은 오픈 예고", () => {
    const plan = buildContentPlan(items, [], holidays, new Date(2027, 0, 4), 2);
    assert.equal(plan[0].item, "설날 선물세트");
    const dec = buildContentPlan(items, [], {}, new Date(2026, 10, 16), 1);
    assert.ok(dec.some((p) => p.item === "딸기" && p.angle.includes("오픈")));
  });

  it("내 상품 품목을 먼저 배치", () => {
    // 2월 중순: 귤은 막바지(12점), 딸기는 제철(8점) → 딸기가 내 상품이면 +10으로 앞선다
    assert.equal(buildContentPlan(items, [], {}, new Date(2027, 1, 15), 1)[0].item, "귤");
    assert.equal(buildContentPlan(items, ["프리미엄 딸기 1kg"], {}, new Date(2027, 1, 15), 1)[0].item, "딸기");
  });
});

describe("table", () => {
  it("따옴표 안의 쉼표·줄바꿈을 지키고 빈 줄은 버린다", () => {
    assert.deepEqual(parseDelimited('주문번호,주소\n1,"서울, 강남구\n101동"\n\n2,부산'), [
      ["주문번호", "주소"],
      ["1", "서울, 강남구\n101동"],
      ["2", "부산"],
    ]);
  });

  it("탭이 있으면 탭으로 나눈다 (엑셀 붙여넣기)", () => {
    assert.deepEqual(parseDelimited("a\tb,c\n1\t2"), [
      ["a", "b,c"],
      ["1", "2"],
    ]);
  });

  it("TSV는 칸 안의 탭·줄바꿈을 공백으로", () => {
    assert.equal(toTsv([["a\tb", "c\nd"]]), "a b\tc d");
  });
});
