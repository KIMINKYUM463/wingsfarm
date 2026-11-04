import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AGRI_CLOSING_SECTION_IDS, ensureAgriClosing } from '../catalog/sections.ts';
import { withAgriClosing } from './agriClosing.ts';

const templates = [
  { id: 'builtin-pt-hero-cover-a', part2: '메인 비주얼' },
  { id: 'builtin-pt-purchase-finale-a', part2: '구매 안내' },
  { id: 'builtin-pt-info-delivery-a', part2: '상세 정보' },
  { id: 'figma-shipping-1', part2: '배송 안내' },
  { id: 'builtin-pt-purchase-policy-a', part2: '구매 안내' },
  { id: 'builtin-pt-info-notice-a', part2: '상세 정보' },
];

describe('농수산물 마지막 구성', () => {
  it('농수산물만 맨 뒤에 배송·교환환불·상품상세정보를 붙인다', () => {
    const picked = templates.slice(0, 2);
    const agri = withAgriClosing(templates, picked, 'agri');
    assert.deepEqual(
      agri.slice(-3).map((t) => t.id),
      ['figma-shipping-1', 'builtin-pt-purchase-policy-a', 'builtin-pt-info-notice-a'],
    );
    assert.deepEqual(withAgriClosing(templates, picked, 'electronics'), picked);
  });

  it('기획 목차에서도 세 섹션을 맨 뒤로 고정한다', () => {
    const ids = ensureAgriClosing(
      ['hero', 'quality', 'shipping_method', 'conversion', 'faq'],
      'agri',
      ['hero', 'quality', 'conversion', 'faq', ...AGRI_CLOSING_SECTION_IDS],
    );
    assert.deepEqual(ids.slice(-3), [...AGRI_CLOSING_SECTION_IDS]);
    assert.ok(ids.indexOf('conversion') < ids.indexOf('shipping_method'));
    assert.deepEqual(ensureAgriClosing(['hero', 'faq'], 'beauty', ['hero', 'faq', 'shipping_method']), ['hero', 'faq']);
  });
});
