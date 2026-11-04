import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTRA_DRAFT_PART2S,
  isTemplateStartLength,
  part2sForLength,
  templateCountFor,
  TEMPLATE_START_LENGTHS,
} from './templateStart.ts';

describe('templateStart 길이', () => {
  it('짧은·긴·더 긴 세 가지를 받는다', () => {
    assert.deepEqual(TEMPLATE_START_LENGTHS.map((o) => o.id), ['short', 'long', 'extra']);
    assert.equal(isTemplateStartLength('extra'), true);
    assert.equal(isTemplateStartLength('medium'), false);
  });

  it('더 긴 구성은 비교·인증·사용법·FAQ를 넣고 본문을 더 늘린다', () => {
    const short = ['메인 비주얼', '핵심 포인트', '구매 안내'];
    assert.deepEqual(part2sForLength('short', short), short);
    assert.ok(EXTRA_DRAFT_PART2S.includes('비교 분석'));
    assert.ok(EXTRA_DRAFT_PART2S.includes('FAQ'));
    assert.equal(templateCountFor('핵심 포인트', 'short'), 1);
    assert.equal(templateCountFor('핵심 포인트', 'long'), 3);
    assert.equal(templateCountFor('핵심 포인트', 'extra'), 4);
    assert.ok(
      EXTRA_DRAFT_PART2S.reduce((sum, part2) => sum + templateCountFor(part2, 'extra'), 0) >= 18,
    );
  });
});
