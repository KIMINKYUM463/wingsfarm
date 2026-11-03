import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MARKETING_PSYCHOLOGY_RULES } from './marketingPsychology.ts';

describe('마케팅 심리 규칙', () => {
  it('손실회피·사회적 증거와 가짜 희소성 금지가 들어 있다', () => {
    assert.match(MARKETING_PSYCHOLOGY_RULES, /Jobs to Be Done/);
    assert.match(MARKETING_PSYCHOLOGY_RULES, /사회적 증거/);
    assert.match(MARKETING_PSYCHOLOGY_RULES, /가짜 "오늘만"/);
    assert.match(MARKETING_PSYCHOLOGY_RULES, /AIDA/);
  });
});
