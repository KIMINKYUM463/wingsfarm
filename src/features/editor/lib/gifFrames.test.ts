import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diffIndexes } from './gifFrames.ts';

describe('GIF 바뀐 픽셀만 남기기', () => {
  it('첫 장은 그대로', () => {
    const next = new Uint8Array([1, 2, 3]);
    assert.deepEqual(diffIndexes(null, next, 255), { indexes: next, changed: true });
  });

  it('앞 장과 같은 픽셀은 투명 번호로 바꾼다', () => {
    const { indexes, changed } = diffIndexes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 9, 3]), 255);
    assert.deepEqual([...indexes], [255, 9, 255]);
    assert.equal(changed, true);
  });

  it('하나도 안 바뀌면 changed=false', () => {
    assert.equal(diffIndexes(new Uint8Array([4, 4]), new Uint8Array([4, 4]), 255).changed, false);
  });
});
