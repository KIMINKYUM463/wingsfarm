import type { GraphicElement } from '@/shared/types/elements';

/**
 * 기본 그래픽 요소 (에디터 도형 패널의 "그래픽")
 * - assetId: `graphic-{slug}` → `/api/lever/storage/graphics/{slug}.svg`
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

const GRAPHICS: { slug: string; name: string; svg: string }[] = [
  { slug: 'badge-best', name: 'BEST 뱃지', svg: svg(`<circle cx="100" cy="100" r="92" fill="#E53935"/><circle cx="100" cy="100" r="80" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 6"/>${label('BEST', 44)}`) },
  { slug: 'badge-new', name: 'NEW 뱃지', svg: svg(`<circle cx="100" cy="100" r="92" fill="#1E88E5"/>${label('NEW', 52)}`) },
  { slug: 'badge-hot', name: 'HOT 뱃지', svg: svg(`<circle cx="100" cy="100" r="92" fill="#FB8C00"/>${label('HOT', 52)}`) },
  { slug: 'burst-sale', name: 'SALE 버스트', svg: svg(`<polygon points="${starPoints(16, 96, 78)}" fill="#FFD600"/>${label('SALE', 42, '#111')}`) },
  { slug: 'burst-point', name: 'POINT 버스트', svg: svg(`<polygon points="${starPoints(12, 96, 80)}" fill="#7C4DFF"/>${label('POINT', 36)}`) },
  { slug: 'check-circle', name: '체크 아이콘', svg: svg(`<circle cx="100" cy="100" r="92" fill="#22C55E"/><path d="M58 104 L88 134 L144 74" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`) },
  { slug: 'number-01', name: '넘버 01', svg: svg(`<circle cx="100" cy="100" r="92" fill="#111827"/>${label('01', 72)}`) },
  { slug: 'number-02', name: '넘버 02', svg: svg(`<circle cx="100" cy="100" r="92" fill="#111827"/>${label('02', 72)}`) },
  { slug: 'number-03', name: '넘버 03', svg: svg(`<circle cx="100" cy="100" r="92" fill="#111827"/>${label('03', 72)}`) },
  { slug: 'arrow-right', name: '화살표', svg: svg(`<path d="M20 80 H120 V40 L185 100 L120 160 V120 H20 Z" fill="#111827"/>`) },
  { slug: 'arrow-down', name: '아래 화살표', svg: svg(`<path d="M80 15 H120 V110 H165 L100 185 L35 110 H80 Z" fill="#111827"/>`) },
  { slug: 'speech-bubble', name: '말풍선', svg: svg(`<path d="M20 30 Q20 15 35 15 H165 Q180 15 180 30 V120 Q180 135 165 135 H85 L50 175 L58 135 H35 Q20 135 20 120 Z" fill="#fff" stroke="#111827" stroke-width="6"/>`) },
  { slug: 'ribbon', name: '리본 배너', svg: svg(`<path d="M0 40 H40 V100 H0 L18 70 Z M260 40 H220 V100 H260 L242 70 Z" fill="#B91C1C"/><rect x="30" y="25" width="200" height="70" fill="#E53935"/>${label('SPECIAL', 34, '#fff', '60')}`, 260, 120) },
  { slug: 'heart', name: '하트', svg: svg(`<path d="M100 178 C40 130 10 100 10 62 C10 34 32 14 58 14 C78 14 92 26 100 42 C108 26 122 14 142 14 C168 14 190 34 190 62 C190 100 160 130 100 178 Z" fill="#F43F5E"/>`) },
  { slug: 'star', name: '별', svg: svg(`<polygon points="${starPoints(5, 95, 40)}" fill="#FACC15"/>`) },
  { slug: 'quote', name: '따옴표', svg: svg(`<path d="M30 120 Q30 50 85 35 L90 55 Q60 70 62 95 H85 V160 H30 Z M115 120 Q115 50 170 35 L175 55 Q145 70 147 95 H170 V160 H115 Z" fill="#111827"/>`) },
  { slug: 'tag-free-shipping', name: '무료배송 태그', svg: svg(`<rect x="6" y="6" width="248" height="88" rx="44" fill="#111827"/>${label('무료배송', 38)}`, 260, 100) },
  { slug: 'tag-limited', name: '한정수량 태그', svg: svg(`<rect x="6" y="6" width="248" height="88" rx="12" fill="#E53935"/>${label('한정수량', 38)}`, 260, 100) },
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
    return { id, name: g.name, thumbnailUrl: graphicUrl(id), imageUrl: graphicUrl(id) };
  });
