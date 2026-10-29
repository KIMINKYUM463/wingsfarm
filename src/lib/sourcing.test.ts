import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Channel, CostDefaults, SeasonItem, SourcingCandidate } from "@/types";
import { buildContentPlan } from "./contentCalendar.ts";
import { SEASON_ITEMS } from "./data/season.ts";
import { findSeasonItem } from "./season.ts";
import { demandScore, evaluateCandidate, verdictOf } from "./sourcing.ts";
import { parseDelimited, toCsv, toTsv } from "./table.ts";

const channel: Channel = { id: "naver", name: "스마트스토어", saleFeeRate: 2, paymentFeeRate: 3.63, shippingFeeRate: 3.63 };
const costs: CostDefaults = { adRate: 10, lossRate: 3, targetMargin: 15, customerShippingFee: 0, roundUnit: 100 };
const items: SeasonItem[] = [
  { name: "사과", category: "과일", months: [9, 10, 11, 12], tip: "" },
  { name: "딸기", category: "과일", months: [12, 1, 2, 3, 4], tip: "" },
  { name: "참외", category: "과일", months: [4, 5, 6, 7], tip: "" },
  { name: "귤", category: "과일", months: [11, 12, 1, 2], tip: "" },
];
const candidate = (patch: Partial<SourcingCandidate>): SourcingCandidate => ({
  id: "c",
  name: "사과 5kg",
  category: "과일",
  supplyPrice: 20000,
  salePrice: 39900,
  extraCost: 0,
  channelId: "naver",
  taxFree: true,
  monthlySearch: 50000,
  scores: { competition: 3, safety: 4, supply: 4 },
  note: "",
  ...patch,
});
const OCT = new Date(2026, 9, 15);

describe("sourcing", () => {
  it("검색수 점수는 로그 척도 (100회 0점 ~ 10만 회 1점, 미확인은 중간)", () => {
    assert.equal(demandScore(100), 0);
    assert.equal(demandScore(100_000), 1);
    assert.equal(demandScore(null), 0.5);
  });

  it("제철·마진 좋은 후보는 추천, 역마진·비시즌 후보는 보류와 조언", () => {
    const good = evaluateCandidate(candidate({}), channel, costs, items, OCT);
    assert.equal(good.seasonText, "지금 제철");
    assert.ok(good.total >= 70, `total ${good.total}`);
    assert.equal(verdictOf(good.total).label, "추천");

    const bad = evaluateCandidate(candidate({ name: "참외 2kg", salePrice: 19000, monthlySearch: 300, scores: { competition: 1, safety: 1, supply: 2 } }), channel, costs, items, OCT);
    assert.ok(bad.profit < 0);
    assert.equal(verdictOf(bad.total).label, "보류");
    assert.ok(bad.advice.some((a) => a.includes("역마진")));
    assert.ok(bad.advice.some((a) => a.includes("검색 수요")));
    assert.ok(bad.targetPrice! > 19000);
  });
});

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

  it("CSV는 BOM·이스케이프, TSV는 칸 안의 탭·줄바꿈을 공백으로", () => {
    assert.equal(toCsv([["a", 'b"c'], ["1,2", "x"]]), '\uFEFFa,"b""c"\r\n"1,2",x');
    assert.equal(toTsv([["a\tb", "c\nd"]]), "a b\tc d");
  });
});
