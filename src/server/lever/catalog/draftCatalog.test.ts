import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findUnsupportedClaims } from './factGuard.ts';
import { countPaletteNodes, derivePalette, luminance, normalizePalette, recolorTree, TONE_PRESETS } from '../../../shared/lib/palette.ts';
import { defaultFlow, fitLength, LENGTH_TARGET, sectionTypesFor, suggestableTypes, withAiNotice } from './sections.ts';
import { estimateLines } from '../templates/nodes.ts';

describe('사실 검사', () => {
  it('입력에 없는 산지직송·인증·순위 주장을 찾는다', () => {
    const labels = findUnsupportedClaims('산지직송으로 보내는 HACCP 인증 판매량 1위 꽃게', '상품명: 꽃게\n특징: 살이 꽉 참').map((w) => w.label);
    assert.deepEqual(labels, ['산지직송', '인증', '순위·판매 실적']);
  });

  it('입력에 근거가 있으면 경고하지 않는다', () => {
    assert.deepEqual(findUnsupportedClaims('산지직송으로 보내요', '배송: 산지직송'), []);
    assert.deepEqual(findUnsupportedClaims('당도 13브릭스', '특징: 평균 당도 13Brix'), []);
  });

  it('입력에 없는 배송 약속·고객센터 정보를 찾는다', () => {
    const labels = findUnsupportedClaims('오늘 출발! 평일 오전 10시~오후 5시 1588-1234', '상품명: 사과').map((w) => w.label);
    assert.deepEqual(labels, ['배송 약속', '연락처·운영 시간']);
    assert.deepEqual(findUnsupportedClaims('오후 2시 전 주문은 당일 발송', '배송: 오후 2시 전 주문 당일 발송'), []);
  });

  it('감성 표현은 통과한다', () => {
    assert.deepEqual(findUnsupportedClaims('가을 바다의 맛을 그대로', '상품명: 꽃게'), []);
  });
});

describe('색 팔레트', () => {
  it('대표색은 흰 글씨가 읽히도록 충분히 어둡다', () => {
    for (const tone of TONE_PRESETS) assert.ok(luminance(derivePalette(tone.main).main) <= 0.22, tone.name);
  });

  it('밝은 배경 > 어두운 배경 > 대표색 순으로 밝다', () => {
    const p = derivePalette('#2F5D3A');
    assert.ok(luminance(p.bgLight) > luminance(p.bgDark));
    assert.ok(luminance(p.bgDark) > luminance(p.main));
  });

  it('형식이 틀린 색은 대표색 기준으로 다시 계산한다', () => {
    const p = normalizePalette({ main: '#1F5C99', point: 'red' }, derivePalette('#000000'));
    assert.equal(p.point, derivePalette('#1F5C99').point);
  });

  it('colorVar 요소만 다시 칠하고, 바뀌지 않은 가지는 그대로 둔다', () => {
    const palette = derivePalette('#1F5C99');
    const untouched = { fill: '#111111', children: [{ fill: '#222222' }] };
    const frame = { colorVar: 'bgLight', fill: '#FFFFFF', children: [untouched, { colorVar: 'main', fill: '#000000' }] };
    const next = recolorTree(frame, palette);
    assert.equal(next.fill, palette.bgLight);
    assert.equal(next.children[0], untouched);
    assert.equal(next.children[1].fill, palette.main);
    assert.equal(recolorTree(next, palette), next);
    assert.equal(countPaletteNodes(frame), 2);
  });
});

describe('섹션 카탈로그', () => {
  it('근거 없는 섹션은 기본 흐름에서 빠지고 길이 기준을 채운다', () => {
    const flow = defaultFlow('agri', 'short', (t) => !t.evidence);
    assert.equal(flow[0], 'hero');
    assert.ok(!flow.includes('review'));
    assert.ok(!flow.includes('point_producer'));
    assert.ok(flow.length >= LENGTH_TARGET.short[0] - 3);
  });

  it('AI 사진을 쓰면 AI 고지를 맨 끝에 한 번만 넣고, 안 쓰면 뺀다', () => {
    assert.deepEqual(withAiNotice(['hero', 'notice_ai', 'faq'], true), ['hero', 'faq', 'notice_ai']);
    assert.deepEqual(withAiNotice(['hero', 'faq'], true), ['hero', 'faq', 'notice_ai']);
    assert.deepEqual(withAiNotice(['hero', 'notice_ai', 'faq'], false), ['hero', 'faq']);
  });

  it('기본 흐름은 길이 상한을 넘지 않는다', () => {
    for (const categoryId of ['agri', 'electronics', 'beauty']) {
      for (const length of ['short', 'long'] as const) {
        assert.ok(defaultFlow(categoryId, length, () => true).length <= LENGTH_TARGET[length][1], `${categoryId} ${length}`);
      }
    }
  });

  it('너무 길면 본문 뒤쪽부터 덜고 배송·마무리 섹션은 남긴다', () => {
    const ids = ['hero', 'concept', 'quality', 'detail', 'usage', 'shipping_method', 'faq', 'contact'];
    assert.deepEqual(fitLength(ids, 'agri', 5), ['hero', 'concept', 'shipping_method', 'faq', 'contact']);
    assert.equal(fitLength(ids, 'agri', 20), ids);
  });

  it('명절·선물 섹션은 근거가 있어야 하고, 농산물에는 사용 방법을 먼저 고르지 않는다', () => {
    const agri = sectionTypesFor('agri');
    for (const id of ['package', 'season_delivery_schedule', 'season_banner']) assert.equal(agri.find((t) => t.id === id)?.evidence, 'gift', id);
    assert.ok(!suggestableTypes('agri').some((t) => t.id === 'how_to'));
    assert.ok(suggestableTypes('beauty').some((t) => t.id === 'how_to'));
  });

  it('카테고리 전용 섹션이 공통 섹션을 덮어쓴다', () => {
    const types = sectionTypesFor('food');
    assert.equal(types.filter((t) => t.id === 'recipe').length, 1);
    assert.ok(types.some((t) => t.id === 'ingredients'));
  });
});

describe('줄 수 추정', () => {
  it('어절 단위로 줄을 나눈다', () => {
    assert.equal(estimateLines('짧은 문장', 740, 26), 1);
    assert.ok(estimateLines('가'.repeat(60), 740, 26) >= 2);
    assert.equal(estimateLines('첫 줄\n둘째 줄', 740, 26), 2);
  });
});
