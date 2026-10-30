import type { GraphicElement } from '@/shared/types/elements';
import STICKERS from './stickers.generated.json' with { type: 'json' };

/**
 * 기본 그래픽 요소 (에디터 요소 패널의 라벨·꾸밈·스티커)
 * - assetId: `graphic-{slug}` → `/api/lever/storage/graphics/{slug}.svg`
 * - 스티커는 scripts/build-element-assets.mjs가 만든 Fluent Emoji Flat (MIT)
 */
const GRAPHIC_PREFIX = 'graphic-';
const FONT = `font-family="Pretendard, 'Apple SD Gothic Neo', sans-serif" font-weight="800"`;

const svg = (body: string, w = 200, h = 200) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const label = (text: string, size: number, fill = '#fff', y = '50%') =>
  `<text x="50%" y="${y}" ${FONT} font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="central">${text}</text>`;

/** 별 모양 꼭짓점 좌표 */
const starPoints = (points: number, outer: number, inner: number, c = 100) =>
  Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    return `${(c + r * Math.cos(angle)).toFixed(1)},${(c + r * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');

/** 둥근 원 뱃지 (점선 테두리 선택) */
const circleBadge = (text: string, size: number, fill: string, dashed = false) =>
  svg(
    `<circle cx="100" cy="100" r="92" fill="${fill}"/>` +
      (dashed ? `<circle cx="100" cy="100" r="80" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 6"/>` : '') +
      label(text, size),
  );

/** 두 줄 원형 뱃지 */
const twoLineBadge = (top: string, bottom: string, fill: string) =>
  svg(
    `<circle cx="100" cy="100" r="92" fill="${fill}"/><circle cx="100" cy="100" r="82" fill="none" stroke="#fff" stroke-width="2"/>` +
      label(top, 30, '#fff', '76') +
      label(bottom, 46, '#fff', '120'),
  );

/** 가로로 긴 알약·사각 태그 */
const pillTag = (text: string, fill: string, rx = 44, color = '#fff') =>
  svg(`<rect x="6" y="6" width="248" height="88" rx="${rx}" fill="${fill}"/>${label(text, 38, color)}`, 260, 100);

type Graphic = { slug: string; name: string; group: string; keywords?: string; svg: string };

const LABEL = '라벨·뱃지';
const DECOR = '꾸밈 그래픽';

const GRAPHICS: Graphic[] = [
  { slug: 'badge-best', name: 'BEST 뱃지', group: LABEL, keywords: '베스트 인기', svg: circleBadge('BEST', 44, '#E53935', true) },
  { slug: 'badge-new', name: 'NEW 뱃지', group: LABEL, keywords: '신상 신제품', svg: circleBadge('NEW', 52, '#1E88E5') },
  { slug: 'badge-hot', name: 'HOT 뱃지', group: LABEL, keywords: '인기 핫딜', svg: circleBadge('HOT', 52, '#FB8C00') },
  { slug: 'badge-one-plus-one', name: '1+1 뱃지', group: LABEL, keywords: '원플러스원 증정 이벤트', svg: circleBadge('1+1', 64, '#DC2626', true) },
  { slug: 'badge-event', name: 'EVENT 뱃지', group: LABEL, keywords: '이벤트 행사', svg: circleBadge('EVENT', 40, '#16A34A', true) },
  { slug: 'badge-md-pick', name: 'MD 추천 뱃지', group: LABEL, keywords: '엠디 추천 픽', svg: twoLineBadge('MD', '추천', '#0F766E') },
  { slug: 'badge-sweet', name: '고당도 선별 뱃지', group: LABEL, keywords: '당도 브릭스 달콤', svg: twoLineBadge('고당도', '선별', '#EA580C') },
  { slug: 'badge-season', name: '시즌 한정 뱃지', group: LABEL, keywords: '제철 한정 기간', svg: twoLineBadge('시즌', '한정', '#9333EA') },
  { slug: 'badge-premium', name: '프리미엄 선물 뱃지', group: LABEL, keywords: '프리미엄 선물 명절', svg: twoLineBadge('PREMIUM', '선물용', '#78350F') },
  { slug: 'burst-sale', name: 'SALE 버스트', group: LABEL, keywords: '세일 할인 특가', svg: svg(`<polygon points="${starPoints(16, 96, 78)}" fill="#FFD600"/>${label('SALE', 42, '#111')}`) },
  { slug: 'burst-point', name: 'POINT 버스트', group: LABEL, keywords: '포인트 강조', svg: svg(`<polygon points="${starPoints(12, 96, 80)}" fill="#7C4DFF"/>${label('POINT', 36)}`) },
  { slug: 'number-01', name: '넘버 01', group: LABEL, keywords: '숫자 순서 1', svg: circleBadge('01', 72, '#111827') },
  { slug: 'number-02', name: '넘버 02', group: LABEL, keywords: '숫자 순서 2', svg: circleBadge('02', 72, '#111827') },
  { slug: 'number-03', name: '넘버 03', group: LABEL, keywords: '숫자 순서 3', svg: circleBadge('03', 72, '#111827') },
  { slug: 'tag-free-shipping', name: '무료배송 태그', group: LABEL, keywords: '무배 배송비', svg: pillTag('무료배송', '#111827') },
  { slug: 'tag-limited', name: '한정수량 태그', group: LABEL, keywords: '한정 수량 품절', svg: pillTag('한정수량', '#E53935', 12) },
  { slug: 'tag-direct', name: '산지직송 태그', group: LABEL, keywords: '산지 직송 농장', svg: pillTag('산지직송', '#2E7D32') },
  { slug: 'tag-today-harvest', name: '당일수확 태그', group: LABEL, keywords: '당일 수확 신선', svg: pillTag('당일수확', '#F57C00', 12) },
  { slug: 'tag-today-ship', name: '오늘출발 태그', group: LABEL, keywords: '당일 발송 출고 배송', svg: pillTag('오늘출발', '#0EA5E9') },
  { slug: 'tag-domestic', name: '국내산 태그', group: LABEL, keywords: '국산 원산지', svg: pillTag('국내산', '#1E3A8A', 12) },
  { slug: 'tag-fresh', name: '신선보장 태그', group: LABEL, keywords: '신선 보장 품질', svg: pillTag('신선보장', '#ECFDF5', 44, '#065F46') },
  { slug: 'tag-gift', name: '선물추천 태그', group: LABEL, keywords: '선물 명절 추천', svg: pillTag('선물추천', '#BE185D') },
  { slug: 'tag-review-event', name: '리뷰이벤트 태그', group: LABEL, keywords: '후기 리뷰 이벤트', svg: pillTag('리뷰이벤트', '#7C3AED', 12) },
  { slug: 'tag-soldout-soon', name: '품절임박 태그', group: LABEL, keywords: '품절 마감 한정', svg: pillTag('품절임박', '#111827', 12, '#FACC15') },
  { slug: 'ribbon', name: '리본 배너', group: LABEL, keywords: '리본 스페셜', svg: svg(`<path d="M0 40 H40 V100 H0 L18 70 Z M260 40 H220 V100 H260 L242 70 Z" fill="#B91C1C"/><rect x="30" y="25" width="200" height="70" fill="#E53935"/>${label('SPECIAL', 34, '#fff', '60')}`, 260, 120) },
  { slug: 'check-circle', name: '체크 아이콘', group: DECOR, keywords: '체크 확인', svg: svg(`<circle cx="100" cy="100" r="92" fill="#22C55E"/><path d="M58 104 L88 134 L144 74" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`) },
  { slug: 'arrow-right', name: '화살표', group: DECOR, keywords: '화살표 오른쪽', svg: svg(`<path d="M20 80 H120 V40 L185 100 L120 160 V120 H20 Z" fill="#111827"/>`) },
  { slug: 'arrow-down', name: '아래 화살표', group: DECOR, keywords: '화살표 아래', svg: svg(`<path d="M80 15 H120 V110 H165 L100 185 L35 110 H80 Z" fill="#111827"/>`) },
  { slug: 'speech-bubble', name: '말풍선', group: DECOR, keywords: '말풍선 대화', svg: svg(`<path d="M20 30 Q20 15 35 15 H165 Q180 15 180 30 V120 Q180 135 165 135 H85 L50 175 L58 135 H35 Q20 135 20 120 Z" fill="#fff" stroke="#111827" stroke-width="6"/>`) },
  { slug: 'heart', name: '하트', group: DECOR, keywords: '하트 사랑', svg: svg(`<path d="M100 178 C40 130 10 100 10 62 C10 34 32 14 58 14 C78 14 92 26 100 42 C108 26 122 14 142 14 C168 14 190 34 190 62 C190 100 160 130 100 178 Z" fill="#F43F5E"/>`) },
  { slug: 'star', name: '별', group: DECOR, keywords: '별 별점', svg: svg(`<polygon points="${starPoints(5, 95, 40)}" fill="#FACC15"/>`) },
  { slug: 'quote', name: '따옴표', group: DECOR, keywords: '따옴표 인용 후기', svg: svg(`<path d="M30 120 Q30 50 85 35 L90 55 Q60 70 62 95 H85 V160 H30 Z M115 120 Q115 50 170 35 L175 55 Q145 70 147 95 H170 V160 H115 Z" fill="#111827"/>`) },
  ...STICKERS,
];

const GRAPHIC_INDEX = new Map(GRAPHICS.map((g) => [g.slug, g]));

export const isGraphicAssetId = (assetId: string) => assetId.startsWith(GRAPHIC_PREFIX);

export const graphicUrl = (assetId: string) =>
  `/api/lever/storage/graphics/${assetId.slice(GRAPHIC_PREFIX.length)}.svg`;

/** storage 요청 경로 `graphics/{slug}.svg` → SVG 문자열 */
export const findGraphicSvg = (storagePath: string) => {
  const match = /^graphics\/([\w-]+)\.svg$/.exec(storagePath);
  return match ? GRAPHIC_INDEX.get(match[1])?.svg ?? null : null;
};

export const listGraphicElements = (limit?: number): GraphicElement[] =>
  GRAPHICS.slice(0, limit || undefined).map((g) => {
    const id = `${GRAPHIC_PREFIX}${g.slug}`;
    return { id, name: g.name, group: g.group, keywords: g.keywords, thumbnailUrl: graphicUrl(id), imageUrl: graphicUrl(id) };
  });
