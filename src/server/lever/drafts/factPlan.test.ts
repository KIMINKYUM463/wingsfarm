import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DraftSection } from '../../../shared/types/draft.ts';
import { allocatableFacts, defaultOwners, factKeywords, findRepeats, normalizeOwners, pruneOutline, similarity } from './factPlan.ts';

const line = (text: string) => ({ text, evidence: [] });
const section = (typeId: string, title: string, items: string[] = []): DraftSection => ({
  id: typeId,
  typeId,
  label: null,
  title: line(title),
  subtitle: null,
  items: items.map((text) => ({ title: null, text: line(text) })),
  cuts: [],
  referenceImagePath: null,
  warnings: [],
});

const entries = [
  { id: 'product:name', text: '상품명: 부사사과' },
  { id: 'feature:1', text: '특징: 당도 16brix 이상만 선별' },
  { id: 'feature:2', text: '특징: 2025 쿠팡 사과 1위' },
  { id: 'agri:origin', text: '산지: 경북' },
  { id: 'review:1', text: '실제 후기: 아삭해요' },
  { id: 'review:2', text: '실제 후기: 달아요' },
  { id: 'contact', text: '고객센터: 010-1234-5678' },
];

describe('사실 배분', () => {
  it('배경 정보는 빼고 후기는 하나로 묶는다', () => {
    const facts = allocatableFacts(entries);
    assert.deepEqual(
      facts.map((f) => f.id),
      ['feature:1', 'feature:2', 'agri:origin', 'review', 'contact'],
    );
    assert.match(facts.find((f) => f.id === 'review')!.text, /외 1건/);
  });

  it('AI 배분에서 모르는 사실·중복 배정은 버린다 (먼저 나온 섹션이 맡음)', () => {
    const facts = allocatableFacts(entries);
    const owners = normalizeOwners(['quality', 'point_origin', 'comparison'], { quality: ['feature:1', 'nope'], point_origin: ['agri:origin', 'feature:1'], comparison: 'feature:2' }, facts);
    assert.deepEqual(owners, { quality: ['feature:1'], point_origin: ['agri:origin'], comparison: [] });
  });

  it('기본 배분: 근거별 선호 섹션, 특징 줄은 돌아가며', () => {
    const facts = allocatableFacts(entries);
    const owners = defaultOwners(['hero', 'quality', 'point_origin', 'point_origin_reason', 'review', 'contact'], facts);
    assert.deepEqual(owners.point_origin, ['agri:origin']);
    assert.deepEqual(owners.point_origin_reason, []);
    assert.deepEqual(owners.quality, ['feature:1', 'feature:2']);
    assert.deepEqual(owners.review, ['review']);
  });

  it('맡을 사실이 없는 섹션은 빼고, 사실 없이도 되는 섹션은 남긴다', () => {
    const ids = ['hero', 'quality', 'point_origin', 'point_origin_reason', 'faq'];
    assert.deepEqual(pruneOutline(ids, { quality: ['feature:1'], point_origin: ['agri:origin'] }), ['hero', 'quality', 'point_origin', 'faq']);
  });
});

describe('반복 검사', () => {
  const facts = allocatableFacts(entries);
  const keywords = factKeywords(facts);

  it('사실 속 수치·짧은 산지를 키워드로 뽑는다 (전화번호·후기는 제외)', () => {
    assert.ok(keywords.includes('16brix'));
    assert.ok(keywords.includes('경북'));
    assert.ok(!keywords.some((k) => k.includes('010')));
  });

  it('같은 수치가 세 섹션 이상이면 맡은 섹션 말고 뒤쪽을 짚는다', () => {
    const sections = [
      section('hero', '16brix 부사사과'),
      section('selection_process', '당도 16 브릭스만 골라요'),
      section('quality', '한 알 한 알 16brix 이상'),
      section('comparison', '일반 사과와 16brix 차이'),
      section('faq', '정말 16brix인가요?'),
    ];
    const problems = findRepeats(sections, keywords, { quality: ['feature:1'] }, facts);
    assert.ok(!problems.has(0), '첫 화면은 검사하지 않는다');
    assert.ok(!problems.has(2), '맡은 섹션은 허용');
    assert.ok(!problems.has(1), '처음 나온 다른 섹션 하나는 허용');
    assert.ok(problems.has(3) && problems.has(4));
  });

  it('한 섹션 안에서 같은 수치를 세 줄 이상 되풀이하면 짚는다', () => {
    const sections = [section('selection_process', '선별 과정', ['1차 16brix 측정', '2차 16brix 확인', '3차 16brix 재확인'])];
    assert.ok(findRepeats(sections, keywords).get(0)?.some((m) => m.includes('여러 번')));
  });

  it('거의 같은 문장이 다시 나오면 뒤 문장을 짚는다', () => {
    assert.ok(similarity('2025년 쿠팡 사과 판매 1위를 했어요', '2025년 쿠팡 사과 판매 1위를 했답니다') >= 0.6);
    const sections = [section('social_proof', '2025년 쿠팡 사과 판매 1위', ['2025년 쿠팡 사과 판매 1위 달성'])];
    assert.ok(findRepeats(sections, []).has(0));
  });

  it('겹치지 않는 페이지는 문제없음', () => {
    const sections = [section('quality', '16brix 넘는 것만', ['칼로 자르면 즙이 맺혀요']), section('point_origin', '경북 일교차가 만든 단맛', ['밤낮 기온 차가 커요'])];
    assert.equal(findRepeats(sections, keywords, { quality: ['feature:1'], point_origin: ['agri:origin'] }, facts).size, 0);
  });
});
