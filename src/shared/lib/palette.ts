import type { DraftPalette, PaletteRole } from '../types/draft';

/**
 * 상세페이지 색 팔레트 계산 (서버 기획·초안 화면·에디터 색상 탭이 함께 사용)
 * main: 메인 문구 강조·버튼·라벨 / point: 보조 강조
 * bgLight: 기본 섹션 바탕 / bgDark: 강조 섹션 바탕(밝은 배경보다 조금 짙게)
 */
export const PALETTE_ROLES: { role: PaletteRole; label: string; description: string }[] = [
  { role: 'main', label: '대표 색상', description: '버튼·배지·강조에 칠해요. 흰 글씨가 잘 보이는 진한 색이 좋아요' },
  { role: 'point', label: '포인트 색상', description: '구분선·연결선 등 보조 강조, 대표보다 한 단계 연하게' },
  { role: 'bgLight', label: '밝은 배경', description: '본문 섹션 바탕, 흰색에 가깝게' },
  { role: 'bgDark', label: '어두운 배경', description: '강조 섹션 바탕, 밝은 배경보다 조금 짙게' },
];

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const rgbToHex = (rgb: readonly number[]) =>
  `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** amount 0~1 만큼 흰색 쪽으로 섞기 */
export const tint = (hex: string, amount: number) => rgbToHex(hexToRgb(hex).map((v) => v + (255 - v) * amount));
/** amount 0~1 만큼 검은색 쪽으로 섞기 */
export const shade = (hex: string, amount: number) => rgbToHex(hexToRgb(hex).map((v) => v * (1 - amount)));

/** WCAG 상대 휘도 — 흰 글자를 올릴 수 있는 색인지 판단 */
export const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** 두 색을 amount(0~1) 비율로 섞기. amount=1이면 b */
const mix = (a: string, b: string, amount: number) => {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  return rgbToHex(from.map((v, i) => v + (to[i]! - v) * amount));
};

/** 따뜻한 종이색 — 대표색을 연하게 풀면 사탕 분홍이 되므로 바탕은 이 색에 조금만 섞는다 */
const PAPER = '#F6F3ED';

/** 대표색 하나로 나머지 3색을 만든다. 흰 글씨가 읽히도록 대표색은 충분히 어둡게 맞춘다. */
export function derivePalette(main: string): DraftPalette {
  let base = main.toUpperCase();
  for (let i = 0; i < 6 && luminance(base) > 0.22; i++) base = shade(base, 0.15);
  return {
    main: base,
    point: tint(base, 0.16),
    bgLight: mix(PAPER, base, 0.04),
    bgDark: mix(PAPER, base, 0.1),
  };
}

/** 에디터 색상 탭·초안 색 바꾸기의 톤 */
export const TONE_PRESETS: { id: string; name: string; main: string }[] = [
  { id: 'mocha', name: '모카 브라운', main: '#6B4A32' },
  { id: 'rose', name: '로즈', main: '#8E3A54' },
  { id: 'wine', name: '와인', main: '#6B2D3C' },
  { id: 'nude', name: '누드 베이지', main: '#8A6A4E' },
  { id: 'amber', name: '앰버', main: '#8B5A2B' },
  { id: 'lavender', name: '라벤더', main: '#5C4E86' },
  { id: 'sky', name: '스카이 블루', main: '#2F7FB8' },
  { id: 'ocean', name: '오션 블루', main: '#1F5C99' },
  { id: 'navy', name: '미드나잇 네이비', main: '#1E2A4A' },
  { id: 'mint', name: '민트 틸', main: '#1E7F74' },
  { id: 'forest', name: '포레스트', main: '#2F5D3A' },
  { id: 'coral', name: '테라코타', main: '#A24B32' },
  { id: 'mono', name: '모노 그레이', main: '#3D3D3D' },
];

/** 카테고리만 알 때 쓰는 기본 톤 (파스텔 대신 흙·잉크 쪽) */
export const CATEGORY_TONES: Record<string, string[]> = {
  agri: ['forest', 'mocha', 'nude', 'amber'],
  food: ['mocha', 'amber', 'forest', 'nude'],
  electronics: ['navy', 'ocean', 'mono', 'sky'],
  living: ['mocha', 'nude', 'forest', 'mono'],
  fashion: ['mono', 'nude', 'navy', 'wine'],
  accessory: ['nude', 'mono', 'mocha', 'wine'],
  beauty: ['nude', 'rose', 'mocha', 'mint'],
  health: ['forest', 'ocean', 'mint', 'mocha'],
  edu: ['ocean', 'navy', 'mocha', 'mint'],
  clinic: ['nude', 'sky', 'mint', 'mono'],
};

/** 상품명에서 빛깔을 짐작할 때. 앞쪽일수록 잘 맞는다 */
const PRODUCT_TONE_HINTS: { re: RegExp; tones: string[] }[] = [
  { re: /딸기|체리|석류|자두|와인/, tones: ['wine', 'mocha', 'navy'] },
  { re: /사과|풋사과/, tones: ['forest', 'wine', 'mocha'] },
  { re: /포도|블루베리|아로니아/, tones: ['navy', 'wine', 'lavender'] },
  { re: /감귤|한라봉|오렌지|천혜향|레드향|유자|귤/, tones: ['amber', 'coral', 'mocha'] },
  { re: /배|복숭아/, tones: ['nude', 'mocha', 'forest'] },
  { re: /수박/, tones: ['forest', 'wine', 'coral'] },
  { re: /참외|멜론/, tones: ['amber', 'forest', 'nude'] },
  { re: /꿀|벌꿀|조청|엿/, tones: ['amber', 'mocha', 'nude'] },
  { re: /쌀|현미|잡곡|찹쌀|보리/, tones: ['nude', 'mocha', 'mono'] },
  { re: /한우|소고기|돼지|닭|오리/, tones: ['mocha', 'wine', 'navy'] },
  { re: /고등어|갈치|생선|오징어|문어|전복|굴|새우|꽃게|대게|수산|멸치|조기/, tones: ['ocean', 'navy', 'mono'] },
  { re: /버섯|표고/, tones: ['mocha', 'nude', 'forest'] },
  { re: /마늘|양파|생강/, tones: ['nude', 'mocha', 'mono'] },
  { re: /고추|김치|고춧가루/, tones: ['coral', 'wine', 'mocha'] },
  { re: /녹차|쑥|매실/, tones: ['forest', 'mint', 'mocha'] },
  { re: /콩|두부|된장|간장/, tones: ['mocha', 'nude', 'forest'] },
];

/** 파스텔로 읽히기 쉬운 톤 — 상품이 그 빛깔이 아니면 쓰지 않는다 */
const SWEET_TONES = new Set(['rose', 'lavender', 'sky']);

const uniqueTones = (ids: string[]) => {
  const known = new Set(TONE_PRESETS.map((t) => t.id));
  return [...new Set(ids)].filter((id) => known.has(id));
};

/** 상품명·카테고리에 어울리는 톤 id (최소 4개) */
export function suggestProductTones(productName: string, categoryId = ''): string[] {
  const text = productName.replace(/\s+/g, '');
  const category = CATEGORY_TONES[categoryId] ?? CATEGORY_TONES.agri;
  const hinted = PRODUCT_TONE_HINTS.find((rule) => rule.re.test(text))?.tones ?? [];
  return uniqueTones([...hinted, ...category, 'mocha', 'forest', 'mono']).slice(0, 6);
}

/** AI가 고른 톤이 상품과 안 맞으면(예: 고등어+로즈) 상품 기본 톤으로 되돌린다 */
export function resolveProductToneId(toneId: string | undefined, productName: string, categoryId = ''): string {
  const home = suggestProductTones(productName, categoryId);
  if (toneId && home.includes(toneId)) return toneId;
  if (toneId && TONE_PRESETS.some((t) => t.id === toneId) && !SWEET_TONES.has(toneId)) return toneId;
  return home[0] ?? 'forest';
}

export function paletteFromToneId(toneId: string | undefined, fallbackMain = '#2F5D3A'): DraftPalette {
  const tone = TONE_PRESETS.find((t) => t.id === toneId);
  return derivePalette(tone?.main ?? fallbackMain);
}

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * 팔레트 역할이 달린 노드 — 섹션 레이아웃이 만든 바탕·배지·강조 문구·테두리·그림자
 * colorVar → fill, strokeVar → stroke, shadowVar → shadowColor
 */
export interface PaletteNode {
  colorVar?: string;
  strokeVar?: string;
  shadowVar?: string;
  fill?: unknown;
  stroke?: unknown;
  shadowColor?: unknown;
  children?: PaletteNode[];
}

/** 역할 키 → 다시 칠할 속성 */
const PALETTE_LINKS = [
  ['colorVar', 'fill'],
  ['strokeVar', 'stroke'],
  ['shadowVar', 'shadowColor'],
] as const;

const isPaletteRole = (value: unknown): value is PaletteRole => PALETTE_ROLES.some((r) => r.role === value);

/** 팔레트를 트리 전체에 적용한 새 트리 (바뀐 노드만 새 객체 → 에디터 자동 저장이 바뀐 섹션만 저장) */
export function recolorTree<T extends PaletteNode>(node: T, palette: DraftPalette): T {
  const recolored: Partial<Record<'fill' | 'stroke' | 'shadowColor', string>> = {};
  for (const [role, prop] of PALETTE_LINKS) {
    const value = node[role];
    if (isPaletteRole(value) && node[prop] !== palette[value]) recolored[prop] = palette[value];
  }
  const children = node.children?.map((child) => recolorTree(child, palette));
  const childrenChanged = Boolean(children?.some((child, i) => child !== node.children![i]));
  if (!Object.keys(recolored).length && !childrenChanged) return node;
  return { ...node, ...recolored, ...(childrenChanged && { children }) };
}

/** 팔레트에 연결된 노드 수 (0이면 색상 탭으로 바꿀 수 있는 요소가 없음) */
export const countPaletteNodes = (node: PaletteNode): number =>
  (PALETTE_LINKS.some(([role]) => isPaletteRole(node[role])) ? 1 : 0) +
  (node.children ?? []).reduce((sum, child) => sum + countPaletteNodes(child), 0);

/** 채도가 거의 없는 회색 계열인지 (RGB 세 값의 차이가 작다) */
const isNeutral = (hex: string) => {
  const rgb = hexToRgb(hex);
  return Math.max(...rgb) - Math.min(...rgb) < 10;
};

/**
 * AI가 고른 바탕이 무채색 회색이면 대표색을 옅게 섞은 바탕으로 바꾼다 — 회색 바탕은 식품을 칙칙해 보이게 한다.
 * 판매자가 색상 탭에서 직접 고른 색에는 쓰지 않는다.
 */
export function tintNeutralBackgrounds(palette: DraftPalette): DraftPalette {
  if (isNeutral(palette.main)) return palette;
  const derived = derivePalette(palette.main);
  return {
    ...palette,
    bgLight: isNeutral(palette.bgLight) ? derived.bgLight : palette.bgLight,
    bgDark: isNeutral(palette.bgDark) ? derived.bgDark : palette.bgDark,
  };
}

/** AI 응답이나 사용자 입력을 안전한 팔레트로 정리 (형식이 틀리면 대표색 기준으로 다시 계산) */
export function normalizePalette(input: Partial<Record<PaletteRole, unknown>> | undefined, fallback: DraftPalette): DraftPalette {
  const main = typeof input?.main === 'string' && HEX_COLOR.test(input.main) ? input.main : fallback.main;
  const derived = derivePalette(main);
  const pick = (role: PaletteRole) => {
    const v = input?.[role];
    return typeof v === 'string' && HEX_COLOR.test(v) ? v.toUpperCase() : derived[role];
  };
  return { main: derived.main, point: pick('point'), bgLight: pick('bgLight'), bgDark: pick('bgDark') };
}
