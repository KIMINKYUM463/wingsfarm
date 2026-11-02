import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { KamisPrice } from "./kamis.ts";
import { LANES, STAGES, STAGE_TICKS, findPrice, initialLine, laneQueue, productIcon, stageText, stepLine, type LineState, type Product } from "./aiTeam.ts";

const product = (name: string, category: Product["category"], score: number, growth: number, inSeason = false): Product => ({ name, category, inSeason, trend: { score, growth } });
const price = (patch: Partial<KamisPrice>): KamisPrice => ({
  id: "x",
  cls: "도매",
  category: "과일류",
  name: "사과/후지",
  unit: "10kg",
  latestDate: "당일",
  today: 50000,
  dayAgo: null,
  monthAgo: 40000,
  yearAgo: null,
  ...patch,
});

const products = [product("사과", "과일", 80, 0.1), product("딸기", "과일", 40, 0.9), product("배추", "채소", 60, -0.2), product("감귤", "과일", 1, 2)];
const [fruit, veg, rising] = LANES;

const run = (state: LineState, ticks: number, queues: Product[][]) => {
  const events = [];
  for (let t = 0; t < ticks; t++) {
    const next = stepLine(state, queues);
    state = next.state;
    events.push(...next.events);
  }
  return { state, events };
};

describe("AI 팀 소싱 라인", () => {
  it("라인마다 많이 찾는 순·급상승 순으로 고르고, 관심도가 낮은 품목은 뺀다", () => {
    assert.deepEqual(laneQueue(fruit, products, 3).map((p) => p.name), ["사과", "딸기"]);
    assert.deepEqual(laneQueue(veg, products, 3).map((p) => p.name), ["배추"]);
    assert.deepEqual(laneQueue(rising, products, 3).map((p) => p.name), ["딸기", "사과", "배추"]);
  });

  it("실시간 검색이 없으면 제철 품목으로 돈다", () => {
    const season: Product[] = [
      { name: "사과", category: "과일", inSeason: true, trend: null },
      { name: "수박", category: "과일", inSeason: false, trend: null },
    ];
    assert.deepEqual(laneQueue(fruit, season, 3).map((p) => p.name), ["사과"]);
    assert.equal(stageText(0, season[0], { farm: undefined, price: undefined }), "'사과' 지금 제철이에요");
  });

  it("포착 → 산지 → 시세 → 담기를 거쳐 다음 품목으로 넘어가고, 담을 때마다 1건", () => {
    const queues = [[products[0], products[1]], [], []];
    const start: LineState = { lanes: [{ cursor: 0, stage: 0, wait: 1 }, ...initialLine().lanes.slice(1)], done: 0 };
    const stages: number[] = [];
    let state = start;
    const events = [];
    for (let t = 0; t < STAGE_TICKS * STAGES.length * 2; t++) {
      const next = stepLine(state, queues);
      state = next.state;
      events.push(...next.events);
      stages.push(state.lanes[0].stage);
    }
    assert.deepEqual([...new Set(stages)], [1, 2, 3, 0]);
    assert.deepEqual(events.map((e) => e.product.name), ["사과", "딸기"]);
    assert.equal(state.done, 2);
    assert.deepEqual(state.lanes.slice(1), start.lanes.slice(1), "품목 없는 라인은 그대로");
  });

  it("오래 돌려도 커서가 줄 안에 있다", () => {
    const queues = LANES.map((lane) => laneQueue(lane, products, 3));
    const { state, events } = run(initialLine(), 500, queues);
    state.lanes.forEach((s, i) => assert.ok(s.cursor < queues[i].length && s.stage <= 3));
    assert.equal(state.done, events.length);
  });

  it("도매 시세를 먼저 찾고, 품목명 앞부분이 정확히 같아야 한다", () => {
    const items = [price({ cls: "소매", unit: "1개", today: 3000 }), price({}), price({ name: "사과대추", today: 9000 })];
    assert.deepEqual(findPrice("사과", items), { cls: "도매", unit: "10kg", price: 50000, monthChange: 0.25 });
    assert.equal(findPrice("배", items), null);
  });

  it("단계별 말풍선 — 불러오는 중·데이터 없음·실제 값", () => {
    const apple = products[0];
    assert.equal(stageText(0, apple, { farm: undefined, price: undefined }), "'사과' 검색 관심도 80 · 4주 대비 +10%");
    assert.match(stageText(1, apple, { farm: undefined, price: undefined }), /찾는 중/);
    assert.match(stageText(1, apple, { farm: null, price: undefined }), /직접 찾기/);
    assert.equal(stageText(1, apple, { farm: { total: 1463, regions: 120, topRegion: "경북 청송군" }, price: undefined }), "경북 청송군 등 120개 시군구 · 산지 1,463곳");
    assert.equal(stageText(2, apple, { farm: null, price: { cls: "도매", unit: "10kg", price: 50000, monthChange: 0.25 } }), "도매 10kg 50,000원 · 한 달 ▲25%");
    assert.match(stageText(3, apple, { farm: null, price: null }), /담았어요/);
    assert.equal(productIcon(apple), "🍎");
    assert.equal(productIcon(product("고등어", "수산", 1, 0)), "🐟");
  });
});
