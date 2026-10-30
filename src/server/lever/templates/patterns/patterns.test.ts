import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { FrameNode } from '../../frames/tree.ts';

// Node 24의 module.registerHooks — 설치된 @types/node에는 아직 없어 필요한 모양만 적는다
interface ResolveContext {
  parentURL?: string;
}
interface Resolved {
  url: string;
  shortCircuit?: boolean;
}
type ResolveHook = (specifier: string, context: ResolveContext, next: (specifier: string, context: ResolveContext) => Resolved) => Resolved;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void };

// 템플릿 코드는 Next 규칙(@/ 별칭·확장자 없는 경로)으로 쓰여 있어, node --test에서 불러올 수 있게 경로를 풀어 준다
const SRC = fileURLToPath(new URL('../../../../', import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
    const base = specifier.startsWith('@/')
      ? SRC + specifier.slice(2)
      : specifier.startsWith('.') && context.parentURL?.startsWith('file:')
        ? fileURLToPath(new URL(specifier, context.parentURL))
        : null;
    if (base && !/\.[cm]?[jt]sx?$|\.json$/.test(base)) {
      const found = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(existsSync);
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
    }
    if (base && specifier.startsWith('@/')) return { url: pathToFileURL(base).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

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

  it('문구 가이드(prompt)와 사진 자리 규칙을 지킨다', () => {
    for (const { slug, frame } of templates) {
      const prompt = (frame.children ?? []).find((n) => n.name === 'prompt');
      assert.ok(prompt?.text && prompt.visible === false, `${slug} 가이드 없음`);
      assert.ok(visibleNodes(frame).some((n) => n.type === 'text' && n.text?.trim()), `${slug} 문구 없음`);
      for (const node of visibleNodes(frame)) assert.equal(node.cutId, undefined, `${slug} 초안 컷 연결이 남음`);
    }
  });
});
