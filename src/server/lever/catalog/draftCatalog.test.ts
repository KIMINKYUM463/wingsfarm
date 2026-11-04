import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findUnsupportedClaims } from './factGuard.ts';
import {
  countPaletteNodes,
  derivePalette,
  dominantToneFromTree,
  harmonizeTreeColors,
  luminance,
  nearestToneId,
  normalizePalette,
  parseCssColor,
  recolorTree,
  resolveProductToneId,
  suggestProductTones,
  tintNeutralBackgrounds,
  toneMatchScore,
  TONE_PRESETS,
  unifyTreePalette,
} from '../../../shared/lib/palette.ts';
import { toneIdFromTemplateId } from '../../../shared/lib/templateTone.ts';
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

  it('AI가 고른 회색 바탕은 대표색을 옅게 섞은 바탕으로 바꾸고, 색 있는 바탕·무채색 대표색은 그대로 둔다', () => {
    const brown = { main: '#5C3A23', point: '#8B593E', bgLight: '#F8F8F8', bgDark: '#FBF1E6' };
    const tinted = tintNeutralBackgrounds(brown);
    assert.equal(tinted.bgLight, derivePalette('#5C3A23').bgLight);
    assert.equal(tinted.bgDark, '#FBF1E6');
    const mono = { main: '#3D3D3D', point: '#777777', bgLight: '#F8F8F8', bgDark: '#E8E8E8' };
    assert.deepEqual(tintNeutralBackgrounds(mono), mono);
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

  it('바탕은 대표색을 연하게 푼 분홍이 아니라 종이색에 가깝다', () => {
    const coral = derivePalette('#A24B32');
    const n = parseInt(coral.bgLight.slice(1), 16);
    const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    assert.ok(Math.max(...rgb) - Math.min(...rgb) < 28, coral.bgLight);
    assert.ok(luminance(coral.bgLight) > 0.8);
  });

  it('상품명으로 톤을 고르고, 안 맞는 파스텔은 되돌린다', () => {
    assert.equal(suggestProductTones('햇사과 5kg', 'agri')[0], 'forest');
    assert.equal(suggestProductTones('제주 고등어', 'agri')[0], 'ocean');
    assert.equal(suggestProductTones('아카시아 벌꿀', 'food')[0], 'amber');
    assert.equal(resolveProductToneId('rose', '제주 고등어', 'agri'), 'ocean');
    assert.equal(resolveProductToneId('mocha', '햇사과 5kg', 'agri'), 'mocha');
  });

  it('색감 세트: 가까운 톤·트리 강조색·하모나이즈가 페이지 톤을 맞춘다', () => {
    assert.equal(nearestToneId('#2F5D3A'), 'forest');
    assert.equal(nearestToneId('#1E2A4A'), 'navy');
    assert.equal(toneMatchScore('forest', 'forest'), 3);
    assert.ok(toneMatchScore('mint', 'forest') >= 2);
    assert.equal(parseCssColor('rgba(250, 89, 85, 1)'), '#FA5955');
    const figmaLike = {
      children: [
        { fill: 'rgba(247, 81, 77, 1)' },
        { fill: 'rgba(255, 255, 255, 1)' },
        { fill: 'rgba(34, 34, 34, 1)' },
      ],
    };
    assert.equal(dominantToneFromTree(figmaLike), 'coral');
    const palette = derivePalette('#2F5D3A');
    const unified = unifyTreePalette(figmaLike, palette);
    const accent = parseCssColor(unified.children![0].fill);
    assert.ok(accent);
    // 빨간 강조가 포레스트 쪽으로 당겨졌는지 (초록 기운)
    const g = parseInt(accent!.slice(3, 5), 16);
    const b = parseInt(accent!.slice(5, 7), 16);
    assert.ok(g > b, `expected greener accent, got ${accent}`);
    const withVar = { colorVar: 'main' as const, fill: '#000000', children: [{ fill: 'rgba(247, 81, 77, 1)' }] };
    const onlyVar = unifyTreePalette(withVar, palette);
    assert.equal(onlyVar.fill, palette.main);
    // colorVar가 있으면 자식 하드코딩 색은 건드리지 않는다
    assert.equal(onlyVar.children![0].fill, 'rgba(247, 81, 77, 1)');
    const harm = harmonizeTreeColors({ fill: 'rgba(247, 81, 77, 1)' }, palette, 1);
    assert.notEqual(harm.fill, 'rgba(247, 81, 77, 1)');
    assert.equal(toneIdFromTemplateId('builtin-ds-natural-hero'), 'forest');
    assert.equal(toneIdFromTemplateId('builtin-ds-premium-cta'), 'navy');
    assert.equal(toneIdFromTemplateId('builtin-ds-pop-points'), 'coral');
    assert.equal(toneIdFromTemplateId('builtin-pt-hero-specbanner-b'), 'forest');
    assert.equal(toneIdFromTemplateId('figma-abc'), undefined);
  });

  it('테두리(strokeVar)·그림자(shadowVar)도 팔레트를 따라 바뀐다', () => {
    const palette = derivePalette('#1F5C99');
    const frame = { fill: '#FFFFFF', children: [{ fill: '#FFFFFF', stroke: '#000000', strokeVar: 'point', shadowColor: '#000000', shadowVar: 'main' }] };
    const [card] = recolorTree(frame, palette).children;
    assert.equal(card.fill, '#FFFFFF');
    assert.equal(card.stroke, palette.point);
    assert.equal(card.shadowColor, palette.main);
    assert.equal(countPaletteNodes(frame), 1);
  });
});

describe('섹션 카탈로그', () => {
  it('농수산물은 맨 뒤에 배송·교환환불·상품상세정보가 있다', () => {
    for (const length of ['short', 'long', 'extra'] as const) {
      const flow = defaultFlow('agri', length, () => true);
      const tail = flow.filter((id) => id !== 'notice_ai').slice(-3);
      assert.deepEqual(tail, ['shipping_method', 'return_policy', 'product_notice'], length);
    }
  });

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
      for (const length of ['short', 'long', 'extra'] as const) {
        assert.ok(defaultFlow(categoryId, length, () => true).length <= LENGTH_TARGET[length][1], `${categoryId} ${length}`);
      }
    }
  });

  it('너무 길면 본문 뒤쪽부터 덜고 배송·마무리 섹션은 남긴다', () => {
    const ids = ['hero', 'concept', 'quality', 'detail', 'usage', 'shipping_method', 'faq', 'contact'];
    assert.deepEqual(fitLength(ids, 'agri', 5), ['hero', 'concept', 'shipping_method', 'faq', 'contact']);
    assert.equal(fitLength(ids, 'agri', 20), ids);
  });

  it('길이를 줄여도 구매 유도는 남긴다', () => {
    const ids = ['hero', 'concept', 'quality', 'detail', 'usage', 'recommend', 'conversion', 'shipping_method', 'faq', 'contact'];
    const trimmed = fitLength(ids, 'agri', 6);
    assert.ok(trimmed.includes('conversion'));
    assert.ok(trimmed.includes('shipping_method'));
    assert.equal(trimmed[0], 'hero');
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
