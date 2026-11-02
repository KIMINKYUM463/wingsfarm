import type { FrameNode } from '../frames/tree';
import type { PaletteRole } from '../catalog/palette';

/**
 * 템플릿·섹션 레이아웃이 함께 쓰는 Konva 노드 빌더
 *
 * colorVar: 팔레트 역할(main/point/bgLight/bgDark)과 연결된 요소.
 * 에디터 "색상" 탭에서 팔레트를 바꾸면 colorVar가 있는 요소의 fill만 다시 칠한다.
 */
export const PAGE_WIDTH = 860;
export const INK = 'rgba(17, 24, 39, 1)';
/** 본문 보조 글자색 — 옅은 색 바탕에서도 명도 대비 4.5:1 이상 (휴대폰에서 절반으로 줄어도 읽히게) */
export const GRAY = 'rgba(75, 85, 99, 1)';
export const WHITE = 'rgba(255, 255, 255, 1)';

export interface TextOptions {
  weight?: number;
  color?: string;
  colorVar?: PaletteRole;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  /** 줄 수를 직접 지정 (지정하지 않으면 글자 폭으로 추정) */
  lines?: number;
  name?: string;
  letterSpacing?: number;
  fontFamily?: string;
}

/**
 * 한글 한 글자 폭 (글자 크기 대비) — 브라우저에서 실제 글꼴로 잰 값 + 2% 여유
 * 넉넉하게 잡으면 한 줄 문구를 두 줄로 계산해 제목 아래가 크게 빈다
 */
const HANGUL_WIDTH: Record<string, number> = { Pretendard: 0.88, 'Nanum Myeongjo': 0.94, 'Noto Serif KR': 0.98 };
const DEFAULT_HANGUL_WIDTH = 0.98;

/** 글자 하나의 대략적인 폭 (레이아웃 높이 계산과 SVG 썸네일 줄바꿈이 같은 값을 써야 줄 수가 맞는다) */
export const charWidth = (ch: string, fontSize: number, fontFamily = 'Pretendard') => {
  if (ch === ' ') return fontSize * 0.28;
  if (/[\u3131-\uD79D]/.test(ch)) return fontSize * (HANGUL_WIDTH[fontFamily] ?? DEFAULT_HANGUL_WIDTH);
  if (/[A-Z0-9%#@&]/.test(ch)) return fontSize * 0.66;
  return fontSize * 0.55;
};

/** 한 줄 문구의 대략적인 폭 (배지·알약 라벨 크기 계산용) */
export const textWidth = (value: string, fontSize: number, letterSpacing = 0, fontFamily?: string) =>
  [...value].reduce((sum, ch) => sum + charWidth(ch, fontSize, fontFamily) + letterSpacing, 0);

/** 어절 단위 줄바꿈을 흉내 내 줄 수를 추정 (레이아웃 높이 계산용) */
export function estimateLines(value: string, width: number, fontSize: number, fontFamily?: string) {
  let lines = 0;
  for (const paragraph of value.split('\n')) {
    let current = 0;
    let count = 1;
    for (const word of paragraph.split(' ')) {
      const w = [...word].reduce((sum, ch) => sum + charWidth(ch, fontSize, fontFamily), 0);
      const space = current > 0 ? charWidth(' ', fontSize, fontFamily) : 0;
      if (current > 0 && current + space + w > width) {
        count += 1 + Math.floor(w / width);
        current = w % width;
      } else {
        current += space + w;
        if (current > width) {
          count += Math.floor(current / width);
          current %= width;
        }
      }
    }
    lines += count;
  }
  return Math.max(1, lines);
}

export function textNode(id: string, value: string, x: number, y: number, width: number, fontSize: number, o: TextOptions = {}): FrameNode {
  const lineHeight = o.lineHeight ?? 1.35;
  const lines = o.lines ?? estimateLines(value, width, fontSize, o.fontFamily);
  return {
    type: 'text',
    id,
    name: o.name ?? value.split('\n')[0].slice(0, 30),
    x,
    y,
    width,
    height: Math.ceil(fontSize * lineHeight * lines),
    text: value,
    fontSize,
    fontFamily: o.fontFamily ?? 'Pretendard',
    fontStyle: (o.weight ?? 400) >= 600 ? 'bold' : 'normal',
    fontWeight: o.weight ?? 400,
    fill: o.color ?? INK,
    ...(o.colorVar ? { colorVar: o.colorVar } : {}),
    fillPriority: 'color',
    align: o.align ?? 'center',
    verticalAlign: 'top',
    lineHeight,
    letterSpacing: o.letterSpacing ?? 0,
    wrap: 'word',
    ellipsis: false,
    padding: 0,
    visible: true,
    opacity: 1,
  };
}

export interface Shadow {
  color: string;
  /** 팔레트 역할과 연결된 그림자 색 (색상 탭에서 함께 바뀐다) */
  colorVar?: PaletteRole;
  blur: number;
  x: number;
  y: number;
  opacity: number;
}

/** 세로 그라데이션 (위 → 아래). stops = [위치 0~1, 색, 위치, 색, …] */
export interface VerticalGradient {
  stops: (number | string)[];
}

export interface BoxOptions {
  /** 숫자 하나 또는 [왼쪽 위, 오른쪽 위, 오른쪽 아래, 왼쪽 아래] */
  cornerRadius?: number | number[];
  name?: string;
  colorVar?: PaletteRole;
  stroke?: string;
  strokeVar?: PaletteRole;
  strokeWidth?: number;
  opacity?: number;
  shadow?: Shadow;
  gradient?: VerticalGradient;
}

/** 사각형·경로 노드가 함께 쓰는 칠·선·그림자 속성 */
function paintProps(fill: string, height: number, o: BoxOptions): Partial<FrameNode> {
  return {
    fill,
    ...(o.colorVar && { colorVar: o.colorVar }),
    ...(o.stroke && { stroke: o.stroke, strokeWidth: o.strokeWidth ?? 2, ...(o.strokeVar && { strokeVar: o.strokeVar }) }),
    ...(o.gradient
      ? {
          fillPriority: 'linear-gradient',
          fillLinearGradientStartPoint: { x: 0, y: 0 },
          fillLinearGradientEndPoint: { x: 0, y: height },
          fillLinearGradientColorStops: o.gradient.stops,
        }
      : { fillPriority: 'color' }),
    ...(o.shadow && {
      shadowEnabled: true,
      shadowColor: o.shadow.color,
      shadowBlur: o.shadow.blur,
      shadowOffsetX: o.shadow.x,
      shadowOffsetY: o.shadow.y,
      shadowOpacity: o.shadow.opacity,
      ...(o.shadow.colorVar && { shadowVar: o.shadow.colorVar }),
    }),
    visible: true,
    opacity: o.opacity ?? 1,
  };
}

export const boxNode = (id: string, x: number, y: number, width: number, height: number, fill: string, o: BoxOptions = {}): FrameNode => ({
  type: 'rect',
  id,
  name: o.name ?? 'Rectangle',
  x,
  y,
  width,
  height,
  cornerRadius: o.cornerRadius ?? 0,
  ...paintProps(fill, height, o),
});

/**
 * 경로 도형 (말풍선·쿠폰·스티커·물결 등). data는 왼쪽 위 0,0 기준 좌표이고,
 * width·height는 그 경로가 차지하는 상자 크기 (선택·겹침 계산·썸네일용)
 */
export const pathNode = (id: string, data: string, x: number, y: number, width: number, height: number, fill: string, o: BoxOptions = {}): FrameNode => ({
  type: 'path',
  id,
  name: o.name ?? 'Shape',
  x,
  y,
  width,
  height,
  data,
  ...paintProps(fill, height, o),
});

/** 사진 자리 (`_image`) — cutId로 초안의 컷과 연결된다 */
export const imageNode = (id: string, x: number, y: number, width: number, height: number, cornerRadius: number | number[] = 0, cutId?: string): FrameNode => ({
  ...boxNode(id, x, y, width, height, 'rgba(51, 51, 51, 1)', { cornerRadius, name: '_image' }),
  ...(cutId ? { cutId } : {}),
});

/** 숨김 prompt 노드(AI 문구 채우기 가이드)를 프레임 맨 뒤에 붙인다 */
export function withGuide(frame: FrameNode, slug: string, guide: string): FrameNode {
  const prompt: FrameNode = {
    ...textNode(`${slug}-prompt`, guide, 30, 30, 800, 28, { color: 'rgba(255, 0, 0, 1)', align: 'left', lines: guide.split('\n').length }),
    name: 'prompt',
    visible: false,
  };
  return { ...frame, children: [...(frame.children ?? []), prompt] };
}

export const frameNode = (id: string, name: string, height: number, fill: string, children: FrameNode[], colorVar?: PaletteRole): FrameNode => ({
  type: 'frame',
  id,
  name,
  x: 0,
  y: 0,
  width: PAGE_WIDTH,
  height,
  fill,
  ...(colorVar ? { colorVar } : {}),
  fillPriority: 'color',
  children,
  visible: true,
  opacity: 1,
});
