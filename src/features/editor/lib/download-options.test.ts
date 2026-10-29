import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateBytes, formatBytes, parsePageRange } from './download-options.ts';

describe('페이지 선택', () => {
  it('범위와 낱장을 섞어 쓸 수 있다', () => {
    assert.deepEqual(parsePageRange('1-3, 5', 6), [0, 1, 2, 4]);
    assert.deepEqual(parsePageRange('2,2, 1-2', 3), [0, 1]);
  });

  it('형식이 틀리거나 범위를 벗어나면 null', () => {
    assert.equal(parsePageRange('', 5), null);
    assert.equal(parsePageRange('0-2', 5), null);
    assert.equal(parsePageRange('4-2', 5), null);
    assert.equal(parsePageRange('1-9', 5), null);
    assert.equal(parsePageRange('a', 5), null);
  });
});

describe('예상 용량', () => {
  it('폭이 줄면 용량도 줄고, PNG가 가장 크다', () => {
    const heights = [1000, 2000];
    const jpg860 = estimateBytes('jpg', 'standard', 860, heights, 860);
    assert.ok(estimateBytes('jpg', 'standard', 780, heights, 860) < jpg860);
    assert.ok(estimateBytes('png', 'standard', 860, heights, 860) > jpg860);
    assert.ok(estimateBytes('jpg', 'saver', 860, heights, 860) < jpg860);
  });

  it('MB·KB로 표시한다', () => {
    assert.equal(formatBytes(3.4 * 1024 * 1024), '3.4MB');
    assert.equal(formatBytes(2048), '2KB');
  });
});
