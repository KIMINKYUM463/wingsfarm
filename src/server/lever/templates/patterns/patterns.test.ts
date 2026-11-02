import '../../../testing/resolveHook.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FrameNode } from '../../frames/tree.ts';

const { buildPatternTemplates, PATTERN_GROUPS } = await import('./index.ts');
const templates = buildPatternTemplates();

const visibleNodes = (frame: FrameNode) => (frame.children ?? []).filter((n) => n.visible !== false);
const box = (n: FrameNode) => ({ x: Number(n.x), y: Number(n.y), r: Number(n.x) + Number(n.width), b: Number(n.y) + Number(n.height) });

describe('패턴 템플릿', () => {
  it('구성 8개마다 20개씩, slug는 겹치지 않는다', () => {
    assert.equal(PATTERN_GROUPS.length, 8);
    for (const group of PATTERN_GROUPS) {
      assert.equal(group.patterns.length, 10, group.part2);
      assert.equal(templates.filter((t) => t.part2 === group.part2).length, 20, group.part2);
    }
    assert.equal(new Set(templates.map((t) => t.slug)).size, templates.length);
  });

  it('모든 요소가 프레임 안에 있다', () => {
    for (const { slug, frame } of templates) {
      for (const node of visibleNodes(frame)) {
        const b = box(node);
        assert.ok(b.x >= 0 && b.r <= Number(frame.width) + 1, `${slug} ${node.name} 가로 넘침 (${b.x}~${b.r})`);
        assert.ok(b.y >= 0 && b.b <= Number(frame.height) + 1, `${slug} ${node.name} 세로 넘침 (${b.y}~${b.b} / ${frame.height})`);
      }
    }
  });

  it('글자끼리 겹치지 않는다', () => {
    for (const { slug, frame } of templates) {
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
  });

  it('스킨(스타일)마다 도형 언어가 드러난다', () => {
    const nodesOf = (skin: string) => templates.filter((t) => t.slug.endsWith(`-${skin}`)).flatMap((t) => visibleNodes(t.frame));
    const has = (skin: string, test: (n: FrameNode) => boolean, what: string) => assert.ok(nodesOf(skin).some(test), what);
    has('a', (n) => Boolean(n.shadowEnabled) && Number(n.shadowBlur) > 0, '모던: 부드럽게 뜬 카드');
    has('b', (n) => n.type === 'path' && n.name === 'deco', '내추럴: 얼룩 장식');
    has('b', (n) => n.name === '_image' && Array.isArray(n.cornerRadius), '내추럴: 잎·아치 사진');
    has('c', (n) => n.name === 'photo_frame' || n.name === 'card_line', '프리미엄: 가는 선 액자');
    has('d', (n) => Boolean(n.shadowEnabled) && n.shadowBlur === 0, '팝: 어긋난 스티커 그림자');
    has('d', (n) => n.type === 'path' && n.name === 'badge_bg', '팝: 톱니 스탬프');
    has('e', (n) => n.name === 'card_stripe', '다큐: 카드 왼쪽 색 띠');
  });

  it('경로 도형은 그릴 경로와 상자 크기를 가진다', () => {
    const paths = templates.flatMap((t) => visibleNodes(t.frame)).filter((n) => n.type === 'path');
    assert.ok(paths.length > 0);
    for (const n of paths) assert.ok(typeof n.data === 'string' && n.data.length > 0 && Number(n.width) > 0 && Number(n.height) > 0, String(n.name));
  });

  it('문구 가이드(prompt)와 사진 자리 규칙을 지킨다', () => {
    for (const { slug, frame } of templates) {
      const prompt = (frame.children ?? []).find((n) => n.name === 'prompt');
      assert.ok(prompt?.text && prompt.visible === false, `${slug} 가이드 없음`);
      assert.ok(visibleNodes(frame).some((n) => n.type === 'text' && n.text?.trim()), `${slug} 문구 없음`);
      for (const node of visibleNodes(frame)) assert.equal(node.cutId, undefined, `${slug} 초안 컷 연결이 남음`);
    }
  });
});
