import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyDraftInput } from '@/shared/types/draft';
import { suggestableTypes } from '../catalog/sections';
import { derivePalette, TONE_PRESETS } from '@/shared/lib/palette';
import {
  buildFallbackCompositionCandidates,
  compositionSequenceKey,
  ensureSalesAnchors,
  orderBySalesFunnel,
  resolveCandidateSectionIds,
} from './compositionLogic';

const agriInput = () => {
  const input = emptyDraftInput();
  input.productName = '햇사과 5kg';
  input.categoryId = 'agri';
  input.features = '당도 높음, 산지직송';
  input.productImagePaths = ['uploads/a.jpg'];
  input.agri = { ...input.agri, origin: '충주', directShipping: true };
  input.reviewsText = '달아요 재구매할게요';
  input.shipping = '주문 후 1~2일 출고';
  input.length = 'short';
  input.imageMode = 'blank';
  return input;
};

const allowed = (categoryId: string) => suggestableTypes(categoryId).map((t) => t.id);

describe('compositionLogic', () => {
  it('폴백 후보가 5안이고 모두 hero로 시작한다', () => {
    const input = agriInput();
    const list = buildFallbackCompositionCandidates(input, allowed(input.categoryId));
    assert.equal(list.length, 5);
    for (const c of list) {
      assert.equal(c.sectionTypeIds[0], 'hero');
      assert.ok(c.sectionTypeIds.length >= 5);
      assert.equal(c.sectionNames.length, c.sectionTypeIds.length);
    }
    const keys = new Set(list.map((c) => compositionSequenceKey(c.sectionTypeIds)));
    assert.ok(keys.size >= 2, '후보끼리 시퀀스가 달라야 한다');
  });

  it('재조합 exclude 시에도 5안을 돌려준다', () => {
    const input = agriInput();
    const ids = allowed(input.categoryId);
    const first = buildFallbackCompositionCandidates(input, ids);
    const exclude = new Set(first.map((c) => compositionSequenceKey(c.sectionTypeIds)));
    const second = buildFallbackCompositionCandidates(input, ids, exclude);
    assert.equal(second.length, 5);
    assert.ok(second.every((c) => c.sectionTypeIds[0] === 'hero'));
  });

  it('선택 목차 정규화는 허용 섹션만 남기고 hero를 앞으로 둔다', () => {
    const input = agriInput();
    const ids = resolveCandidateSectionIds(['quality', 'hero', 'faq', 'quality', 'nope'], input, allowed(input.categoryId));
    assert.equal(ids[0], 'hero');
    assert.ok(!ids.includes('nope'));
    assert.equal(ids.filter((id) => id === 'quality').length, 1);
  });

  it('세일즈 순서로 구매 유도·FAQ를 본문 뒤로 보낸다', () => {
    const ordered = orderBySalesFunnel(['hero', 'conversion', 'faq', 'quality', 'summary', 'review', 'shipping_method']);
    assert.deepEqual(ordered, ['hero', 'summary', 'review', 'quality', 'conversion', 'shipping_method', 'faq']);
  });

  it('폴백 후보도 구매 유도가 상품 설명보다 앞에 오지 않는다', () => {
    const list = buildFallbackCompositionCandidates(agriInput(), allowed('agri'));
    for (const c of list) {
      const conv = c.sectionTypeIds.indexOf('conversion');
      assert.ok(conv >= 0, `${c.title} missing conversion`);
      const proof = ['summary', 'concept', 'quality', 'point_sum']
        .map((id) => c.sectionTypeIds.indexOf(id))
        .filter((i) => i >= 0);
      if (proof.length) assert.ok(Math.min(...proof) < conv, `${c.title} conversion too early`);
    }
  });

  it('폴백 후보 색은 상품 빛깔을 따른다', () => {
    const mainOf = (id: string) => derivePalette(TONE_PRESETS.find((t) => t.id === id)!.main).main;
    const apple = buildFallbackCompositionCandidates(agriInput(), allowed('agri'));
    assert.equal(apple[0].palette.main, mainOf('forest'));
    const fishInput = agriInput();
    fishInput.productName = '제주 고등어';
    const fish = buildFallbackCompositionCandidates(fishInput, allowed('agri'));
    assert.equal(fish[0].palette.main, mainOf('ocean'));
  });

  it('농수산물 후보는 맨 뒤에 배송·교환환불·상품상세정보를 둔다', () => {
    const input = agriInput();
    const list = buildFallbackCompositionCandidates(input, allowed(input.categoryId));
    for (const c of list) {
      const tail = c.sectionTypeIds.filter((id) => id !== 'notice_ai').slice(-3);
      assert.deepEqual(tail, ['shipping_method', 'return_policy', 'product_notice'], c.title);
    }
  });

  it('세일즈 앵커는 빠진 conversion을 배송 앞에 넣는다', () => {
    const ids = ensureSalesAnchors(['hero', 'quality', 'faq'], ['hero', 'summary', 'conversion', 'faq']);
    assert.ok(ids.includes('summary'));
    assert.ok(ids.includes('conversion'));
    assert.ok(ids.indexOf('conversion') < ids.indexOf('faq'));
  });

  it('정규화 후에도 recommend는 한 번만, summary·concept은 하나만 남긴다', () => {
    const input = agriInput();
    input.length = 'long';
    const ids = resolveCandidateSectionIds(
      ['hero', 'recommend', 'concept', 'summary', 'recommend', 'quality'],
      input,
      allowed(input.categoryId),
      'long',
    );
    assert.equal(ids.filter((id) => id === 'recommend').length, 1);
    assert.ok(!(ids.includes('summary') && ids.includes('concept')));
    assert.ok(ids.length >= 13, `expected long min length, got ${ids.length}`);
  });
});
