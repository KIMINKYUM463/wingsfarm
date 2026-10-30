import '../../../server/testing/resolveHook.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { KonvaElement } from '@/shared/types/konva';

const { buildFixMessage, checkSection, splitFixes } = await import('./sectionCheck.ts');

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

  it('고칠 점을 AI가 고칠 것(중복 제거)과 직접 할 것으로 나눈다', () => {
    const { auto, manual } = splitFixes([
      { text: '작은 글자', fixRequest: '글자 키워줘' },
      { text: '제목이 약해요', fixRequest: '제목 바꿔줘' },
      { text: '작은 글자(AI)', fixRequest: '글자 키워줘' },
      { text: '빈 사진 자리' },
      { text: '빈 사진 자리' },
    ]);
    assert.deepEqual(auto, ['글자 키워줘', '제목 바꿔줘']);
    assert.deepEqual(manual, ['빈 사진 자리']);
  });

  it('여러 요청은 번호 목록 한 문장으로, 한도(500자)를 넘는 항목은 뺀다', () => {
    assert.equal(buildFixMessage(['제목 바꿔줘']), '제목 바꿔줘');
    const message = buildFixMessage(['제목 바꿔줘', '글자 키워줘', '가'.repeat(480)]);
    assert.match(message, /\n1\. 제목 바꿔줘\n2\. 글자 키워줘$/);
    assert.ok(message.length <= 500);
  });

  it('숨긴 요소는 점검하지 않는다', () => {
    const section = [el({ id: 'g', type: 'group', visible: false, children: [el({ id: 'h', type: 'text', text: '[숨김]', fontSize: 10 })] })];
    assert.deepEqual(checkSection(section), []);
  });
});
