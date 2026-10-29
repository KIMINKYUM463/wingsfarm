import { DEFAULT_DESIGN_STYLE, designStyleOption, type DesignStyleId } from '@/shared/lib/designStyles';
import type { SectionLayout } from '../catalog/sections';

/**
 * 디자인 스타일별 레이아웃 규칙 (sectionLayouts가 읽는다)
 *
 * 860px 상세페이지 가독성 기준: 본문 30px 이상, 소제목 34~42px, 헤드라인 56px 이상, 행간 1.5~1.7.
 * surface: 섹션 바탕 — 팔레트 역할(bgLight/bgDark/main) 또는 흰색. main 바탕은 글자를 밝게 바꾼다.
 */
export type Surface = 'white' | 'bgLight' | 'bgDark' | 'main';

export interface DesignTokens {
  font: { heading: string; body: string };
  headingWeight: number;
  /** 제목 크기 배율 */
  scale: number;
  /** 제목·본문 기본 정렬 */
  align: 'center' | 'left';
  /** 섹션 라벨: 글자만 / 알약 배지 / 위에 짧은 선 */
  label: 'text' | 'pill' | 'rule';
  /** 제목 아래 짧은 강조선 */
  titleRule: boolean;
  radius: { card: number; image: number; chip: number };
  /** 카드: 채운 상자 / 테두리만 */
  card: 'fill' | 'outline';
  /** 첫 화면: 문구 → 사진 / 사진 → 문구 / 사진 위에 문구 */
  hero: 'stack' | 'imageTop' | 'overlay';
  /** 포인트 나열: 위아래로 쌓기 / 사진·문구 좌우 번갈아 */
  points: 'stack' | 'zigzag';
  surfaces: Record<SectionLayout, Surface>;
}

const BASE_SURFACES: Record<SectionLayout, Surface> = {
  hero: 'bgLight',
  visual: 'bgLight',
  points: 'bgLight',
  grid: 'bgLight',
  compare: 'bgDark',
  size: 'bgLight',
  story: 'bgDark',
  steps: 'bgLight',
  table: 'white',
  faq: 'bgLight',
  reviews: 'bgDark',
  badges: 'bgLight',
  cta: 'main',
  contact: 'bgDark',
  notice: 'white',
};

const fonts = (id: DesignStyleId) => ({ heading: designStyleOption(id).headingFont, body: 'Pretendard' });

export const DESIGN_TOKENS: Record<DesignStyleId, DesignTokens> = {
  /** 미니멀·고대비: 흰 바탕, 왼쪽 정렬 큰 제목, 연한 색 카드(벤토) */
  modern: {
    font: fonts('modern'),
    headingWeight: 800,
    scale: 1.04,
    align: 'left',
    label: 'text',
    titleRule: false,
    radius: { card: 28, image: 24, chip: 32 },
    card: 'fill',
    hero: 'stack',
    points: 'stack',
    surfaces: { ...BASE_SURFACES, hero: 'white', visual: 'white', points: 'white', size: 'white', steps: 'white', badges: 'white', story: 'bgLight', contact: 'bgLight' },
  },
  /** 산지 감성: 따뜻한 바탕, 명조 제목, 크게 둥근 사진, 사진 → 문구 순서 */
  natural: {
    font: fonts('natural'),
    headingWeight: 800,
    scale: 1,
    align: 'center',
    label: 'rule',
    titleRule: false,
    radius: { card: 32, image: 40, chip: 32 },
    card: 'fill',
    hero: 'imageTop',
    points: 'zigzag',
    surfaces: { ...BASE_SURFACES, table: 'bgLight', notice: 'bgLight' },
  },
  /** 선물·고급: 진한 바탕, 세리프 제목, 각진 사진, 가는 선과 테두리 */
  premium: {
    font: fonts('premium'),
    headingWeight: 700,
    scale: 0.96,
    align: 'center',
    label: 'rule',
    titleRule: true,
    radius: { card: 0, image: 0, chip: 0 },
    card: 'outline',
    hero: 'overlay',
    points: 'zigzag',
    surfaces: { ...BASE_SURFACES, hero: 'main', story: 'main', reviews: 'main', points: 'white', grid: 'white', table: 'white', faq: 'white', contact: 'bgLight' },
  },
  /** 할인·이벤트: 아주 굵은 제목, 알약 배지, 큰 라운드, 강한 색 대비 */
  pop: {
    font: fonts('pop'),
    headingWeight: 900,
    scale: 1.06,
    align: 'center',
    label: 'pill',
    titleRule: false,
    radius: { card: 36, image: 36, chip: 40 },
    card: 'fill',
    hero: 'stack',
    points: 'stack',
    surfaces: { ...BASE_SURFACES, hero: 'bgDark', grid: 'bgDark', badges: 'bgDark', steps: 'bgDark', faq: 'bgDark' },
  },
};

export const designTokens = (id: DesignStyleId | undefined) => DESIGN_TOKENS[id ?? DEFAULT_DESIGN_STYLE] ?? DESIGN_TOKENS[DEFAULT_DESIGN_STYLE];
