import type { FrameNode } from '../../frames/tree';
import type { PaletteRole } from '../../catalog/palette';
import { Canvas, CW, ON_DARK_CARD, SIZE, STAR, X } from '../canvas';
import { WHITE } from '../nodes';

/**
 * 패턴 템플릿 공용 도구
 *
 * 패턴 = 구성(part2) 하나에 쓰는 배치 한 가지. 같은 패턴을 디자인 스킨 2종으로 그려 템플릿 2개가 된다.
 * 문구 칸 이름은 섹션 레이아웃과 같은 규칙(label / main_copy / sub_copy / list_title / list_item / badge)을 따르고,
 * 수치·인증·후기·가격처럼 사실이어야 하는 자리는 [ ]로 남겨 판매자가 직접 채우게 한다.
 */
export type Part2 = '메인 비주얼' | '문제 제기' | '호기심 유발' | '핵심 포인트' | '상품 특징' | '상세 정보' | '고객 후기' | '구매 안내';

export interface Pattern {
  key: string;
  name: string;
  /** 숨김 prompt 노드 — AI 문구 채우기 가이드 */
  guide: string;
  /** 섹션을 그리고 아래 여백(px)을 돌려준다 (없으면 110) */
  draw: (c: Canvas) => number | void;
}

export interface PatternGroup {
  key: string;
  part2: Part2;
  patterns: Pattern[];
}

export const bottomOf = (node: FrameNode | null) => (node ? Number(node.y) + Number(node.height) : 0);

/** 폭을 n칸으로 고르게 나눈다 */
export function columns(n: number, gap = 20, x = X, width = CW) {
  const w = Math.floor((width - gap * (n - 1)) / n);
  return Array.from({ length: n }, (_, i) => ({ x: x + i * (w + gap), w }));
}

interface RowOptions {
  gap?: number;
  pad?: number;
  x?: number;
  width?: number;
  /** 줄 아래 여백 */
  after?: number;
  /** 카드 바탕 없이 칸만 나눈다 */
  bare?: boolean;
}

/**
 * 한 줄에 카드 n개: draw(i, 안쪽 x, 안쪽 폭, 안쪽 시작 y)가 내용 끝 y를 돌려주면
 * 가장 높은 카드에 맞춰 바탕을 깔고 y를 줄 아래로 옮긴다.
 */
export function cardRow(c: Canvas, n: number, draw: (i: number, x: number, w: number, top: number) => number, o: RowOptions = {}) {
  const pad = o.bare ? 0 : (o.pad ?? 32);
  const top = c.y;
  const cells = columns(n, o.gap ?? 20, o.x, o.width);
  const starts: number[] = [];
  let bottom = top;
  cells.forEach(({ x, w }, i) => {
    starts.push(c.nodes.length);
    bottom = Math.max(bottom, draw(i, x + pad, w - pad * 2, top + pad));
  });
  const h = bottom - top + pad;
  // 뒤에서부터 끼워 넣어야 앞 카드의 위치(starts)가 밀리지 않는다
  if (!o.bare) for (let i = n - 1; i >= 0; i--) c.card(starts[i], cells[i].x, top, cells[i].w, h);
  c.y = top + h + (o.after ?? 40);
  return h;
}

/** 강조색 면 위 글자색 */
export const onAccent = (c: Canvas): { color: string; colorVar?: PaletteRole } =>
  c.dark ? { color: c.palette.main, colorVar: 'main' } : { color: WHITE };

/** 강조색 면 (진한 바탕에서는 흰 면) — 내용보다 뒤(start)에 깐다 */
export function accentFill(c: Canvas, start: number, x: number, y: number, w: number, h: number, radius = c.t.radius.card) {
  return c.dark
    ? c.boxBehind(start, x, y, w, h, WHITE, { cornerRadius: radius, name: 'accent_bg' })
    : c.boxBehind(start, x, y, w, h, c.palette.main, { cornerRadius: radius, name: 'accent_bg', colorVar: 'main' });
}

/** 연한 면 (표 줄무늬·빈 칸) */
export function softFill(c: Canvas, start: number, x: number, y: number, w: number, h: number, radius = 0) {
  if (c.dark) return c.boxBehind(start, x, y, w, h, ON_DARK_CARD, { cornerRadius: radius, name: 'soft_bg' });
  if (c.surface === 'white') return c.boxBehind(start, x, y, w, h, c.palette.bgLight, { cornerRadius: radius, name: 'soft_bg', colorVar: 'bgLight' });
  return c.boxBehind(start, x, y, w, h, WHITE, { cornerRadius: radius, name: 'soft_bg' });
}

/** 섹션 바탕과 같은 색 (쿠폰 홈처럼 바탕을 파낸 듯 보이게) */
export function surfaceColor(c: Canvas): { fill: string; colorVar?: PaletteRole } {
  return c.surface === 'white' ? { fill: WHITE } : { fill: c.palette[c.surface], colorVar: c.surface };
}

/** 테두리만 있는 칸 */
export const outline = (c: Canvas, x: number, y: number, w: number, h: number, radius = c.t.radius.chip, accent = false) =>
  c.box(x, y, w, h, 'rgba(255, 255, 255, 0)', {
    cornerRadius: radius,
    stroke: accent ? c.palette[c.accentRole] : c.line,
    strokeWidth: 2,
    name: 'outline',
  });

/** 동그란 번호·아이콘 (각진 스타일은 네모) */
export const disc = (c: Canvas, value: string, x: number, y: number, d: number, size = Math.round(d * 0.4)) =>
  c.badge(value, x, y, d, d, { radius: c.t.radius.chip ? d / 2 : 0, size });

export const stars = (c: Canvas, x: number, y: number, width = 300, align: 'left' | 'center' = 'left', size = 26) =>
  c.textAt('★★★★★', x, y, width, size, { color: STAR, align, name: 'badge' });

/** 버튼 모양 (현재 y, 스타일 정렬) */
export function button(c: Canvas, value: string, width = 560, height = 104) {
  const bg = c.badge(value, c.alignX(width), c.y, width, height, { radius: Math.min(c.t.radius.chip, height / 2), size: 32 });
  c.space(Number(bg.height));
}

/** 알약 배지 한 줄 */
export function chips(c: Canvas, values: string[], o: { width?: number; height?: number; gap?: number } = {}) {
  const w = o.width ?? 230;
  const h = o.height ?? 68;
  const gap = o.gap ?? 20;
  const start = c.alignX(values.length * w + (values.length - 1) * gap);
  const boxes = values.map((v, i) => c.badge(v, start + i * (w + gap), c.y, w, h, { radius: c.t.radius.chip, size: SIZE.caption }));
  const rowH = Math.max(...boxes.map((b) => Number(b.height)));
  for (const b of boxes) b.height = rowH;
  c.space(rowH);
}

/** 사진 위 글자: 사진과 어둡게 깐 막을 그리고, draw 안에서는 글자를 밝게 쓴다 */
export function overlay(c: Canvas, x: number, y: number, w: number, h: number, draw: () => void, dim = 0.42) {
  const photo = c.slot(x, y, w, h);
  c.box(x, y, w, h, 'rgba(0, 0, 0, 1)', { opacity: dim, name: 'image_dim', cornerRadius: Number(photo.cornerRadius) });
  const wasDark = c.dark;
  c.dark = true;
  draw();
  c.dark = wasDark;
}

/** 아래 구분선 */
export function divider(c: Canvas, gap = 0, x = X, width = CW) {
  c.box(x, c.y, width, 1, c.line, { name: 'divider' });
  c.space(1 + gap);
}

/** 항목 제목 + 설명 (현재 y, 지정한 칸) */
export function titled(c: Canvas, title: string, text: string, o: { x?: number; width?: number; align?: 'left' | 'center'; titleSize?: number; gap?: number } = {}) {
  const place = { x: o.x ?? X, width: o.width ?? CW, ...(o.align && { align: o.align }) };
  c.text(title, o.titleSize ?? SIZE.itemTitle, { ...place, weight: 700, name: 'list_title', gap: 12 });
  c.text(text, SIZE.small, { ...place, color: c.muted, lineHeight: 1.6, name: 'list_item', gap: o.gap ?? 40 });
}

/** 고정 위치에 항목 제목 + 설명 → 끝 y */
export function titledAt(c: Canvas, title: string, text: string, x: number, y: number, w: number, o: { align?: 'left' | 'center'; titleSize?: number; textSize?: number } = {}) {
  const align = o.align ?? 'left';
  const t = c.textAt(title, x, y, w, o.titleSize ?? 30, { weight: 700, align, name: 'list_title' });
  const b = c.textAt(text, x, bottomOf(t) + 10, w, o.textSize ?? SIZE.caption, { color: c.muted, align, lineHeight: 1.55, name: 'list_item' });
  return bottomOf(b);
}
