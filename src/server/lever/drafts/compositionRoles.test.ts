import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dedupeExclusiveRoles } from './compositionRoles.ts';

describe('구성 역할 중복 제거', () => {
  it('summary+concept, usage+how_to, recommend 중복을 하나만 남긴다', () => {
    const ids = dedupeExclusiveRoles([
      'hero',
      'summary',
      'concept',
      'quality',
      'recommend',
      'usage',
      'how_to',
      'recommend',
      'conversion',
    ]);
    assert.deepEqual(ids, ['hero', 'summary', 'quality', 'recommend', 'usage', 'conversion']);
  });

  it('역할이 겹치지 않으면 그대로 둔다', () => {
    const ids = ['hero', 'review', 'quality', 'recipe', 'conversion', 'faq'];
    assert.deepEqual(dedupeExclusiveRoles(ids), ids);
  });
});
