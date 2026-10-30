import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canFallback, TEXT_MODELS } from './geminiModels.ts';

describe('Gemini 텍스트 모델 등급', () => {
  it('판매 문구는 fast와 다른 모델을 쓰고, temperature를 바꾸지 않는다', () => {
    assert.notEqual(TEXT_MODELS.copy.model, TEXT_MODELS.fast.model);
    assert.equal('temperature' in TEXT_MODELS.copy.generationConfig, false);
    assert.equal(TEXT_MODELS.copy.generationConfig.responseMimeType, 'application/json');
  });

  it('모델 문제·한도·서버 오류는 fast 모델로 다시 시도한다', () => {
    assert.equal(canFallback(404, 'models/x is not found'), true);
    assert.equal(canFallback(429, 'quota'), true);
    assert.equal(canFallback(503, ''), true);
    assert.equal(canFallback(400, 'thinking_level is not supported'), true);
  });

  it('키·권한 문제는 다른 모델도 실패하므로 다시 시도하지 않는다', () => {
    assert.equal(canFallback(400, 'API key not valid'), false);
    assert.equal(canFallback(401, ''), false);
    assert.equal(canFallback(403, ''), false);
  });
});
