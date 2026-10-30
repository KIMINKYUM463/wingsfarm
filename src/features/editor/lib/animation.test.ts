import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { KonvaElement } from '@/shared/types/konva';
import {
  ANIMATION_EFFECTS,
  canUseEffect,
  collectAnimated,
  countUpText,
  effectInfo,
  frameTimes,
  normalizeAnimation,
  pageLengthOf,
  poseAt,
  STILL_POSE,
  typedText,
} from './animation.ts';

const text = (value: string) => ({ id: 't', type: 'text', text: value }) as unknown as KonvaElement;
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`);

describe('시점별 모습', () => {
  it('나타나는 효과는 시작 전엔 안 보이고 끝나면 원래 모습', () => {
    for (const effect of ['fade', 'slide', 'zoom'] as const) {
      const anim = { effect, delay: 1, duration: 0.8 };
      assert.equal(poseAt(anim, 0.5).opacity, 0);
      assert.deepEqual(poseAt(anim, 1.8), STILL_POSE);
      assert.deepEqual(poseAt(anim, 4), STILL_POSE);
    }
  });

  it('슬라이드는 아래에서, 줌은 작게 시작한다', () => {
    assert.equal(poseAt({ effect: 'slide', delay: 0, duration: 1 }, 0).dy, 80);
    assert.equal(poseAt({ effect: 'zoom', delay: 0, duration: 1 }, 0).scale, 0.6);
  });

  it('타이핑은 일정하게, 카운트업은 끝에서 느려진다', () => {
    near(poseAt({ effect: 'typing', delay: 0, duration: 2 }, 1).reveal, 0.5);
    assert.ok(poseAt({ effect: 'countUp', delay: 0, duration: 2 }, 1).reveal > 0.5);
  });

  it('반복 효과는 매 주기 처음 모습으로 돌아온다', () => {
    const blink = { effect: 'blink', delay: 0.5, duration: 1 } as const;
    near(poseAt(blink, 0.5).opacity, 1);
    near(poseAt(blink, 1).opacity, 0.2);
    near(poseAt(blink, 2.5).opacity, 1);
    const bounce = { effect: 'bounce', delay: 0, duration: 0.8 } as const;
    near(poseAt(bounce, 0.4).dy, -24);
    near(poseAt(bounce, 1.6).dy, 0);
    assert.deepEqual(poseAt(bounce, -1), STILL_POSE);
  });
});

describe('글자 효과', () => {
  it('타이핑은 한글·이모지를 한 글자씩 자른다', () => {
    assert.equal(typedText('사과🍎맛', 0.5), '사과');
    assert.equal(typedText('사과🍎맛', 0.75), '사과🍎');
    assert.equal(typedText('사과', 0), '');
  });

  it('카운트업은 쉼표·소수 자릿수를 지킨다', () => {
    assert.equal(countUpText('누적 12,000개 · 4.8점', 0.5), '누적 6,000개 · 2.4점');
    assert.equal(countUpText('누적 12,000개 · 4.8점', 0), '누적 0개 · 0.0점');
    assert.equal(countUpText('누적 12,000개 · 4.8점', 1), '누적 12,000개 · 4.8점');
  });

  it('타이핑은 글자에만, 카운트업은 숫자가 있는 글자에만', () => {
    const typing = effectInfo('typing')!;
    const countUp = effectInfo('countUp')!;
    const rect = { id: 'r', type: 'rect' } as unknown as KonvaElement;
    assert.equal(canUseEffect(typing, rect), false);
    assert.equal(canUseEffect(typing, text('안녕')), true);
    assert.equal(canUseEffect(countUp, text('안녕')), false);
    assert.equal(canUseEffect(countUp, text('98% 만족')), true);
    assert.equal(canUseEffect(effectInfo('fade')!, rect), true);
  });
});

describe('페이지 길이', () => {
  it('기본 5초, 1~10초 안으로 맞춘다', () => {
    assert.equal(pageLengthOf({}), 5);
    assert.equal(pageLengthOf({ animationLength: 30 }), 10);
    assert.equal(pageLengthOf({ animationLength: 0 }), 1);
  });

  it('시작·길이가 페이지를 넘지 않게 줄인다', () => {
    assert.deepEqual(normalizeAnimation({ effect: 'fade', delay: 4.5, duration: 3 }, 2), { effect: 'fade', delay: 1.9, duration: 2 });
    assert.deepEqual(normalizeAnimation({ effect: 'fade', delay: -1, duration: 0 }, 5), { effect: 'fade', delay: 0, duration: 0.2 });
  });

  it('10fps로 재생 길이만큼 장을 찍는다', () => {
    const times = frameTimes(2);
    assert.equal(times.length, 20);
    assert.equal(times[0], 0);
    near(times.at(-1)!, 1.9);
  });

  it('그룹 안 요소까지 모으고 모르는 효과는 뺀다', () => {
    const elements = [
      { id: 'a', type: 'text', animation: { effect: 'fade', delay: 0, duration: 1 } },
      { id: 'g', type: 'group', children: [{ id: 'b', type: 'rect', animation: { effect: 'bounce', delay: 0, duration: 1 } }] },
      { id: 'c', type: 'rect', animation: { effect: 'spin', delay: 0, duration: 1 } },
    ] as unknown as KonvaElement[];
    assert.deepEqual(collectAnimated(elements).map((e) => e.id), ['a', 'b']);
  });

  it('모든 효과의 기본 길이는 0.2초 이상', () => {
    for (const e of ANIMATION_EFFECTS) assert.ok(e.duration >= 0.2);
  });
});
