import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DRAFT_PART2_ORDER, normalizePart2, part2SortKeyOf } from './part2Taxonomy';

describe('normalizePart2', () => {
  it('번호형 섹션을 정식 구성으로 매핑한다', () => {
    assert.equal(normalizePart2({ part2: '3-7 배송 안내', name: '배송안내 1' }), '배송 안내');
    assert.equal(normalizePart2({ part2: '1-1 문제 제기', name: 'x' }), '문제 제기');
    assert.equal(normalizePart2({ part2: '2-9 타사 제품 비교', name: 'x' }), '비교 분석');
  });

  it('통짜 상세는 전체 페이지로 묶는다', () => {
    assert.equal(normalizePart2({ part2: '참외', name: '상세페이지_참외', height: 18001 }), '전체 페이지');
    assert.equal(normalizePart2({ part2: 'Food 1_EX', name: 'Food 1_EX', height: 1000 }), '전체 페이지');
  });

  it('모호한 Section은 프레임 이름으로 나눈다', () => {
    assert.equal(normalizePart2({ part2: 'Section', name: 'Point Section 1' }), '핵심 포인트');
    assert.equal(normalizePart2({ part2: 'Section', name: 'Review Section' }), '고객 후기');
    assert.equal(normalizePart2({ part2: 'Section', name: 'Schedule Section' }), '배송 안내');
  });

  it('초안용 구성은 8개다', () => {
    assert.equal(DRAFT_PART2_ORDER.length, 8);
    assert.ok(part2SortKeyOf('배송 안내') > part2SortKeyOf('상세 정보'));
  });
});
