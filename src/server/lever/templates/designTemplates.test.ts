import '../../testing/resolveHook.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertInsideFrame, assertNoTextOverlap } from './frameAsserts.ts';

const { buildDesignTemplates } = await import('./designTemplates.ts');
const templates = buildDesignTemplates();

describe('스타일 템플릿', () => {
  it('새 레이아웃(한눈에 보는 상품 / 이런 분께 추천)이 스타일마다 있다', () => {
    for (const layout of ['facts', 'checklist']) assert.equal(templates.filter((t) => t.slug.endsWith(`-${layout}`)).length, 5, layout);
    assert.equal(new Set(templates.map((t) => t.slug)).size, templates.length);
  });

  it('모든 요소가 프레임 안에 있다', () => {
    for (const { slug, frame } of templates) assertInsideFrame(slug, frame);
  });

  it('글자끼리 겹치지 않는다', () => {
    for (const { slug, frame } of templates) assertNoTextOverlap(slug, frame);
  });

  it('제목 형광펜은 마커 스타일(내추럴·팝)에만, 글자 뒤에 깔린다', () => {
    const markers = templates.flatMap((t) => (t.frame.children ?? []).map((n, i, all) => ({ slug: t.slug, n, i, all }))).filter(({ n }) => n.name === 'title_marker');
    assert.ok(markers.length > 0);
    for (const { slug, i, all } of markers) {
      assert.match(slug, /^ds-(natural|pop)-/);
      assert.ok(all.slice(i + 1).some((n) => n.name === 'main_copy'), `${slug} 형광펜이 제목 위에 덮임`);
    }
  });
});
