import '../../../server/testing/resolveHook.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { KonvaElement } from '@/shared/types/konva';

const { elementTopInFrame, findBlankImageSlots, findPlaceholderTexts } = await import('./element-finder.ts');

const el = (props: Record<string, unknown>) => props as unknown as KonvaElement;
const ids = (elements: KonvaElement[]) => elements.map((element) => element.id);

const tree = [
  el({ id: 'filled', type: 'text', text: '총 중량 2kg' }),
  el({ id: 'todo', type: 'text', text: '총 중량 [입력 필요], 과수 (입력필요)' }),
  el({ id: 'keyword', type: 'text', text: '[키워드 1]' }),
  el({ id: 'slot', type: 'rect', name: 'hero_image' }),
  el({ id: 'photo', type: 'rect', name: 'hero_image', assetId: 'a1' }),
  el({
    id: 'group',
    type: 'group',
    children: [el({ id: 'nested', type: 'text', text: '문의 [입력 필요]' }), el({ id: 'nestedSlot', type: 'rect', name: 'sub_image' })],
  }),
  el({ id: 'hidden', type: 'group', visible: false, children: [el({ id: 'hiddenText', type: 'text', text: '[입력 필요]' })] }),
];

describe('element-finder', () => {
  it('[입력 필요]·(입력필요)·템플릿 자리표시가 남은 보이는 텍스트만 찾는다', () => {
    assert.deepEqual(ids(findPlaceholderTexts(tree)), ['todo', 'keyword', 'nested']);
  });

  it('사진이 없는 보이는 이미지 자리만 찾는다', () => {
    assert.deepEqual(ids(findBlankImageSlots(tree)), ['slot', 'nestedSlot']);
  });

  it('프레임 기준 세로 위치는 부모 그룹 y를 더한다', () => {
    const nested = [el({ id: 'g', type: 'group', y: 300, children: [el({ id: 'inner', type: 'text', y: 40, text: '' })] })];
    assert.equal(elementTopInFrame(nested, 'g'), 300);
    assert.equal(elementTopInFrame(nested, 'inner'), 340);
    assert.equal(elementTopInFrame(nested, 'missing'), undefined);
  });
});
