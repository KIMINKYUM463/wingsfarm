import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AI_TEAM, botOf, bubbleOf, initialTeam, positionOf, stepTeam, type TeamState } from "./aiTeam.ts";

const always = (n: number) => () => n;

/** 매 틱 진척도가 꽉 차고(rand=0.99) 항상 동료를 찾아가게(rand<0.6) 하려면 값을 번갈아 준다. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const run = (state: TeamState, ticks: number, rand: () => number) => {
  for (let t = 0; t < ticks; t++) state = stepTeam(state, rand).state;
  return state;
};

describe("AI 팀 연출", () => {
  it("모든 handoff 대상이 실제 팀원이다", () => {
    for (const bot of AI_TEAM) for (const h of bot.handoffs) assert.ok(botOf(h.to), `${bot.id} → ${h.to}`);
  });

  it("일을 끝내면 완료 이벤트를 내고 다음 일로 넘어간다", () => {
    const start: TeamState = { ...initialTeam(), bots: initialTeam().bots.map((b) => ({ ...b, progress: 95 })) };
    const { state, events } = stepTeam(start, always(0.99));
    assert.equal(state.done, AI_TEAM.length);
    assert.ok(events.some((e) => e.text === botOf("trend").tasks[0].done));
    assert.ok(state.bots.every((b) => b.task === 1 && b.progress === 0 && b.phase === "work"));
  });

  it("가기 → 전달 → 복귀 → 일 순서로 돌고, 한 동료에게 둘이 동시에 가지 않는다", () => {
    let state = initialTeam();
    const rand = sequence(0.99, 0, 0.1);
    const phases = new Set<string>();
    for (let t = 0; t < 60; t++) {
      state = stepTeam(state, rand).state;
      const targets = state.bots.filter((b) => b.to).map((b) => b.to);
      assert.equal(new Set(targets).size, targets.length, "같은 동료를 둘이 찾아감");
      for (const b of state.bots) {
        phases.add(b.phase);
        if (b.to) assert.notEqual(b.to, b.id);
      }
    }
    assert.deepEqual([...phases].sort(), ["back", "go", "meet", "work"]);
  });

  it("방문 중엔 상대 책상 옆, 복귀하면 자기 책상", () => {
    const s = { ...initialTeam().bots[0], phase: "meet" as const, to: "detail" as const, say: "안녕" };
    assert.deepEqual(positionOf(s), { x: botOf("detail").desk.x - 10, y: botOf("detail").desk.y });
    assert.deepEqual(positionOf({ ...s, phase: "back" }), botOf("trend").desk);
  });

  it("찾아온 동료가 있으면 대답 말풍선을 띄운다", () => {
    const bots = initialTeam().bots.map((b) => (b.id === "trend" ? { ...b, phase: "meet" as const, to: "detail" as const, say: "급상승!" } : b));
    assert.equal(bubbleOf(bots[0], bots), "급상승!");
    assert.match(bubbleOf(bots.find((b) => b.id === "detail")!, bots), /받았어요/);
  });

  it("오래 돌려도 상태가 망가지지 않는다", () => {
    const state = run(initialTeam(), 500, sequence(0.3, 0.7, 0.1, 0.9, 0.5));
    assert.equal(state.bots.length, AI_TEAM.length);
    for (const b of state.bots) assert.ok(b.progress >= 0 && b.progress < 100 && b.task < botOf(b.id).tasks.length);
  });
});
