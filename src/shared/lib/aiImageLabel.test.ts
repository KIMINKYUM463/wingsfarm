import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAiAssetUrl, markAiAssetUrl } from './aiImageLabel.ts';

describe('AI 사진 주소 표시', () => {
  it('AI 표시를 붙인 주소만 AI 사진으로 본다', () => {
    assert.equal(isAiAssetUrl(markAiAssetUrl('/api/lever/storage/assets/a.png')), true);
    assert.equal(isAiAssetUrl(markAiAssetUrl('/api/lever/storage/assets/a.png?v=2')), true);
    assert.equal(isAiAssetUrl('/api/lever/storage/assets/a.png'), false);
    assert.equal(isAiAssetUrl('/api/lever/storage/assets/a.png?tai=10'), false);
    assert.equal(isAiAssetUrl(undefined), false);
  });
});
