import type { DraftCut, DraftPalette } from '@/shared/types/draft';
import { blobPath, bubblePath, burstPath, clippedCirclePath, diamondPath, sparklePath, type Tail } from '@/shared/lib/shapePaths';
import type { FrameNode } from '../frames/tree';
import type { PaletteRole } from '../catalog/palette';
import type { DesignTokens, Surface } from './designStyles';
import { boxNode, estimateLines, GRAY, imageNode, INK, PAGE_WIDTH, pathNode, textNode, textWidth, WHITE, type BoxOptions, type Shadow, type TextOptions } from './nodes';

/**
 * 섹션 레이아웃·패턴 템플릿이 함께 쓰는 그리기 도구
 *
 * 위에서 아래로 y를 내려가며 요소를 쌓는다. 글꼴·정렬·모서리·도형 언어(그림자·사진 모양·장식)는
 * 디자인 스타일 토큰, 색은 팔레트 역할(colorVar)을 따라 에디터 색상 탭에서 한 번에 바뀐다.
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

/** 860px 기준 글자 크기 — 360px 휴대폰에서 약 42%로 줄어도 본문이 13px 이상 남게 (본문 32·보조 30·주석 26) */
export const SIZE = { label: 26, title: 56, heroTitle: 72, sub: 32, itemTitle: 36, body: 32, small: 30, caption: 26, fine: 22 };

/** 사진 위 글자가 읽히도록 아래로 갈수록 짙어지는 막 */
const SCRIM_STOPS = [0, 'rgba(0, 0, 0, 0.12)', 0.35, 'rgba(0, 0, 0, 0.42)', 1, 'rgba(0, 0, 0, 0.74)'];
/** 액자·어긋난 면을 붙일 만큼 큰 사진의 최소 폭 (작은 사진에 붙이면 산만하다) */
const FRAMED_PHOTO_MIN_WIDTH = 500;

export type Place = TextOptions & { x?: number; width?: number; gap?: number; heading?: boolean };
export type { Tail };

/** 칠할 색 + 연결된 팔레트 역할 */
export interface Paint {
  fill: string;
  colorVar?: PaletteRole;
}

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
  private ornamented = false;

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

  /** 강조 면 (진한 바탕에서는 흰 면) */
  get accentPaint(): Paint {
    return this.dark ? { fill: WHITE } : { fill: this.palette.main, colorVar: 'main' };
  }

  /** 강조 면 위 글자색 */
  get onAccent(): { color: string; colorVar?: PaletteRole } {
    return this.dark ? { color: this.palette.main, colorVar: 'main' } : { color: WHITE };
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

  /** index가 있으면 그 자리에 끼워 넣어 앞서 그린 내용보다 뒤에 깔린다 */
  private insert(node: FrameNode, index?: number) {
    if (index === undefined) this.nodes.push(node);
    else this.nodes.splice(index, 0, node);
    return node;
  }

  box(x: number, y: number, width: number, height: number, fill: string, o: BoxOptions = {}) {
    return this.insert(boxNode(this.id(), x, y, width, height, fill, o));
  }

  /** 카드 배경처럼 내용보다 뒤에 깔려야 하는 사각형 */
  boxBehind(index: number, x: number, y: number, width: number, height: number, fill: string, o: BoxOptions = {}) {
    return this.insert(boxNode(this.id(), x, y, width, height, fill, o), index);
  }

  /** 경로 도형 (index가 있으면 내용 뒤에) */
  path(data: string, x: number, y: number, width: number, height: number, fill: string, o: BoxOptions = {}, index?: number) {
    return this.insert(pathNode(this.id(), data, x, y, width, height, fill, o), index);
  }

  /**
   * 내용 뒤에 까는 면 — 꼬리가 있으면 말풍선 경로, 없으면 사각형.
   * 꼬리는 몸통(y~y+height) 바깥으로 tail.size만큼 나온다.
   */
  surfaceBehind(index: number, x: number, y: number, width: number, height: number, paint: Paint, o: BoxOptions = {}, tail?: Tail) {
    const options = { ...o, ...(paint.colorVar && { colorVar: paint.colorVar }) };
    if (!tail) return this.boxBehind(index, x, y, width, height, paint.fill, options);
    const radius = Array.isArray(o.cornerRadius) ? (o.cornerRadius[0] ?? 0) : (o.cornerRadius ?? 0);
    const top = tail.side === 'top' ? y - tail.size : y;
    return this.path(bubblePath(width, height, radius, tail), x, top, width, height + tail.size, paint.fill, options, index);
  }

  /** 팔레트 강조색 상자 (선·점·연결선) */
  accentBox(x: number, y: number, width: number, height: number, o: BoxOptions = {}) {
    return this.box(x, y, width, height, this.palette[this.accentRole], { ...o, colorVar: this.accentRole });
  }

  /**
   * 그림자 — 부드럽게 뜬 카드(soft) / 어긋나게 찍힌 스티커(hard)
   * 진한 바탕의 반투명 카드는 그림자가 비쳐 보여 그리지 않는다
   */
  shadow(kind: 'card' | 'badge'): Shadow | undefined {
    const style = this.t.shape.shadow;
    if (style === 'soft' && kind === 'card' && !this.dark) return { color: INK, blur: 40, x: 0, y: 14, opacity: 0.09 };
    if (style !== 'hard' || (kind === 'card' && this.dark)) return undefined;
    const d = kind === 'card' ? 8 : 5;
    if (this.dark) return { color: 'rgba(0, 0, 0, 1)', blur: 0, x: d, y: d, opacity: 0.3 };
    return kind === 'card'
      ? { color: this.palette.main, colorVar: 'main', blur: 0, x: d, y: d, opacity: 1 }
      : { color: INK, blur: 0, x: d, y: d, opacity: 0.85 };
  }

  /** 배지: 강조색 상자 + 가운데 글자. 진한 바탕에서는 흰 상자에 대표색 글자. 글자가 길면 상자가 늘어난다 */
  badge(value: string, x: number, y: number, width: number, height: number, o: { radius?: number; size?: number; name?: string } = {}) {
    const size = o.size ?? SIZE.caption;
    const paint = this.accentPaint;
    const bg = this.box(x, y, width, height, paint.fill, {
      cornerRadius: o.radius ?? height / 2,
      name: 'badge_bg',
      colorVar: paint.colorVar,
      shadow: this.shadow('badge'),
    });
    const label = this.textAt(value, x + 14, y, width - 28, size, { weight: 800, align: 'center', name: o.name ?? 'badge', ...this.onAccent });
    const padY = Math.max(10, (height - Number(label.height)) / 2);
    label.y = y + padY;
    bg.height = Math.max(height, Number(label.height) + padY * 2);
    return bg;
  }

  /** 큰 원형 배지(인증·스탬프) — 스타일에 따라 안쪽 테두리를 두른 원 / 톱니 스티커 */
  stamp(value: string, x: number, y: number, size: number, fontSize = Math.round(size * 0.2)) {
    const paint = this.accentPaint;
    const base: BoxOptions = { colorVar: paint.colorVar, shadow: this.shadow('badge'), name: 'badge_bg' };
    if (this.t.shape.stamp === 'burst') {
      this.path(burstPath(size), x, y, size, size, paint.fill, base);
    } else {
      const round = this.t.radius.chip > 0;
      const inset = Math.max(6, Math.round(size * 0.06));
      const ring = this.onAccent;
      this.box(x, y, size, size, paint.fill, { ...base, cornerRadius: round ? size / 2 : 0 });
      this.box(x + inset, y + inset, size - inset * 2, size - inset * 2, TRANSPARENT, {
        cornerRadius: round ? size / 2 - inset : 0,
        stroke: ring.color,
        strokeVar: ring.colorVar,
        strokeWidth: 2,
        opacity: 0.6,
        name: 'badge_ring',
      });
    }
    const label = this.textAt(value, x + size * 0.15, y, size * 0.7, fontSize, { weight: 800, align: 'center', name: 'badge', ...this.onAccent });
    label.y = y + (size - Number(label.height)) / 2;
  }

  /** 카드 모서리 — 유기적인 스타일은 대각선 두 모서리만 크게 (잎 모양) */
  private get cardRadius(): number | number[] {
    const r = this.t.radius.card;
    if (this.t.shape.photo !== 'organic' || !r) return r;
    const big = r + 8;
    const small = Math.round(big * 0.3);
    return [big, small, big, small];
  }

  /** 카드 바탕 (index 위치에 깔아 내용보다 뒤에 둔다). tail을 주면 말풍선 */
  card(index: number, x: number, y: number, width: number, height: number, name = 'card', tail?: Tail) {
    const o: BoxOptions = { cornerRadius: this.cardRadius, name, shadow: this.shadow('card') };
    if (this.dark) return this.surfaceBehind(index, x, y, width, height, { fill: ON_DARK_CARD }, { ...o, stroke: ON_DARK_LINE, strokeWidth: 1 }, tail);
    if (this.t.card === 'outline') {
      const node = this.surfaceBehind(index, x, y, width, height, { fill: TRANSPARENT }, { ...o, stroke: DIVIDER, strokeWidth: 2 }, tail);
      // 고급 스타일: 안쪽에 가는 포인트 선을 한 겹 더 (액자 느낌)
      if (this.t.shape.frame === 'line' && !tail && width > 40 && height > 40) {
        this.boxBehind(index + 1, x + 8, y + 8, width - 16, height - 16, TRANSPARENT, {
          stroke: this.palette.point,
          strokeVar: 'point',
          strokeWidth: 1,
          name: 'card_line',
        });
      }
      return node;
    }
    const paint: Paint = this.surface === 'white' ? { fill: this.palette.bgLight, colorVar: 'bgLight' } : { fill: WHITE };
    const node = this.surfaceBehind(index, x, y, width, height, paint, o, tail);
    if (this.t.card === 'stripe' && !tail) this.boxBehind(index + 1, x, y, 8, height, this.palette.main, { colorVar: 'main', name: 'card_stripe' });
    return node;
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
    this.ornament(this.y);
    this.label(label);
    const after = subtitle?.trim() ? 22 : 64;
    const main = this.heading(title, titleSize, { name: 'main_copy', gap: this.t.titleRule ? 28 : after });
    if (main) this.marker(main);
    if (this.t.titleRule) this.rule(after + 6);
    this.text(subtitle, SIZE.sub, { color: this.muted, lineHeight: 1.6, name: 'sub_copy', gap: 64 });
  }

  /** 제목 아래 짧은 강조선 — 마름모 장식 스타일은 선 ─◆─ */
  rule(gap: number) {
    if (this.t.shape.ornament === 'diamond') {
      const d = 14;
      const line = 44;
      const x = this.alignX(line * 2 + d + 16);
      this.accentBox(x, this.y + d / 2 - 1, line, 2, { name: 'title_rule' });
      this.path(diamondPath(d), x + line + 8, this.y, d, d, this.palette[this.accentRole], { colorVar: this.accentRole, name: 'title_rule' });
      this.accentBox(x + line + d + 16, this.y + d / 2 - 1, line, 2, { name: 'title_rule' });
      this.y += d + gap;
      return;
    }
    this.accentBox(this.alignX(64), this.y, 64, 3, { name: 'title_rule' });
    this.y += 3 + gap;
  }

  /** 사진 위나 반전된 색 띠 안(dark가 바탕과 다를 때) — 장식·형광펜을 그리지 않는다 */
  private get inverted() {
    return this.dark !== (this.surface === 'main');
  }

  /**
   * 메인 문구 마지막 줄 아래쪽 형광펜 — 줄이 저절로 접히면 어디서 접힐지 몰라 그리지 않는다.
   * 글자 뒤(같은 자리)에 깔아 글자를 가리지 않는다
   */
  private marker(node: FrameNode) {
    if (!this.t.shape.marker || this.inverted) return;
    const size = Number(node.fontSize);
    const width = Number(node.width);
    const font = String(node.fontFamily);
    const lines = String(node.text).split('\n');
    if (lines.some((line) => estimateLines(line, width, size, font) > 1)) return;
    const lineH = size * Number(node.lineHeight);
    const w = Math.min(width, textWidth(lines.at(-1)!, size, 0, font) + 20);
    const x = node.align === 'center' ? Number(node.x) + (width - w) / 2 : Number(node.x) - 10;
    const top = Number(node.y) + lineH * (lines.length - 1) + lineH * 0.56;
    this.boxBehind(this.nodes.indexOf(node), x, top, w, Math.round(lineH * 0.34), this.palette.point, {
      colorVar: 'point',
      opacity: this.dark ? 0.4 : 0.3,
      cornerRadius: Math.min(6, this.t.radius.chip),
      name: 'title_marker',
    });
  }

  /**
   * 섹션 장식 (첫 머리말 오른편, 모든 요소 뒤) — 섹션마다 한 번만.
   * 원·얼룩은 화면 오른쪽 끝에 걸쳐 잘리게 둬서 얼룩이 아니라 바탕 무늬로 보이게 한다
   */
  private ornament(top: number) {
    if (this.ornamented || this.inverted) return;
    this.ornamented = true;
    const paint: Paint = this.dark ? { fill: WHITE } : { fill: this.palette.point, colorVar: 'point' };
    const o = (opacity: number): BoxOptions => ({ colorVar: paint.colorVar, opacity, name: 'deco' });
    const y = Math.max(0, top - 110);
    switch (this.t.shape.ornament) {
      case 'orb': {
        const r = 190;
        const visible = 230;
        this.path(clippedCirclePath(r, visible), W - visible, y, visible, r * 2, paint.fill, o(this.dark ? 0.07 : 0.1), 0);
        return;
      }
      case 'blob':
        this.path(blobPath(360, 320), W - 360, y, 360, 320, paint.fill, o(this.dark ? 0.07 : 0.14), 0);
        return;
      case 'sparkle':
        this.path(sparklePath(64), W - X - 64, y + 40, 64, 64, paint.fill, o(0.9), 0);
        this.path(sparklePath(32), W - X - 116, y + 112, 32, 32, paint.fill, o(0.6), 0);
        this.path(sparklePath(28), X + 8, y + 150, 28, 28, paint.fill, o(0.5), 0);
        return;
      default:
    }
  }

  /** 사진 모서리 — 화면 끝까지 꽉 찬 사진은 각지게, 유기적인 스타일의 큰 사진은 잎·아치 모양 */
  private photoRadius(x: number, width: number, height: number): number | number[] {
    if (x === 0 && width === W) return 0;
    const r = this.t.radius.image;
    if (this.t.shape.photo !== 'organic' || x <= 0 || x + width >= W || Math.min(width, height) < 160) return r;
    if (height > width * 1.15) return [width / 2, width / 2, r / 2, r / 2];
    const big = Math.min(120, Math.round(Math.min(width, height) / 4));
    const small = Math.round(big / 4);
    return [big, small, big, small];
  }

  /** 큰 사진 액자 — 바깥 가는 선(line) / 뒤에 어긋난 색 면(offset). 화면 가장자리에 붙은 사진은 생략 */
  private photoFrame(index: number, x: number, y: number, width: number, height: number, radius: number | number[]) {
    const frame = this.t.shape.frame;
    if (frame === 'none' || width < FRAMED_PHOTO_MIN_WIDTH || x < 16 || x + width > W - 16) return;
    if (frame === 'line') {
      const r = typeof radius === 'number' && radius ? radius + 12 : 0;
      this.boxBehind(index, x - 12, y - 12, width + 24, height + 24, TRANSPARENT, {
        cornerRadius: r,
        stroke: this.palette.point,
        strokeVar: 'point',
        strokeWidth: 1.5,
        name: 'photo_frame',
      });
      return;
    }
    this.boxBehind(index, x + 16, y + 16, width, height, this.palette.point, { cornerRadius: radius, colorVar: 'point', name: 'photo_frame' });
  }

  /**
   * 사진 자리 — y는 움직이지 않는다. radius를 직접 주면(원형 등) 모양·액자를 스타일에 맡기지 않는다.
   * cutId가 있으면 초안의 컷과 연결된다
   */
  slot(x: number, y: number, width: number, height: number, radius?: number, cutId?: string) {
    const index = this.nodes.length;
    const r = radius ?? this.photoRadius(x, width, height);
    const node = this.insert(imageNode(this.id(), x, y, width, height, r, cutId));
    if (radius === undefined) this.photoFrame(index, x, y, width, height, r);
    return node;
  }

  /** 초안 컷 사진 자리 (현재 y) — 사진이 있으면 y를 내린다 */
  image(cut: DraftCut | undefined, x: number, width: number, height: number, gap = 60, radius?: number) {
    if (!cut) return false;
    this.slot(x, this.y, width, height, radius, cut.id);
    this.y += height + gap;
    return true;
  }

  /** 사진 위 글자를 위한 그라데이션 막 (아래로 갈수록 짙다) */
  scrim(x: number, y: number, width: number, height: number, cornerRadius?: number | number[]) {
    return this.box(x, y, width, height, 'rgba(0, 0, 0, 0.45)', { cornerRadius, name: 'image_dim', gradient: { stops: SCRIM_STOPS } });
  }

  /** start 이후에 만든 요소를 아래로 dy만큼 옮긴다 */
  shift(start: number, dy: number) {
    for (const node of this.nodes.slice(start)) node.y = Number(node.y) + dy;
  }

  space(px: number) {
    this.y += px;
  }

  /** 가장 아래 요소의 끝 y (어긋난 액자처럼 흐름 밖으로 나온 요소까지 프레임에 담기 위해) */
  get extent() {
    return this.nodes.reduce((max, node) => Math.max(max, Number(node.y) + Number(node.height ?? 0)), 0);
  }

  /** 프레임 높이: 흐름 끝(y) + 아래 여백, 단 흐름 밖 요소가 잘리지 않게 */
  frameHeight(bottom: number) {
    return Math.ceil(Math.max(this.y + bottom, this.extent));
  }
}
