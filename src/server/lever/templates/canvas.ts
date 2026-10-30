import type { DraftCut, DraftPalette } from '@/shared/types/draft';
import type { FrameNode } from '../frames/tree';
import type { PaletteRole } from '../catalog/palette';
import type { DesignTokens, Surface } from './designStyles';
import { boxNode, GRAY, imageNode, INK, PAGE_WIDTH, textNode, textWidth, WHITE, type BoxOptions, type TextOptions } from './nodes';

/**
 * 섹션 레이아웃·패턴 템플릿이 함께 쓰는 그리기 도구
 *
 * 위에서 아래로 y를 내려가며 요소를 쌓는다. 글꼴·정렬·모서리는 디자인 스타일 토큰,
 * 색은 팔레트 역할(colorVar)을 따라 에디터 색상 탭에서 한 번에 바뀐다.
 */
export const W = PAGE_WIDTH;
export const X = 60;
export const CW = W - X * 2;
export const DIVIDER = 'rgba(229, 231, 235, 1)';
export const STAR = 'rgba(245, 180, 0, 1)';
export const SOFT_WHITE = 'rgba(255, 255, 255, 0.85)';
export const ON_DARK_CARD = 'rgba(255, 255, 255, 0.08)';
export const ON_DARK_LINE = 'rgba(255, 255, 255, 0.24)';
export const TRANSPARENT = 'rgba(255, 255, 255, 0)';

/** 860px 기준 글자 크기 (휴대폰에서 절반 가까이 줄어드는 것을 감안) */
export const SIZE = { label: 26, title: 56, heroTitle: 72, sub: 30, itemTitle: 34, body: 30, small: 28, caption: 24, fine: 22 };

export type Place = TextOptions & { x?: number; width?: number; gap?: number; heading?: boolean };

export class Canvas {
  readonly nodes: FrameNode[] = [];
  y = 110;
  /** 진한 바탕이나 사진 위: 글자·배지를 밝게 */
  dark: boolean;
  readonly palette: DraftPalette;
  readonly t: DesignTokens;
  readonly surface: Surface;
  private readonly prefix: string;
  private seq = 0;

  constructor(prefix: string, palette: DraftPalette, t: DesignTokens, surface: Surface) {
    this.prefix = prefix;
    this.palette = palette;
    this.t = t;
    this.surface = surface;
    this.dark = surface === 'main';
  }

  id() {
    return `${this.prefix}-${++this.seq}`;
  }

  get ink() {
    return this.dark ? WHITE : INK;
  }

  get muted() {
    return this.dark ? SOFT_WHITE : GRAY;
  }

  get line() {
    return this.dark ? ON_DARK_LINE : DIVIDER;
  }

  /** 강조색: 진한 바탕에서는 한 단계 밝은 포인트 색 */
  get accentRole(): PaletteRole {
    return this.dark ? 'point' : 'main';
  }

  accent() {
    return { color: this.palette[this.accentRole], colorVar: this.accentRole };
  }

  /** 정렬에 맞춘 x (가운데 정렬이면 가운데, 왼쪽 정렬이면 왼쪽 여백) */
  alignX(width: number) {
    return this.t.align === 'left' ? X : (W - width) / 2;
  }

  /** 현재 y에 문구를 놓고 y를 내린다 */
  text(value: string | undefined, fontSize: number, o: Place = {}) {
    if (!value?.trim()) return null;
    const node = this.textAt(value, o.x ?? X, this.y, o.width ?? CW, fontSize, { align: this.t.align, ...o });
    this.y += Number(node.height) + (o.gap ?? 24);
    return node;
  }

  /** 제목 글꼴·굵기·배율을 적용한 문구 */
  heading(value: string | undefined, fontSize: number, o: Place = {}) {
    return this.text(value, Math.round(fontSize * this.t.scale), { weight: this.t.headingWeight, lineHeight: 1.3, heading: true, ...o });
  }

  /** y를 움직이지 않고 원하는 위치에 문구 */
  textAt(value: string, x: number, y: number, width: number, fontSize: number, o: Place = {}) {
    const { heading, ...rest } = o;
    const node = textNode(this.id(), value, x, y, width, fontSize, {
      ...rest,
      color: rest.color ?? this.ink,
      fontFamily: rest.fontFamily ?? (heading ? this.t.font.heading : this.t.font.body),
    });
    this.nodes.push(node);
    return node;
  }

  box(x: number, y: number, width: number, height: number, fill: string, o: BoxOptions = {}) {
    const node = boxNode(this.id(), x, y, width, height, fill, o);
    this.nodes.push(node);
    return node;
  }

  /** 카드 배경처럼 내용보다 뒤에 깔려야 하는 사각형 */
  boxBehind(index: number, x: number, y: number, width: number, height: number, fill: string, o: BoxOptions = {}) {
    const node = boxNode(this.id(), x, y, width, height, fill, o);
    this.nodes.splice(index, 0, node);
    return node;
  }

  /** 팔레트 강조색 상자 (선·점·연결선) */
  accentBox(x: number, y: number, width: number, height: number, o: BoxOptions = {}) {
    return this.box(x, y, width, height, this.palette[this.accentRole], { ...o, colorVar: this.accentRole });
  }

  /** 배지: 강조색 상자 + 가운데 글자. 진한 바탕에서는 흰 상자에 대표색 글자. 글자가 길면 상자가 늘어난다 */
  badge(value: string, x: number, y: number, width: number, height: number, o: { radius?: number; size?: number; name?: string } = {}) {
    const size = o.size ?? SIZE.caption;
    const bg = this.dark
      ? this.box(x, y, width, height, WHITE, { cornerRadius: o.radius ?? height / 2, name: 'badge_bg' })
      : this.box(x, y, width, height, this.palette.main, { cornerRadius: o.radius ?? height / 2, name: 'badge_bg', colorVar: 'main' });
    const label = this.textAt(value, x + 14, y, width - 28, size, {
      weight: 800,
      align: 'center',
      name: o.name ?? 'badge',
      ...(this.dark ? { color: this.palette.main, colorVar: 'main' as const } : { color: WHITE }),
    });
    const padY = Math.max(10, (height - Number(label.height)) / 2);
    label.y = y + padY;
    bg.height = Math.max(height, Number(label.height) + padY * 2);
    return bg;
  }

  /** 카드 바탕 (index 위치에 깔아 내용보다 뒤에 둔다) */
  card(index: number, x: number, y: number, width: number, height: number, name = 'card') {
    const o: BoxOptions = { cornerRadius: this.t.radius.card, name };
    if (this.dark) return this.boxBehind(index, x, y, width, height, ON_DARK_CARD, { ...o, stroke: ON_DARK_LINE, strokeWidth: 1 });
    if (this.t.card === 'outline') return this.boxBehind(index, x, y, width, height, TRANSPARENT, { ...o, stroke: DIVIDER, strokeWidth: 2 });
    if (this.surface === 'white') return this.boxBehind(index, x, y, width, height, this.palette.bgLight, { ...o, colorVar: 'bgLight' });
    return this.boxBehind(index, x, y, width, height, WHITE, o);
  }

  /** 섹션 라벨 — 스타일에 따라 글자만 / 알약 배지 / 위에 짧은 선 */
  label(value: string | undefined, gap = 18) {
    if (!value?.trim()) return;
    if (this.t.label === 'pill') {
      const width = Math.min(CW, textWidth(value, SIZE.caption, 1) + 64);
      const bg = this.badge(value, this.alignX(width), this.y, width, 56, { radius: this.t.radius.chip, name: 'label' });
      this.y += Number(bg.height) + gap;
      return;
    }
    if (this.t.label === 'rule') {
      this.accentBox(this.alignX(48), this.y, 48, 2, { name: 'label_rule' });
      this.y += 24;
    }
    this.text(value, SIZE.label, { weight: 700, ...this.accent(), name: 'label', letterSpacing: this.t.label === 'rule' ? 4 : 2, gap });
  }

  /** 라벨 + 메인 문구 + 서브 문구 (섹션 머리말) */
  header(label: string | undefined, title: string, subtitle?: string, titleSize: number = SIZE.title) {
    this.label(label);
    const after = subtitle?.trim() ? 22 : 64;
    this.heading(title, titleSize, { name: 'main_copy', gap: this.t.titleRule ? 28 : after });
    if (this.t.titleRule) this.rule(after + 6);
    this.text(subtitle, SIZE.sub, { color: this.muted, lineHeight: 1.6, name: 'sub_copy', gap: 64 });
  }

  /** 제목 아래 짧은 강조선 */
  rule(gap: number) {
    this.accentBox(this.alignX(64), this.y, 64, 3, { name: 'title_rule' });
    this.y += 3 + gap;
  }

  /** 사진 자리 — 화면 끝까지 꽉 찬 사진은 모서리 없이, 나머지는 스타일 모서리 */
  image(cut: DraftCut | undefined, x: number, width: number, height: number, gap = 60, radius?: number) {
    if (!cut) return false;
    const r = radius ?? (x === 0 && width === W ? 0 : this.t.radius.image);
    this.nodes.push(imageNode(this.id(), x, this.y, width, height, r, cut.id));
    this.y += height + gap;
    return true;
  }

  /** 초안 컷과 연결하지 않는 사진 자리 (템플릿용) — y는 움직이지 않는다 */
  slot(x: number, y: number, width: number, height: number, radius?: number) {
    const r = radius ?? (x === 0 && width === W ? 0 : this.t.radius.image);
    const node = imageNode(this.id(), x, y, width, height, r);
    this.nodes.push(node);
    return node;
  }

  /** start 이후에 만든 요소를 아래로 dy만큼 옮긴다 */
  shift(start: number, dy: number) {
    for (const node of this.nodes.slice(start)) node.y = Number(node.y) + dy;
  }

  space(px: number) {
    this.y += px;
  }
}
