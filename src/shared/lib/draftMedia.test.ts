import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCutSource, effectiveHeroMotion, estimateCostUsd, formatCost, HERO_VIDEO_USD, normalizeCutSource, sceneIdeas } from './draftMedia.ts';

describe('컷 사진 방식', () => {
  it('사진 자리 비워두기를 고르면 모든 컷이 빈 자리', () => {
    assert.equal(defaultCutSource('blank', 'hero', 3), 'blank');
    assert.equal(defaultCutSource('blank', 'proof', 3), 'blank');
  });

  it('AI 모드는 실물 증거 컷만 올린 사진, 나머지는 AI 연출', () => {
    assert.equal(defaultCutSource('ai', 'proof', 2), 'own');
    assert.equal(defaultCutSource('ai', 'detail', 2), 'ai');
    assert.equal(defaultCutSource('ai', 'hero', 2), 'ai');
    assert.equal(defaultCutSource('ai', 'proof', 0), 'ai');
  });

  it('저장할 때 빈 자리가 AI로 바뀌지 않는다', () => {
    assert.equal(normalizeCutSource('blank', 3), 'blank');
    assert.equal(normalizeCutSource('own', 3), 'own');
    assert.equal(normalizeCutSource('own', 0), 'blank');
    assert.equal(normalizeCutSource(undefined, 3), 'ai');
    assert.equal(normalizeCutSource('weird', 3), 'ai');
  });
});

describe('움직이는 컷·비용', () => {
  it('맨 위 사진 자리가 비면 움직이는 컷은 꺼진다', () => {
    assert.equal(effectiveHeroMotion('video', 'blank'), 'off');
    assert.equal(effectiveHeroMotion('pan', null), 'off');
    assert.equal(effectiveHeroMotion('pan', 'own'), 'pan');
    assert.equal(effectiveHeroMotion('video', 'ai'), 'video');
  });

  it('AI 영상만 영상 비용이 붙는다', () => {
    assert.equal(estimateCostUsd(0, 'pan'), 0);
    assert.ok(Math.abs(estimateCostUsd(10, 'video') - (0.39 + HERO_VIDEO_USD)) < 1e-9);
  });

  it('비용은 원 단위로 반올림해 보여준다', () => {
    assert.equal(formatCost(0), '추가 비용 없음');
    assert.equal(formatCost(0.5), '약 700원');
    assert.equal(formatCost(0.001), '약 10원');
  });

  it('농수산물은 전용 장면 목록, 다른 카테고리는 기본 목록', () => {
    assert.ok(sceneIdeas('agri').some((s) => s.includes('단면')));
    assert.deepEqual(sceneIdeas('unknown'), sceneIdeas('fashion'));
  });
});
