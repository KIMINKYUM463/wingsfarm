import assert from 'node:assert/strict';
import type { FrameNode } from '../frames/tree.ts';

/** 템플릿 테스트 공용 검사 (보이는 요소가 프레임 안에 있는지, 글자끼리 겹치지 않는지) */
export const visibleNodes = (frame: FrameNode) => (frame.children ?? []).filter((n) => n.visible !== false);

const box = (n: FrameNode) => ({ x: Number(n.x), y: Number(n.y), r: Number(n.x) + Number(n.width), b: Number(n.y) + Number(n.height) });

export function assertInsideFrame(slug: string, frame: FrameNode) {
  for (const node of visibleNodes(frame)) {
    const b = box(node);
    assert.ok(b.x >= 0 && b.r <= Number(frame.width) + 1, `${slug} ${node.name} 가로 넘침 (${b.x}~${b.r})`);
    assert.ok(b.y >= 0 && b.b <= Number(frame.height) + 1, `${slug} ${node.name} 세로 넘침 (${b.y}~${b.b} / ${frame.height})`);
  }
}

export function assertNoTextOverlap(slug: string, frame: FrameNode) {
  const texts = visibleNodes(frame).filter((n) => n.type === 'text');
  texts.forEach((a, i) => {
    for (const b of texts.slice(i + 1)) {
      const p = box(a);
      const q = box(b);
      const overlapX = Math.min(p.r, q.r) - Math.max(p.x, q.x);
      const overlapY = Math.min(p.b, q.b) - Math.max(p.y, q.y);
      assert.ok(overlapX <= 2 || overlapY <= 2, `${slug}: "${a.text}" / "${b.text}" 겹침`);
    }
  });
}
