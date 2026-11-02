import { roundedRectPath } from '@/shared/lib/shapePaths';
import { escapeXml } from '../catalog/svg';
import { charWidth as estimateCharWidth } from '../templates/nodes';
import type { FrameNode } from './tree';

/**
 * Konva 프레임 JSON → SVG (템플릿 썸네일·미리보기용)
 *
 * 서버에는 캔버스가 없어서 Konva로 그릴 수 없으므로 주요 도형만 SVG로 근사 렌더링한다.
 * 이미지 자리는 회색 박스, 텍스트는 글자 폭을 추정해 줄바꿈한다.
 */
const PLACEHOLDER = '#EAEAEA';
const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

let gradientSeq = 0;

/** 그라데이션 fill → <defs> 문자열과 url(#id) */
function paint(node: FrameNode): { fill: string; defs: string } {
  const stopsOf = (stops: unknown) => {
    const list = Array.isArray(stops) ? stops : [];
    let out = '';
    for (let i = 0; i + 1 < list.length; i += 2) out += `<stop offset="${list[i]}" stop-color="${list[i + 1]}"/>`;
    return out;
  };
  const point = (p: unknown) => (p ?? { x: 0, y: 0 }) as { x: number; y: number };

  if (node.fillPriority === 'linear-gradient' && node.fillLinearGradientColorStops) {
    const id = `g${++gradientSeq}`;
    const [s, e] = [point(node.fillLinearGradientStartPoint), point(node.fillLinearGradientEndPoint)];
    return {
      fill: `url(#${id})`,
      defs: `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${s.x}" y1="${s.y}" x2="${e.x}" y2="${e.y}">${stopsOf(node.fillLinearGradientColorStops)}</linearGradient>`,
    };
  }
  if (node.fillPriority === 'radial-gradient' && node.fillRadialGradientColorStops) {
    const id = `g${++gradientSeq}`;
    const c = point(node.fillRadialGradientEndPoint);
    return {
      fill: `url(#${id})`,
      defs: `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${c.x}" cy="${c.y}" r="${num(node.fillRadialGradientEndRadius, 1)}">${stopsOf(node.fillRadialGradientColorStops)}</radialGradient>`,
    };
  }
  return { fill: typeof node.fill === 'string' ? node.fill : 'none', defs: '' };
}

const transformOf = (node: FrameNode) => {
  const parts = [`translate(${num(node.x)} ${num(node.y)})`];
  if (num(node.rotation)) parts.push(`rotate(${num(node.rotation)})`);
  if (num(node.offsetX) || num(node.offsetY)) parts.push(`translate(${-num(node.offsetX)} ${-num(node.offsetY)})`);
  return parts.join(' ');
};

const strokeAttrs = (node: FrameNode) =>
  typeof node.stroke === 'string' && num(node.strokeWidth) > 0
    ? ` stroke="${node.stroke}" stroke-width="${num(node.strokeWidth)}"`
    : '';

/** Konva 그림자 → SVG feDropShadow (Konva blur는 대략 표준편차의 2배) */
function shadowOf(node: FrameNode): { attr: string; defs: string } {
  if (!node.shadowEnabled || typeof node.shadowColor !== 'string') return { attr: '', defs: '' };
  const id = `s${++gradientSeq}`;
  const defs =
    `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feDropShadow dx="${num(node.shadowOffsetX)}" dy="${num(node.shadowOffsetY)}" stdDeviation="${num(node.shadowBlur) / 2}" ` +
    `flood-color="${node.shadowColor}" flood-opacity="${num(node.shadowOpacity, 1)}"/></filter>`;
  return { attr: ` filter="url(#${id})"`, defs };
}

/** 글자 폭 추정으로 줄바꿈 — 템플릿 레이아웃이 높이를 잡을 때와 같은 글꼴별 폭을 써서 줄 수를 맞춘다 */
function wrapLines(text: string, width: number, fontSize: number, letterSpacing: number, wrap: unknown, fontFamily: string) {
  const charWidth = (ch: string) => estimateCharWidth(ch, fontSize, fontFamily) + letterSpacing;
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (wrap === 'none' || width <= 0) {
      lines.push(paragraph);
      continue;
    }
    // 'word'(어절 단위)는 띄어쓰기에서 줄을 바꾸고, 한 어절이 한 줄보다 길 때만 글자 단위로 자른다
    const tokens = wrap === 'word' ? paragraph.split(/(?<= )/) : [...paragraph];
    let line = '';
    let lineWidth = 0;
    const measure = (s: string) => [...s].reduce((sum, ch) => sum + charWidth(ch), 0);
    for (const token of tokens) {
      const w = measure(token);
      const fitsWithoutTrailingSpace = lineWidth + measure(token.trimEnd()) <= width;
      if (line && !fitsWithoutTrailingSpace) {
        lines.push(line.trimEnd());
        line = '';
        lineWidth = 0;
      }
      if (w > width) {
        for (const ch of token) {
          const cw = charWidth(ch);
          if (lineWidth + cw > width && line) {
            lines.push(line);
            line = '';
            lineWidth = 0;
          }
          line += ch;
          lineWidth += cw;
        }
        continue;
      }
      line += token;
      lineWidth += w;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

/** 썸네일은 <img>로 보여서 웹폰트를 못 불러온다 → 명조·세리프는 시스템 명조로 대신 */
function fontStack(family: unknown) {
  const name = typeof family === 'string' && family.trim() ? family.replace(/['"<>&]/g, '') : 'Pretendard';
  const serif = /serif|myeongjo|명조/i.test(name) && !/sans/i.test(name);
  return serif
    ? `'${name}', 'Nanum Myeongjo', 'Batang', 'AppleMyungjo', serif`
    : `'${name}', Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`;
}

function renderText(node: FrameNode) {
  const fontSize = num(node.fontSize, 16);
  const lineHeight = fontSize * num(node.lineHeight, 1.2);
  const width = num(node.width);
  const family = typeof node.fontFamily === 'string' ? node.fontFamily : 'Pretendard';
  const lines = wrapLines(String(node.text ?? ''), width, fontSize, num(node.letterSpacing), node.wrap, family);
  const align = node.align === 'center' ? 'middle' : node.align === 'right' ? 'end' : 'start';
  const x = align === 'middle' ? width / 2 : align === 'end' ? width : 0;
  const weight = num(node.fontWeight, String(node.fontStyle ?? '').includes('bold') ? 700 : 400);
  const { fill, defs } = paint(node);
  const tspans = lines
    .map((line, i) => `<tspan x="${x}" y="${(i + 0.8) * lineHeight}">${escapeXml(line) || ' '}</tspan>`)
    .join('');
  return `${defs}<text transform="${transformOf(node)}" font-family="${fontStack(node.fontFamily)}" font-size="${fontSize}" font-weight="${weight}" text-anchor="${align}" fill="${fill === 'none' ? '#000' : fill}">${tspans}</text>`;
}

function renderNode(node: FrameNode): string {
  if (node.visible === false) return '';
  const opacity = node.opacity !== undefined && num(node.opacity, 1) < 1 ? ` opacity="${num(node.opacity, 1)}"` : '';
  const width = num(node.width);
  const height = num(node.height);
  const isImage = Boolean(node.assetId || node.figmaImageRef) || (node.name ?? '').includes('_image');

  switch (node.type) {
    case 'frame':
    case 'group': {
      const children = (node.children ?? []).map(renderNode).join('');
      const { fill, defs } = paint(node);
      const background = node.type === 'frame' && fill !== 'none' ? `<rect width="${width}" height="${height}" fill="${fill}"/>` : '';
      const clipId = node.clipWidth ? `c${++gradientSeq}` : '';
      const clip = clipId
        ? `<clipPath id="${clipId}"><rect width="${num(node.clipWidth)}" height="${num(node.clipHeight)}"/></clipPath>`
        : '';
      return `${defs}${clip}<g transform="${transformOf(node)}"${opacity}${clipId ? ` clip-path="url(#${clipId})"` : ''}>${background}${children}</g>`;
    }
    case 'rect': {
      const { fill, defs } = isImage ? { fill: PLACEHOLDER, defs: '' } : paint(node);
      const shadow = shadowOf(node);
      const attrs = `transform="${transformOf(node)}" fill="${fill}"${strokeAttrs(node)}${opacity}${shadow.attr}`;
      // 모서리마다 반지름이 다르면(잎·아치 모양) 경로로 그린다
      if (Array.isArray(node.cornerRadius)) {
        return `${defs}${shadow.defs}<path ${attrs} d="${roundedRectPath(width, height, node.cornerRadius as number[])}"/>`;
      }
      return `${defs}${shadow.defs}<rect ${attrs} width="${width}" height="${height}" rx="${num(node.cornerRadius)}"/>`;
    }
    case 'path': {
      const { fill, defs } = isImage ? { fill: PLACEHOLDER, defs: '' } : paint(node);
      const shadow = shadowOf(node);
      return `${defs}${shadow.defs}<path transform="${transformOf(node)}" d="${escapeXml(String(node.data ?? ''))}" fill="${fill}" fill-rule="${node.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'}"${strokeAttrs(node)}${opacity}${shadow.attr}/>`;
    }
    case 'circle':
      return `<circle transform="${transformOf(node)}" r="${num(node.radius)}" fill="${paint(node).fill}"${strokeAttrs(node)}${opacity}/>`;
    case 'ellipse':
      return `<ellipse transform="${transformOf(node)}" rx="${num(node.radiusX)}" ry="${num(node.radiusY)}" fill="${paint(node).fill}"${strokeAttrs(node)}${opacity}/>`;
    case 'text':
      return opacity ? `<g${opacity}>${renderText(node)}</g>` : renderText(node);
    default:
      return '';
  }
}

export function renderFrameSvg(frame: FrameNode) {
  gradientSeq = 0;
  const width = num(frame.width, 860);
  const height = num(frame.height, 1000);
  const body = renderNode({ ...frame, x: 0, y: 0, rotation: 0, offsetX: 0, offsetY: 0 });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#fff"/>${body}</svg>`;
}
