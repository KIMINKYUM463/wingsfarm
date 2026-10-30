import '../../testing/resolveHook.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { findGraphicSvg, listGraphicElements } = await import('./graphics.ts');

test('그래픽 id가 겹치지 않고 모두 묶음 이름이 있다', () => {
  const graphics = listGraphicElements();
  assert.equal(new Set(graphics.map((g) => g.id)).size, graphics.length);
  assert.ok(graphics.every((g) => g.group.trim().length > 0));
  assert.ok(graphics.some((g) => g.group.startsWith('스티커')), '스티커가 포함되어야 한다');
});

test('목록의 모든 그래픽은 storage 경로로 SVG를 받을 수 있다', () => {
  for (const g of listGraphicElements()) {
    const path = g.imageUrl.replace('/api/lever/storage/', '');
    const svg = findGraphicSvg(path);
    assert.ok(svg?.startsWith('<svg') && /width="\d+"/.test(svg), `${g.id}의 SVG가 없거나 크기가 없다`);
  }
  assert.equal(findGraphicSvg('graphics/../secret.svg'), null);
  assert.equal(findGraphicSvg('graphics/none.svg'), null);
});
