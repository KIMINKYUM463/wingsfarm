import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchElements } from './elementSearch.ts';

const items = [
  { id: 'a', name: '배송 트럭', keywords: '택배 차량' },
  { id: 'b', name: '택배 상자', keywords: '박스 포장' },
  { id: 'c', name: '트럭', keywords: '' },
  { id: 'a', name: '배송 트럭', keywords: '택배 차량' },
  { id: 'd', name: null, keywords: '트럭' },
];

test('이름이 같은 것 → 이름에 포함 → 검색어에만 있는 순서, 같은 id는 한 번만', () => {
  assert.deepEqual(
    searchElements(items, '트럭').map((i) => i.id),
    ['c', 'a', 'd'],
  );
  assert.deepEqual(
    searchElements(items, '택배').map((i) => i.id),
    ['b', 'a'],
  );
});

test('대소문자·띄어쓰기를 무시하고, 빈 검색어는 결과가 없다', () => {
  assert.deepEqual(searchElements(items, ' 택배상자 ').map((i) => i.id), ['b']);
  assert.deepEqual(searchElements([{ id: 'x', name: 'BEST 뱃지' }], 'best').map((i) => i.id), ['x']);
  assert.deepEqual(searchElements(items, '   '), []);
});

test('최대 개수를 넘지 않는다', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, name: `별 ${i}` }));
  assert.equal(searchElements(many, '별', 3).length, 3);
});
