import '../../../server/testing/resolveHook.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { KonvaElement } from '@/shared/types/konva';

const { checkSection } = await import('./sectionCheck.ts');

const el = (props: Record<string, unknown>) => props as unknown as KonvaElement;
const fixes = (elements: KonvaElement[]) => checkSection(elements).filter((n) => n.tone === 'fix').map((n) => n.text);
const goods = (elements: KonvaElement[]) => checkSection(elements).filter((n) => n.tone === 'good').map((n) => n.text);

describe('섹션 기본 점검', () => {
  it('잘 만든 섹션은 칭찬만 한다', () => {
    const section = [
      el({ id: 't', type: 'text', text: '꽉 찬 홍게살', fontSize: 56 }),
      el({ id: 'b', type: 'text', text: '아침에 잡아 바로 쪄서 보내요', fontSize: 26 }),
      el({ id: 'p', type: 'rect', name: 'hero_image', assetId: 'a1' }),
    ];
    assert.deepEqual(fixes(section), []);
    assert.equal(goods(section).length, 3);
  });

  it('자리표시·빈 사진·작은 글자·긴 문단·약한 제목을 짚는다', () => {
    const section = [
      el({ id: 't', type: 'text', text: '[키워드 1]', fontSize: 24 }),
      el({ id: 's', type: 'text', text: '작은 안내', fontSize: 14 }),
      el({ id: 'l', type: 'text', text: '가'.repeat(120), fontSize: 24 }),
      el({ id: 'p', type: 'rect', name: 'hero_image' }),
    ];
    const notes = checkSection(section);
    assert.equal(notes.filter((n) => n.tone === 'fix').length, 5);
    assert.ok(notes.find((n) => n.text.startsWith('채울 문구'))?.fixRequest, '문구 문제는 AI로 고칠 수 있다');
    assert.equal(notes.find((n) => n.text.startsWith('빈 사진'))?.fixRequest, undefined, '사진은 직접 넣어야 한다');
  });

  it('숨긴 요소는 점검하지 않는다', () => {
    const section = [el({ id: 'g', type: 'group', visible: false, children: [el({ id: 'h', type: 'text', text: '[숨김]', fontSize: 10 })] })];
    assert.deepEqual(checkSection(section), []);
  });
});
