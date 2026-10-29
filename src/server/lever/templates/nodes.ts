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
export const GRAY = 'rgba(107, 114, 128, 1)';
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

/** 글자 하나의 대략적인 폭 (Pretendard 기준, 한글은 넉넉하게) */
const charWidth = (ch: string, fontSize: number) => {
  if (ch === ' ') return fontSize * 0.28;
  if (/[\u3131-\uD79D]/.test(ch)) return fontSize * 0.98;
  if (/[A-Z0-9%#@&]/.test(ch)) return fontSize * 0.66;
  return fontSize * 0.55;
};

/** 한 줄 문구의 대략적인 폭 (배지·알약 라벨 크기 계산용) */
export const textWidth = (value: string, fontSize: number, letterSpacing = 0) =>
  [...value].reduce((sum, ch) => sum + charWidth(ch, fontSize) + letterSpacing, 0);

/** 어절 단위 줄바꿈을 흉내 내 줄 수를 추정 (레이아웃 높이 계산용) */
export function estimateLines(value: string, width: number, fontSize: number) {
  let lines = 0;
  for (const paragraph of value.split('\n')) {
    let current = 0;
    let count = 1;
    for (const word of paragraph.split(' ')) {
      const w = [...word].reduce((sum, ch) => sum + charWidth(ch, fontSize), 0);
      const space = current > 0 ? charWidth(' ', fontSize) : 0;
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
  const lines = o.lines ?? estimateLines(value, width, fontSize);
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

export interface BoxOptions {
  cornerRadius?: number;
  name?: string;
  colorVar?: PaletteRole;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export const boxNode = (id: string, x: number, y: number, width: number, height: number, fill: string, o: BoxOptions = {}): FrameNode => ({
  type: 'rect',
  id,
  name: o.name ?? 'Rectangle',
  x,
  y,
  width,
  height,
  fill,
  ...(o.colorVar ? { colorVar: o.colorVar } : {}),
  ...(o.stroke ? { stroke: o.stroke, strokeWidth: o.strokeWidth ?? 2 } : {}),
  fillPriority: 'color',
  cornerRadius: o.cornerRadius ?? 0,
  visible: true,
  opacity: o.opacity ?? 1,
});

/** 사진 자리 (`_image`) — cutId로 초안의 컷과 연결된다 */
export const imageNode = (id: string, x: number, y: number, width: number, height: number, cornerRadius = 0, cutId?: string): FrameNode => ({
  ...boxNode(id, x, y, width, height, 'rgba(51, 51, 51, 1)', { cornerRadius, name: '_image' }),
  ...(cutId ? { cutId } : {}),
});

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
