import '../testing/resolveHook.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectFrame } from '@/features/editor/types';
import type { FrameNode } from './frames/tree.ts';

const { contextBrief, hasPlaceholder, pageCopyOf, rewriteFrame } = await import('./copywriter.ts');

const text = (id: string, value: string, fontSize = 30, extra: Partial<FrameNode> = {}): FrameNode => ({
  type: 'text',
  id,
  text: value,
  fontSize,
  ...extra,
});

const frameOf = (id: string, frameOrder: string, children: FrameNode[], status: 'active' | 'ghost' = 'active') =>
  ({ id, frameOrder, status, part2: '핵심 포인트', frameData: { type: 'frame', id, children } }) as unknown as ProjectFrame;

/** AI 대신 받은 프롬프트를 기록하고, 정해 둔 문구를 돌려준다 */
const fakeWriter = (texts: Record<string, string>) => {
  const prompts: string[] = [];
  const tiers: (string | undefined)[] = [];
  return {
    prompts,
    tiers,
    generateJson: async <T,>(prompt: string, _images?: unknown[], tier?: string) => {
      prompts.push(prompt);
      tiers.push(tier);
      return { texts: Object.entries(texts).map(([id, value]) => ({ id, text: value })) } as T;
    },
  };
};

const textsOf = (frame: ProjectFrame) =>
  Object.fromEntries(((frame.frameData as unknown as FrameNode).children ?? []).map((n) => [n.id, n.text]));

describe('템플릿 문구 → 상품 문구', () => {
  it('보이는 문구만 바꾸고, 숨은 가이드는 프롬프트로만 쓴다', async () => {
    const frame = frameOf('f1', 'a1', [
      text('title', '이것만은\n자신 있어요', 56),
      text('body', '강점이 고객에게 주는 이득을 한두 문장으로 적어 주세요.'),
      text('prompt', '강점 3개를 짧게', 20, { name: 'prompt', visible: false }),
    ]);
    const writer = fakeWriter({ title: '아삭한 식감\n자신 있어요', body: '한입 베어 물면 꿀처럼 달콤해요.', prompt: '바뀌면 안 됨' });

    const result = await rewriteFrame(writer, '상품명: 성주 참외', frame, ['싱그러운 여름의 맛']);

    assert.deepEqual(textsOf(result), {
      title: '아삭한 식감\n자신 있어요',
      body: '한입 베어 물면 꿀처럼 달콤해요.',
      prompt: '강점 3개를 짧게',
    });
    const [prompt] = writer.prompts;
    assert.match(prompt, /상품명: 성주 참외/);
    assert.match(prompt, /강점 3개를 짧게/);
    assert.match(prompt, /싱그러운 여름의 맛/);
    assert.match(prompt, /대괄호 \[ \] 자리표시/);
    assert.doesNotMatch(prompt, /"id":"prompt"/);
    assert.equal(textsOf(frame).title, '이것만은\n자신 있어요', '원본 프레임은 그대로');
  });

  it('판매 문구는 copy 등급 모델과 문체 규칙으로 쓴다', async () => {
    const writer = fakeWriter({ title: '아삭해요' });
    await rewriteFrame(writer, '상품명: 참외', frameOf('f1', 'a1', [text('title', '제목')]));
    assert.deepEqual(writer.tiers, ['copy']);
    assert.match(writer.prompts[0], /AI가 쓴 티가 나지 않게/);
    assert.match(writer.prompts[0], /"선사합니다"/);
  });

  it('AI가 빈 문구를 주면 템플릿 문구를 남긴다', async () => {
    const frame = frameOf('f1', 'a1', [text('title', '제목')]);
    const result = await rewriteFrame(fakeWriter({ title: '  ' }), '상품명: 참외', frame);
    assert.equal(textsOf(result).title, '제목');
  });

  it('자리표시가 남으면 남은 문구만 한 번 더 쓰게 한다', async () => {
    const answers = [
      { chip1: '[키워드 1]', chip2: '아삭함', review: '[실제 구매 후기를 그대로 옮겨 적어 주세요]' },
      { chip1: '꿀당도', review: '선물용으로 고르기 좋은 크기예요' },
    ];
    const prompts: string[] = [];
    const writer = {
      generateJson: async <T,>(prompt: string) => {
        prompts.push(prompt);
        return { texts: Object.entries(answers[prompts.length - 1]).map(([id, value]) => ({ id, text: value })) } as T;
      },
    };
    const frame = frameOf('f1', 'a1', [text('chip1', '[키워드 1]'), text('chip2', '[키워드 2]'), text('review', '[실제 구매 후기를 그대로 옮겨 적어 주세요]')]);

    const result = await rewriteFrame(writer, '상품명: 참외', frame);

    assert.equal(prompts.length, 2);
    assert.match(prompts[1], /\[다시 쓰기\]/);
    assert.ok(!prompts[1].includes('"chip2"'), '이미 채운 문구는 다시 묻지 않는다');
    assert.deepEqual(textsOf(result), { chip1: '꿀당도', chip2: '아삭함', review: '선물용으로 고르기 좋은 크기예요' });
  });

  it('자리표시가 없으면 한 번만 부른다', async () => {
    const writer = fakeWriter({ chip: '아삭함' });
    await rewriteFrame(writer, '상품명: 참외', frameOf('f1', 'a1', [text('chip', '[키워드 1]')]));
    assert.equal(writer.prompts.length, 1);
    assert.match(writer.prompts[0], /하나도 남기지 않고/);
    assert.match(writer.prompts[0], /남이 한 말처럼 쓰지 않는다/, '후기는 지어내지 않는다');
  });

  it('자리표시·작성 안내를 알아본다', () => {
    assert.ok(hasPlaceholder('[키워드 1]'));
    assert.ok(hasPlaceholder('보관 방법을 적어 주세요'));
    assert.ok(!hasPlaceholder('한입 베면 아삭해요'));
  });

  it('바꿀 문구가 없으면 AI를 부르지 않는다', async () => {
    const writer = fakeWriter({});
    const frame = frameOf('f1', 'a1', [text('prompt', '가이드', 20, { name: 'prompt', visible: false })]);
    assert.equal(await rewriteFrame(writer, '상품명: 참외', frame), frame);
    assert.equal(writer.prompts.length, 0);
  });

  it('페이지 문구는 빈 자리를 빼고, 섹션마다 큰 글자 2개만 한 줄로 모은다', () => {
    const frames = [
      frameOf('ghost', 'a0', [text('g', '빈 자리')], 'ghost'),
      frameOf('f1', 'a1', [text('h', '첫 번째 제목', 60)]),
      frameOf('f2', 'a2', [text('s', '작은 글', 20), text('h', '두 번째\n제목', 60), text('m', '중간 글', 40)]),
      frameOf('f3', 'a3', [text('long', '가'.repeat(80), 60)]),
    ];
    assert.deepEqual(pageCopyOf(frames), ['첫 번째 제목', '두 번째 제목', '중간 글', `${'가'.repeat(60)}…`]);
    assert.equal(pageCopyOf(frames, 2).length, 2);
  });

  it('상품 요약에서 빈 항목은 뺀다', () => {
    const brief = contextBrief(
      { productName: '참외', categoryId: 'unknown', companyName: '윙스팜' },
      { summary: '참외 — 생과', target: '', tone: '', sellingPoints: ['당도 선별'], keywords: [] },
    );
    assert.equal(brief, '상품명: 참외\n카테고리: 기타\n업체명: 윙스팜\n요약: 참외 — 생과\n핵심 장점: 당도 선별');
  });
});
