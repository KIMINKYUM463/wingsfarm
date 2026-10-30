import type { DraftCut, DraftPalette, DraftSection } from '@/shared/types/draft';
import type { DesignStyleId } from '@/shared/lib/designStyles';
import type { FrameNode } from '../frames/tree';
import type { PaletteRole } from '../catalog/palette';
import type { SectionLayout, SectionType } from '../catalog/sections';
import { designTokens, type DesignTokens, type Surface } from './designStyles';
import { boxNode, frameNode, GRAY, imageNode, INK, PAGE_WIDTH, textNode, textWidth, WHITE, type BoxOptions, type TextOptions } from './nodes';

/**
 * 초안 섹션 → Konva 프레임
 *
 * - 문구 칸 이름(name)은 후커블 슬롯 이름을 따른다: label / main_copy / sub_copy / list_title / list_item / badge
 * - 사진 칸(`_image`)은 cutId로 초안의 컷과 연결 → 생성 단계에서 그 컷의 사진(내 사진 또는 AI)으로 채운다
 * - 팔레트 색을 쓰는 요소는 colorVar를 달아, 에디터 색상 탭에서 한 번에 바꿀 수 있다
 * - 높이는 문구 길이에 맞춰 늘어난다 (어절 줄바꿈 기준 추정)
 * - 글꼴·정렬·바탕·카드·사진 모양은 디자인 스타일(designStyles.ts)이 정한다
 */
const W = PAGE_WIDTH;
const X = 60;
const CW = W - X * 2;
const DIVIDER = 'rgba(229, 231, 235, 1)';
const STAR = 'rgba(245, 180, 0, 1)';
const SOFT_WHITE = 'rgba(255, 255, 255, 0.85)';
const ON_DARK_CARD = 'rgba(255, 255, 255, 0.08)';
const ON_DARK_LINE = 'rgba(255, 255, 255, 0.24)';
const TRANSPARENT = 'rgba(255, 255, 255, 0)';

/** 860px 기준 글자 크기 (휴대폰에서 절반 가까이 줄어드는 것을 감안) */
const SIZE = { label: 26, title: 56, heroTitle: 72, sub: 30, itemTitle: 34, body: 30, small: 28, caption: 24, fine: 22 };

type Place = TextOptions & { x?: number; width?: number; gap?: number; heading?: boolean };

class Canvas {
  readonly nodes: FrameNode[] = [];
  y = 110;
  /** 진한 바탕이나 사진 위: 글자·배지를 밝게 */
  dark: boolean;
  private seq = 0;

  constructor(
    private prefix: string,
    readonly palette: DraftPalette,
    readonly t: DesignTokens,
    readonly surface: Surface,
  ) {
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
    const padY = Math.max(10, (height - size * 1.35) / 2);
    const label = this.textAt(value, x + 14, y + padY, width - 28, size, {
      weight: 800,
      align: 'center',
      name: o.name ?? 'badge',
      ...(this.dark ? { color: this.palette.main, colorVar: 'main' as const } : { color: WHITE }),
    });
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

  /** start 이후에 만든 요소를 아래로 dy만큼 옮긴다 */
  shift(start: number, dy: number) {
    for (const node of this.nodes.slice(start)) node.y = Number(node.y) + dy;
  }

  space(px: number) {
    this.y += px;
  }
}

interface Ctx {
  c: Canvas;
  s: DraftSection;
  sectionCut: DraftCut | undefined;
  itemCut: (index: number) => DraftCut | undefined;
}

const itemTitle = (s: DraftSection, i: number) => s.items[i]?.title?.text ?? '';
const itemText = (s: DraftSection, i: number) => s.items[i]?.text.text ?? '';
const pointNo = (i: number) => `POINT ${String(i + 1).padStart(2, '0')}`;

/** 라벨 + 메인 문구 + 서브 문구 */
function header({ c, s }: Ctx, o: { titleSize?: number } = {}) {
  c.label(s.label?.text);
  const hasSub = Boolean(s.subtitle?.text?.trim());
  const after = hasSub ? 22 : 64;
  c.heading(s.title.text, o.titleSize ?? SIZE.title, { name: 'main_copy', gap: c.t.titleRule ? 28 : after });
  if (c.t.titleRule) c.rule(after + 6);
  c.text(s.subtitle?.text, SIZE.sub, { color: c.muted, lineHeight: 1.6, name: 'sub_copy', gap: 64 });
}

/** 항목 제목 + 설명을 위아래로 */
function itemList({ c, s }: Ctx, o: { bodyColor?: string; lineHeight?: number } = {}) {
  s.items.forEach((_, i) => {
    c.text(itemTitle(s, i), SIZE.itemTitle, { weight: 700, name: 'list_title', gap: 14 });
    c.text(itemText(s, i), SIZE.body, { color: o.bodyColor ?? c.muted, lineHeight: o.lineHeight ?? 1.65, name: 'list_item', gap: 44 });
  });
}

/** 첫 화면 아래 핵심 혜택 배지 (최대 3개) */
function heroChips({ c, s }: Ctx) {
  const chips = s.items.slice(0, 3);
  if (!chips.length) return;
  const chipW = 230;
  const gapX = 20;
  const startX = c.alignX(chips.length * chipW + (chips.length - 1) * gapX);
  const boxes = chips.map((item, i) =>
    c.badge(item.text.text, startX + i * (chipW + gapX), c.y, chipW, 68, { radius: c.t.radius.chip, size: SIZE.caption }),
  );
  const rowH = Math.max(...boxes.map((b) => Number(b.height)));
  for (const b of boxes) b.height = rowH;
  c.space(rowH);
}

type Builder = (ctx: Ctx) => { bottom?: number };

const LAYOUTS: Record<SectionLayout, Builder> = {
  hero: (ctx) => {
    const { c, sectionCut } = ctx;
    const mode = sectionCut ? c.t.hero : 'stack';
    if (mode === 'imageTop') {
      c.y = 0;
      c.image(sectionCut, 0, W, 980, 80);
      header(ctx, { titleSize: SIZE.heroTitle });
    } else if (mode === 'overlay') {
      const imageH = 1180;
      c.y = 0;
      c.image(sectionCut, 0, W, imageH, 0);
      c.box(0, 0, W, imageH, 'rgba(0, 0, 0, 1)', { opacity: 0.42, name: 'image_dim' });
      const start = c.nodes.length;
      const wasDark = c.dark;
      c.dark = true;
      header(ctx, { titleSize: SIZE.heroTitle });
      c.shift(start, imageH - c.y);
      c.dark = wasDark;
      c.y = imageH + 80;
    } else {
      c.space(-10);
      header(ctx, { titleSize: SIZE.heroTitle });
      c.image(sectionCut, 0, W, 900, 56);
    }
    heroChips(ctx);
    return { bottom: 100 };
  },

  visual: (ctx) => {
    const { c, sectionCut } = ctx;
    c.y = 0;
    if (!c.image(sectionCut, 0, W, 960, 80)) c.y = 110;
    header(ctx);
    itemList(ctx);
    return {};
  },

  points: (ctx) => {
    const { c, s, itemCut } = ctx;
    header(ctx);
    s.items.forEach((_, i) => {
      const cut = itemCut(i);
      if (c.t.points === 'zigzag' && cut) {
        const imgW = 360;
        const imgH = 440;
        const left = i % 2 === 0;
        const col: Place = { x: left ? X + imgW + 40 : X, width: CW - imgW - 40, align: 'left' };
        const top = c.y;
        c.nodes.push(imageNode(c.id(), left ? X : W - X - imgW, top, imgW, imgH, c.t.radius.image, cut.id));
        c.y = top + 24;
        c.text(pointNo(i), SIZE.caption, { ...col, weight: 700, ...c.accent(), letterSpacing: 2, name: 'label', gap: 14 });
        c.heading(itemTitle(s, i), 38, { ...col, name: 'list_title', gap: 16 });
        c.text(itemText(s, i), SIZE.small, { ...col, color: c.muted, lineHeight: 1.6, name: 'list_item', gap: 0 });
        c.y = Math.max(c.y, top + imgH) + 90;
        return;
      }
      if (c.t.points === 'bleed' && cut) {
        c.image(cut, 0, W, 640, 44);
        c.label(pointNo(i), 14);
        c.heading(itemTitle(s, i), 42, { name: 'list_title', gap: 18 });
        c.text(itemText(s, i), SIZE.body, { color: c.muted, lineHeight: 1.6, name: 'list_item', gap: 0 });
        c.space(110);
        return;
      }
      c.label(pointNo(i), 14);
      c.heading(itemTitle(s, i), 42, { name: 'list_title', gap: 18 });
      c.text(itemText(s, i), SIZE.body, { color: c.muted, lineHeight: 1.6, name: 'list_item', gap: 40 });
      c.image(cut, 50, 760, 520, 40);
      c.space(60);
    });
    return { bottom: 50 };
  },

  grid: (ctx) => {
    const { c, s, itemCut } = ctx;
    header(ctx);
    const cardW = 360;
    for (let row = 0; row < s.items.length; row += 2) {
      let rowH = 0;
      for (let col = 0; col < 2 && row + col < s.items.length; col++) {
        const i = row + col;
        const x = X + col * (cardW + 20);
        const start = c.nodes.length;
        let y = c.y + 28;
        const cut = itemCut(i);
        if (cut) {
          c.nodes.push(imageNode(c.id(), x, c.y, cardW, cardW, c.t.radius.card, cut.id));
          y = c.y + cardW + 24;
        } else {
          c.badge(String(i + 1), x + 28, y, 56, 56, { radius: Math.min(28, c.t.radius.chip), size: SIZE.caption });
          y += 80;
        }
        const pad = cut ? 0 : 28;
        const align = cut ? 'center' : 'left';
        const title = c.textAt(itemTitle(s, i) || itemText(s, i), x + pad, y, cardW - pad * 2, 32, { weight: 700, align, name: 'list_title' });
        y += Number(title.height) + 12;
        if (itemTitle(s, i)) {
          const body = c.textAt(itemText(s, i), x + pad, y, cardW - pad * 2, SIZE.caption + 2, { color: c.muted, lineHeight: 1.55, align, name: 'list_item' });
          y += Number(body.height);
        }
        const h = y - c.y + 28;
        if (!cut) c.card(start, x, c.y, cardW, h);
        rowH = Math.max(rowH, h);
      }
      c.space(rowH + 40);
    }
    return { bottom: 70 };
  },

  compare: (ctx) => {
    const { c, s, sectionCut } = ctx;
    header(ctx);
    c.image(sectionCut, X, CW, 460, 48);
    c.textAt('확인할 점', X + 30, c.y, 260, SIZE.caption, { weight: 700, color: c.muted, align: 'left', name: 'label' });
    c.textAt('이 상품', X + 310, c.y, 400, SIZE.caption, { weight: 700, ...c.accent(), align: 'left', name: 'label' });
    c.space(48);
    s.items.forEach((_, i) => {
      const start = c.nodes.length;
      const left = c.textAt(itemTitle(s, i), X + 30, c.y + 28, 250, SIZE.small, { weight: 700, align: 'left', name: 'list_title' });
      const right = c.textAt(itemText(s, i), X + 310, c.y + 28, 400, SIZE.small, { align: 'left', lineHeight: 1.5, name: 'list_item' });
      const h = Math.max(Number(left.height), Number(right.height)) + 56;
      c.card(start, X, c.y, CW, h, 'row');
      c.boxBehind(start + 1, X + 290, c.y + 20, 2, h - 40, c.palette.point, { colorVar: 'point', name: 'divider' });
      c.space(h + 14);
    });
    return { bottom: 96 };
  },

  size: (ctx) => {
    const { c, s, sectionCut } = ctx;
    header(ctx);
    c.image(sectionCut, 50, 760, 620, 50);
    s.items.forEach((_, i) => {
      c.accentBox(X + 40, c.y + 14, 14, 14, { cornerRadius: 7, name: 'bullet' });
      const value = [itemTitle(s, i), itemText(s, i)].filter(Boolean).join('  ');
      c.text(value, SIZE.body, { x: X + 74, width: CW - 74, align: 'left', lineHeight: 1.5, name: 'list_item', gap: 22 });
    });
    return {};
  },

  story: (ctx) => {
    const { c, sectionCut } = ctx;
    c.y = 0;
    if (!c.image(sectionCut, 0, W, 720, 80)) c.y = 110;
    header(ctx, { titleSize: 48 });
    itemList(ctx, { bodyColor: c.ink, lineHeight: 1.75 });
    return {};
  },

  steps: (ctx) => {
    const { c, s, itemCut } = ctx;
    header(ctx);
    const circles: number[] = [];
    s.items.forEach((_, i) => {
      const top = c.y;
      circles.push(top);
      c.badge(String(i + 1), X, top, 72, 72, { radius: Math.min(36, c.t.radius.chip || 0), size: 28 });
      c.y = top + 8;
      c.text(itemTitle(s, i) || itemText(s, i), 32, { x: X + 100, width: CW - 100, weight: 700, align: 'left', name: 'list_title', gap: 12 });
      if (itemTitle(s, i)) c.text(itemText(s, i), SIZE.small, { x: X + 100, width: CW - 100, color: c.muted, align: 'left', lineHeight: 1.6, name: 'list_item', gap: 24 });
      c.image(itemCut(i), X + 100, CW - 100, 360, 24);
      c.y = Math.max(c.y, top + 72) + 44;
    });
    circles.slice(0, -1).forEach((top, i) => {
      const from = top + 80;
      const to = circles[i + 1] - 8;
      if (to > from) c.boxBehind(0, X + 34, from, 4, to - from, c.palette.point, { colorVar: 'point', name: 'connector' });
    });
    return { bottom: 66 };
  },

  table: (ctx) => {
    const { c, s, sectionCut } = ctx;
    header(ctx);
    c.image(sectionCut, 150, 560, 560, 60);
    c.box(X, c.y, CW, 2, c.ink, { name: 'divider' });
    c.space(2);
    s.items.forEach((_, i) => {
      const label = c.textAt(itemTitle(s, i), X + 20, c.y + 26, 220, SIZE.small, { weight: 700, align: 'left', name: 'list_title' });
      const value = c.textAt(itemText(s, i), X + 260, c.y + 26, CW - 280, SIZE.small, { color: c.muted, align: 'left', lineHeight: 1.5, name: 'list_item' });
      const h = Math.max(Number(label.height), Number(value.height)) + 52;
      c.box(X, c.y + h - 1, CW, 1, c.line, { name: 'divider' });
      c.space(h);
    });
    return {};
  },

  faq: (ctx) => {
    const { c, s } = ctx;
    header(ctx);
    s.items.forEach((_, i) => {
      const start = c.nodes.length;
      const top = c.y;
      c.textAt('Q', X + 36, top + 34, 40, 32, { weight: 800, ...c.accent(), name: 'badge', fontFamily: c.t.font.heading });
      const q = c.textAt(itemTitle(s, i), X + 90, top + 36, CW - 130, 30, { weight: 700, align: 'left', name: 'list_title' });
      const aTop = top + 36 + Number(q.height) + 18;
      const a = c.textAt(itemText(s, i), X + 90, aTop, CW - 130, SIZE.small, { color: c.muted, align: 'left', lineHeight: 1.6, name: 'list_item' });
      const h = aTop - top + Number(a.height) + 36;
      c.card(start, X, top, CW, h);
      c.space(h + 20);
    });
    return { bottom: 90 };
  },

  reviews: (ctx) => {
    const { c, s } = ctx;
    header(ctx);
    s.items.forEach((_, i) => {
      const start = c.nodes.length;
      const top = c.y;
      c.textAt('★★★★★', X + 40, top + 36, 300, 26, { color: STAR, align: 'left', name: 'badge' });
      const body = c.textAt(itemText(s, i), X + 40, top + 84, CW - 80, SIZE.small, { align: 'left', lineHeight: 1.6, name: 'list_item' });
      const authorTop = top + 84 + Number(body.height) + 20;
      c.textAt(itemTitle(s, i) || '구매 고객', X + 40, authorTop, CW - 80, SIZE.caption, { color: c.muted, align: 'left', name: 'label' });
      const h = authorTop - top + 68;
      c.card(start, X, top, CW, h);
      c.space(h + 24);
    });
    return { bottom: 86 };
  },

  badges: (ctx) => {
    const { c, s } = ctx;
    header(ctx);
    const cardW = 360;
    for (let row = 0; row < s.items.length; row += 2) {
      let rowH = 0;
      const count = Math.min(2, s.items.length - row);
      const startX = count === 1 ? (W - cardW) / 2 : X;
      for (let col = 0; col < count; col++) {
        const i = row + col;
        const x = startX + col * (cardW + 20);
        const start = c.nodes.length;
        c.badge('인증', x + (cardW - 120) / 2, c.y + 36, 120, 120, { radius: c.t.radius.chip ? 60 : 0, size: 28 });
        const name = c.textAt(itemTitle(s, i) || itemText(s, i), x + 24, c.y + 184, cardW - 48, 30, { weight: 700, name: 'list_title' });
        let y = c.y + 184 + Number(name.height) + 10;
        if (itemTitle(s, i)) {
          const no = c.textAt(itemText(s, i), x + 24, y, cardW - 48, SIZE.caption, { color: c.muted, name: 'list_item' });
          y += Number(no.height);
        }
        const h = y - c.y + 36;
        c.card(start, x, c.y, cardW, h);
        rowH = Math.max(rowH, h);
      }
      c.space(rowH + 24);
    }
    return { bottom: 86 };
  },

  cta: (ctx) => {
    const { c, s, sectionCut } = ctx;
    c.space(10);
    header(ctx, { titleSize: 60 });
    c.image(sectionCut, c.alignX(420), 420, 420, 60, c.t.radius.image ? 210 : 0);
    s.items.forEach((_, i) => {
      const value = [itemTitle(s, i), itemText(s, i)].filter(Boolean).join(' · ');
      c.text(value, SIZE.small, { lineHeight: 1.6, name: 'list_item', gap: 18 });
    });
    return { bottom: 110 };
  },

  contact: (ctx) => {
    const { c, s } = ctx;
    header(ctx);
    const start = c.nodes.length;
    const top = c.y;
    c.space(20);
    s.items.forEach((_, i) => {
      const label = c.textAt(itemTitle(s, i), X + 40, c.y + 20, 200, SIZE.small, { weight: 700, align: 'left', name: 'list_title' });
      const value = c.textAt(itemText(s, i), X + 260, c.y + 20, CW - 300, SIZE.small, { color: c.muted, align: 'left', lineHeight: 1.5, name: 'list_item' });
      c.space(Math.max(Number(label.height), Number(value.height)) + 40);
    });
    c.space(20);
    c.card(start, X, top, CW, c.y - top);
    return {};
  },

  notice: ({ c, s }) => {
    c.y = 44;
    c.text(s.title.text, SIZE.fine, { weight: 700, color: c.muted, align: 'center', name: 'main_copy', gap: 12 });
    s.items.forEach((_, i) => {
      const value = [itemTitle(s, i), itemText(s, i)].filter(Boolean).join(': ');
      c.text(value, SIZE.fine, { color: c.muted, align: 'center', lineHeight: 1.6, name: 'list_item', gap: 8 });
    });
    return { bottom: 36 };
  },
};

/** 레이아웃을 그리는 데 필요한 섹션 종류 정보 */
export type LayoutSource = Pick<SectionType, 'id' | 'name' | 'layout' | 'cuts'>;

/** 섹션 하나를 프레임으로 만든다 (id는 미리보기용 고정값 — 프로젝트에 넣을 때 새로 발급) */
export function buildSectionFrame(section: DraftSection, type: LayoutSource, palette: DraftPalette, style?: DesignStyleId): FrameNode {
  const tokens = designTokens(style);
  const surface = tokens.surfaces[type.layout];
  const c = new Canvas(section.id, palette, tokens, surface);
  const cuts = section.cuts;
  const sectionCut = type.cuts === 'none' ? undefined : (cuts.find((cut) => cut.itemIndex == null) ?? cuts[0]);
  const itemCut = (index: number) =>
    type.cuts === 'perItem' ? (cuts.find((cut) => cut.itemIndex === index) ?? (cuts.some((cut) => cut.itemIndex != null) ? undefined : cuts[index])) : undefined;

  const { bottom = 110 } = LAYOUTS[type.layout]({ c, s: section, sectionCut, itemCut });
  const fill = surface === 'white' ? WHITE : palette[surface];
  const frame = frameNode(`${section.id}-root`, type.name, Math.ceil(c.y + bottom), fill, c.nodes, surface === 'white' ? undefined : surface);
  frame.sectionTypeId = type.id;
  return frame;
}

/** 섹션 종류가 기대하는 컷 개수 */
export const expectedCutCount = (type: Pick<SectionType, 'cuts'>, itemCount: number) =>
  type.cuts === 'none' ? 0 : type.cuts === 'one' ? 1 : itemCount;
