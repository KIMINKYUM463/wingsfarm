import type { FrameNode } from '../frames/tree';
import leverpageFrames from './leverpage-templates.json';

/**
 * 기본 제공 템플릿
 *
 * - 레버페이지 원본 템플릿 3종(PS 3 / CA 4 / SS 2)은 원본 저장소 히스토리의 실제 데이터 그대로
 * - 나머지 구성(메인 비주얼·상품 특징·상세 정보·후기·구매 안내)은 같은 규칙으로 만든 기본 템플릿
 *   (`_image` = 상품 사진 자리, 숨김 `prompt` = 문구 작성 가이드)
 * - Figma 동기화를 하면 이 목록 뒤에 Figma 템플릿이 추가된다.
 */
export interface TemplateSeed {
  slug: string;
  part1: string;
  part2: string;
  part2SortKey: number;
  frame: FrameNode;
}

/** 구성 순서 (초안 프로젝트는 part2별로 1개씩 이 순서대로 만든다) */
export const PART2_ORDER = [
  { part1: '도입', part2: '메인 비주얼' },
  { part1: '공감', part2: '문제 제기' },
  { part1: '공감', part2: '호기심 유발' },
  { part1: '설득', part2: '핵심 포인트' },
  { part1: '설득', part2: '상품 특징' },
  { part1: '정보', part2: '상세 정보' },
  { part1: '신뢰', part2: '고객 후기' },
  { part1: '마무리', part2: '구매 안내' },
] as const;

const sortKeyOf = (part2: string) => PART2_ORDER.findIndex((p) => p.part2 === part2) + 1;

// ===== 요소 빌더 =====
const W = 860;
const DARK = 'rgba(17, 24, 39, 1)';
const GRAY = 'rgba(107, 114, 128, 1)';
const POINT = 'rgba(37, 99, 235, 1)';
const WHITE = 'rgba(255, 255, 255, 1)';

let seq = 0;
const nextId = (slug: string) => `${slug}:${++seq}`;

interface TextOptions {
  weight?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  lines?: number;
}

const text = (slug: string, value: string, x: number, y: number, width: number, fontSize: number, o: TextOptions = {}): FrameNode => {
  const lineHeight = o.lineHeight ?? 1.35;
  const lines = o.lines ?? value.split('\n').length;
  return {
    type: 'text',
    id: nextId(slug),
    name: value.split('\n')[0].slice(0, 30),
    x,
    y,
    width,
    height: Math.ceil(fontSize * lineHeight * lines),
    text: value,
    fontSize,
    fontFamily: 'Pretendard',
    fontStyle: (o.weight ?? 400) >= 600 ? 'bold' : 'normal',
    fontWeight: o.weight ?? 400,
    fill: o.color ?? DARK,
    fillPriority: 'color',
    align: o.align ?? 'center',
    verticalAlign: 'top',
    lineHeight,
    letterSpacing: 0,
    wrap: 'word',
    ellipsis: false,
    padding: 0,
    visible: true,
    opacity: 1,
  };
};

const box = (slug: string, x: number, y: number, width: number, height: number, fill: string, cornerRadius = 0, name = 'Rectangle'): FrameNode => ({
  type: 'rect',
  id: nextId(slug),
  name,
  x,
  y,
  width,
  height,
  fill,
  fillPriority: 'color',
  cornerRadius,
  visible: true,
  opacity: 1,
});

const image = (slug: string, x: number, y: number, width: number, height: number, cornerRadius = 0) =>
  box(slug, x, y, width, height, 'rgba(51, 51, 51, 1)', cornerRadius, '_image');

const prompt = (slug: string, guide: string): FrameNode => ({
  ...text(slug, guide, 30, 30, 800, 28, { color: 'rgba(255, 0, 0, 1)', align: 'left' }),
  name: 'prompt',
  visible: false,
});

const frame = (slug: string, name: string, height: number, fill: string, children: FrameNode[]): FrameNode => ({
  type: 'frame',
  id: `${slug}:root`,
  name,
  x: 0,
  y: 0,
  width: W,
  height,
  fill,
  fillPriority: 'color',
  children,
  visible: true,
  opacity: 1,
});

// ===== 기본 템플릿 =====
function mainVisualA(): TemplateSeed {
  const s = 'main-a';
  return {
    slug: s,
    ...PART2_ORDER[0],
    part2SortKey: 1,
    frame: frame(s, 'MV 1', 1500, DARK, [
      text(s, 'BRAND NAME', 0, 110, W, 26, { weight: 600, color: 'rgba(156, 163, 175, 1)' }),
      text(s, '하루를 바꾸는\n단 하나의 선택', 0, 170, W, 68, { weight: 800, color: WHITE, lineHeight: 1.25 }),
      text(s, '상품을 한 문장으로 소개하는 서브 카피를 적어주세요', 0, 370, W, 28, { color: 'rgba(209, 213, 219, 1)' }),
      image(s, 0, 470, W, 860),
      box(s, 70, 1370, 220, 64, 'rgba(255, 255, 255, 0.12)', 32),
      text(s, '핵심 효과', 70, 1388, 220, 26, { weight: 600, color: WHITE }),
      box(s, 320, 1370, 220, 64, 'rgba(255, 255, 255, 0.12)', 32),
      text(s, '프리미엄 소재', 320, 1388, 220, 26, { weight: 600, color: WHITE }),
      box(s, 570, 1370, 220, 64, 'rgba(255, 255, 255, 0.12)', 32),
      text(s, '간편한 사용', 570, 1388, 220, 26, { weight: 600, color: WHITE }),
      prompt(s, '1. 브랜드명 (영문 10자 내외)\n2. 메인 카피 (두 줄, 총 16자 내외)\n3. 서브 카피 (한 줄, 25자 내외)\n4. 메인 제품 이미지 (정면 연출컷)\n5. 하단 키워드 3개 (각 6자 이내)'),
    ]),
  };
}

function mainVisualB(): TemplateSeed {
  const s = 'main-b';
  return {
    slug: s,
    ...PART2_ORDER[0],
    part2SortKey: 1,
    frame: frame(s, 'MV 2', 1520, WHITE, [
      image(s, 0, 0, W, 1000),
      text(s, 'NEW ARRIVAL', 0, 1080, W, 26, { weight: 700, color: POINT }),
      text(s, '매일 쓰고 싶은\n당신만의 필수템', 0, 1130, W, 64, { weight: 800, lineHeight: 1.25 }),
      text(s, '상품이 해결해 주는 고민과 기대 효과를 두 줄 안으로 적어주세요.\n고객이 얻는 변화를 구체적으로 표현하면 좋아요.', 60, 1320, 740, 26, { color: GRAY, lineHeight: 1.5 }),
      prompt(s, '1. 상단 큰 이미지 (라이프스타일 연출컷)\n2. 영문 라벨 (12자 이내)\n3. 메인 카피 (두 줄, 총 16자 내외)\n4. 설명 문구 (두 줄, 각 35자 내외)'),
    ]),
  };
}

function featureA(): TemplateSeed {
  const s = 'feature-a';
  const point = (index: number, top: number): FrameNode[] => [
    text(s, `POINT 0${index}`, 0, top, W, 26, { weight: 700, color: POINT }),
    text(s, `특징 ${index}을 한 줄로 요약`, 0, top + 50, W, 44, { weight: 800 }),
    text(s, '이 특징이 고객에게 주는 이점을 두 줄 정도로 설명해주세요.\n수치나 근거가 있으면 함께 적어주세요.', 80, top + 125, 700, 26, { color: GRAY, lineHeight: 1.5 }),
    image(s, 50, top + 230, 760, 520, 24),
  ];
  return {
    slug: s,
    ...PART2_ORDER[4],
    part2SortKey: 5,
    frame: frame(s, 'FT 1', 2560, 'rgba(249, 250, 251, 1)', [
      ...point(1, 100),
      ...point(2, 920),
      ...point(3, 1740),
      prompt(s, '각 포인트마다\n1. 영문 라벨 (POINT 0N)\n2. 특징 제목 (15자 이내)\n3. 특징 설명 (두 줄, 각 30자 내외)\n4. 특징을 보여주는 디테일 이미지'),
    ]),
  };
}

function featureB(): TemplateSeed {
  const s = 'feature-b';
  const cell = (col: number, row: number, title: string): FrameNode[] => {
    const x = 60 + col * 380;
    const y = 360 + row * 540;
    return [
      image(s, x, y, 360, 360, 20),
      text(s, title, x, y + 385, 360, 32, { weight: 700 }),
      text(s, '짧은 설명을 적어주세요', x, y + 435, 360, 24, { color: GRAY }),
    ];
  };
  return {
    slug: s,
    ...PART2_ORDER[4],
    part2SortKey: 5,
    frame: frame(s, 'FT 2', 1500, WHITE, [
      text(s, 'WHY CHOOSE US', 0, 110, W, 26, { weight: 700, color: POINT }),
      text(s, '이 상품을 선택해야 하는\n4가지 이유', 0, 160, W, 52, { weight: 800, lineHeight: 1.3 }),
      ...cell(0, 0, '첫 번째 특징'),
      ...cell(1, 0, '두 번째 특징'),
      ...cell(0, 1, '세 번째 특징'),
      ...cell(1, 1, '네 번째 특징'),
      prompt(s, '1. 영문 라벨\n2. 메인 카피 (두 줄, 총 20자 내외)\n3. 2x2 특징 카드: 이미지 + 제목(8자 이내) + 설명(15자 이내)'),
    ]),
  };
}

function specInfo(): TemplateSeed {
  const s = 'spec';
  const rows = ['제품명', '구성', '사이즈', '소재/재질', '제조국', '주의사항'];
  const rowNodes = rows.flatMap((label, i) => {
    const y = 1020 + i * 90;
    return [
      box(s, 60, y + 88, 740, 2, 'rgba(229, 231, 235, 1)', 0, 'Divider'),
      text(s, label, 80, y + 28, 200, 26, { weight: 700, align: 'left' }),
      text(s, `${label} 정보를 입력하세요`, 300, y + 28, 480, 26, { color: GRAY, align: 'left' }),
    ];
  });
  return {
    slug: s,
    ...PART2_ORDER[5],
    part2SortKey: 6,
    frame: frame(s, 'IF 1', 1700, WHITE, [
      text(s, 'PRODUCT INFO', 0, 110, W, 26, { weight: 700, color: POINT }),
      text(s, '상품 상세 정보', 0, 160, W, 52, { weight: 800 }),
      image(s, 130, 280, 600, 600, 24),
      box(s, 60, 1018, 740, 2, DARK, 0, 'Divider'),
      ...rowNodes,
      prompt(s, '1. 상품 정면 이미지\n2. 상세 정보 표 (항목별 값 20자 이내)'),
    ]),
  };
}

function reviews(): TemplateSeed {
  const s = 'review';
  const card = (i: number): FrameNode[] => {
    const y = 340 + i * 330;
    return [
      box(s, 60, y, 740, 290, 'rgba(243, 244, 246, 1)', 24, 'Card'),
      text(s, '★★★★★', 100, y + 40, 300, 30, { color: 'rgba(250, 204, 21, 1)', align: 'left' }),
      text(s, '실제 구매 고객의 만족 포인트를 담은 후기 문구를 적어주세요.\n사용 전후의 변화를 구체적으로 표현하면 좋아요.', 100, y + 100, 660, 26, { align: 'left', lineHeight: 1.6 }),
      text(s, `구매 고객 ${['김**', '이**', '박**'][i]}`, 100, y + 220, 660, 22, { color: GRAY, align: 'left' }),
    ];
  };
  return {
    slug: s,
    ...PART2_ORDER[6],
    part2SortKey: 7,
    frame: frame(s, 'RV 1', 1400, WHITE, [
      text(s, 'REAL REVIEW', 0, 110, W, 26, { weight: 700, color: POINT }),
      text(s, '먼저 써본 고객들의 이야기', 0, 160, W, 52, { weight: 800 }),
      ...card(0),
      ...card(1),
      ...card(2),
      prompt(s, '1. 영문 라벨\n2. 메인 카피 (20자 내외)\n3. 후기 카드 3개: 후기 문구 (두 줄, 각 35자 내외) + 작성자'),
    ]),
  };
}

function purchaseGuide(): TemplateSeed {
  const s = 'guide';
  const notes = [
    ['배송 안내', '결제 완료 후 1~3일 이내 출고됩니다. (주말·공휴일 제외)'],
    ['교환·반품 안내', '상품 수령 후 7일 이내 고객센터로 접수해주세요.'],
    ['고객센터', '평일 10:00 - 17:00 (점심시간 12:00 - 13:00)'],
  ];
  return {
    slug: s,
    ...PART2_ORDER[7],
    part2SortKey: 8,
    frame: frame(s, 'GD 1', 1300, DARK, [
      text(s, '지금 바로 만나보세요', 0, 120, W, 56, { weight: 800, color: WHITE }),
      text(s, '구매를 망설이는 고객에게 마지막으로 전할 한 마디를 적어주세요', 0, 210, W, 26, { color: 'rgba(209, 213, 219, 1)' }),
      image(s, 230, 300, 400, 400, 200),
      ...notes.flatMap(([title, body], i) => [
        text(s, title, 80, 790 + i * 150, 700, 30, { weight: 700, color: WHITE, align: 'left' }),
        text(s, body, 80, 840 + i * 150, 700, 24, { color: 'rgba(156, 163, 175, 1)', align: 'left' }),
      ]),
      prompt(s, '1. 마무리 카피 (15자 이내)\n2. 서브 카피 (30자 내외)\n3. 원형 제품 이미지\n4. 배송·교환·고객센터 안내'),
    ]),
  };
}

/** 레버페이지 원본 템플릿 (원본 저장소 mockData) */
const LEVERPAGE_PARTS: Record<string, (typeof PART2_ORDER)[number]> = {
  'SS 2': PART2_ORDER[1],
  'CA 4': PART2_ORDER[2],
  'PS 3': PART2_ORDER[3],
};

function leverpageSeeds(): TemplateSeed[] {
  return (leverpageFrames as unknown as FrameNode[]).map((f) => {
    const part = LEVERPAGE_PARTS[f.name ?? ''] ?? PART2_ORDER[3];
    return { slug: `lp-${(f.name ?? '').replace(/\s+/g, '').toLowerCase()}`, ...part, part2SortKey: sortKeyOf(part.part2), frame: f };
  });
}

/** 기본 템플릿 구성이 바뀌면 올려서 저장소에 다시 반영한다 */
export const BUILTIN_VERSION = 2;

export function buildBuiltinTemplates(): TemplateSeed[] {
  seq = 0;
  return [mainVisualA(), mainVisualB(), ...leverpageSeeds(), featureA(), featureB(), specInfo(), reviews(), purchaseGuide()];
}
