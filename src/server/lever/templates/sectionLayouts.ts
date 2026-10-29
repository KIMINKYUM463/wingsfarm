import type { DraftCut, DraftPalette, DraftSection } from '@/shared/types/draft';
import type { FrameNode } from '../frames/tree';
import type { PaletteRole } from '../catalog/palette';
import type { SectionLayout, SectionType } from '../catalog/sections';
import { boxNode, frameNode, GRAY, imageNode, INK, PAGE_WIDTH, textNode, WHITE, type BoxOptions, type TextOptions } from './nodes';

/**
 * 초안 섹션 → Konva 프레임
 *
 * - 문구 칸 이름(name)은 후커블 슬롯 이름을 따른다: label / main_copy / sub_copy / list_title / list_item / badge
 * - 사진 칸(`_image`)은 cutId로 초안의 컷과 연결 → 생성 단계에서 그 컷의 사진(내 사진 또는 AI)으로 채운다
 * - 팔레트 색을 쓰는 요소는 colorVar를 달아, 에디터 색상 탭에서 한 번에 바꿀 수 있다
 * - 높이는 문구 길이에 맞춰 늘어난다 (어절 줄바꿈 기준 추정)
 */
const W = PAGE_WIDTH;
const X = 60;
const CW = W - X * 2;
const DIVIDER = 'rgba(229, 231, 235, 1)';
const STAR = 'rgba(245, 180, 0, 1)';
const SOFT_WHITE = 'rgba(255, 255, 255, 0.85)';

type Place = TextOptions & { x?: number; width?: number; gap?: number };

class Canvas {
  readonly nodes: FrameNode[] = [];
  y: number;
  private seq = 0;

  constructor(
    private prefix: string,
    readonly palette: DraftPalette,
    top = 110,
  ) {
    this.y = top;
  }

  id() {
    return `${this.prefix}-${++this.seq}`;
  }

  color(role: PaletteRole) {
    return { color: this.palette[role], colorVar: role };
  }

  /** 현재 y에 문구를 놓고 y를 내린다 */
  text(value: string | undefined, fontSize: number, o: Place = {}) {
    if (!value?.trim()) return null;
    const node = this.textAt(value, o.x ?? X, this.y, o.width ?? CW, fontSize, o);
    this.y += Number(node.height) + (o.gap ?? 24);
    return node;
  }

  /** y를 움직이지 않고 원하는 위치에 문구 */
  textAt(value: string, x: number, y: number, width: number, fontSize: number, o: TextOptions = {}) {
    const node = textNode(this.id(), value, x, y, width, fontSize, o);
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

  roleBox(x: number, y: number, width: number, height: number, role: PaletteRole, o: BoxOptions = {}) {
    return this.box(x, y, width, height, this.palette[role], { ...o, colorVar: role });
  }

  image(cut: DraftCut | undefined, x: number, width: number, height: number, radius = 0, gap = 60) {
    if (!cut) return false;
    this.nodes.push(imageNode(this.id(), x, this.y, width, height, radius, cut.id));
    this.y += height + gap;
    return true;
  }

  space(px: number) {
    this.y += px;
  }
}

interface Ctx {
  c: Canvas;
  s: DraftSection;
  type: SectionType;
  sectionCut: DraftCut | undefined;
  itemCut: (index: number) => DraftCut | undefined;
}

const itemTitle = (s: DraftSection, i: number) => s.items[i]?.title?.text ?? '';
const itemText = (s: DraftSection, i: number) => s.items[i]?.text.text ?? '';

/** 라벨 + 메인 문구 + 서브 문구 */
function header(ctx: Ctx, o: { light?: boolean; titleSize?: number } = {}) {
  const { c, s } = ctx;
  c.text(s.label?.text, 24, { weight: 700, ...(o.light ? { color: SOFT_WHITE } : c.color('main')), name: 'label', letterSpacing: 2, gap: 18 });
  c.text(s.title.text, o.titleSize ?? 50, {
    weight: 800,
    lineHeight: 1.3,
    color: o.light ? WHITE : INK,
    name: 'main_copy',
    gap: s.subtitle?.text ? 22 : 64,
  });
  c.text(s.subtitle?.text, 26, { color: o.light ? SOFT_WHITE : GRAY, lineHeight: 1.6, name: 'sub_copy', gap: 64 });
}

type Builder = (ctx: Ctx) => { fill: string; colorVar?: PaletteRole; bottom?: number };

const LAYOUTS: Record<SectionLayout, Builder> = {
  hero: ({ c, s, sectionCut }) => {
    c.space(-10);
    c.text(s.label?.text, 26, { weight: 700, ...c.color('main'), name: 'label', letterSpacing: 2, gap: 20 });
    c.text(s.title.text, 64, { weight: 800, lineHeight: 1.25, name: 'main_copy', gap: 26 });
    c.text(s.subtitle?.text, 28, { color: GRAY, lineHeight: 1.55, name: 'sub_copy', gap: 56 });
    c.image(sectionCut, 0, W, 900, 0, 56);
    const chips = s.items.slice(0, 3);
    if (chips.length) {
      const chipW = 220;
      const gapX = 30;
      const startX = (W - (chips.length * chipW + (chips.length - 1) * gapX)) / 2;
      let rowH = 64;
      chips.forEach((item, i) => {
        const x = startX + i * (chipW + gapX);
        const bg = c.roleBox(x, c.y, chipW, 64, 'main', { cornerRadius: 32, name: 'badge_bg' });
        const label = c.textAt(item.text.text, x + 12, c.y + 18, chipW - 24, 24, { weight: 700, color: WHITE, name: 'badge' });
        const h = Math.max(64, Number(label.height) + 36);
        bg.height = h;
        rowH = Math.max(rowH, h);
      });
      c.space(rowH);
    }
    return { fill: c.palette.bgLight, colorVar: 'bgLight', bottom: 100 };
  },

  visual: (ctx) => {
    const { c, s, sectionCut } = ctx;
    c.y = 0;
    if (!c.image(sectionCut, 0, W, 960, 0, 80)) c.y = 110;
    header(ctx);
    s.items.forEach((_, i) => {
      c.text(itemTitle(s, i), 30, { weight: 700, name: 'list_title', gap: 12 });
      c.text(itemText(s, i), 26, { color: GRAY, lineHeight: 1.7, name: 'list_item', gap: 36 });
    });
    return { fill: c.palette.bgLight, colorVar: 'bgLight' };
  },

  points: (ctx) => {
    const { c, s, itemCut } = ctx;
    header(ctx);
    s.items.forEach((_, i) => {
      c.text(`POINT ${String(i + 1).padStart(2, '0')}`, 24, { weight: 700, ...c.color('main'), name: 'label', letterSpacing: 2, gap: 14 });
      c.text(itemTitle(s, i), 40, { weight: 800, lineHeight: 1.3, name: 'list_title', gap: 18 });
      c.text(itemText(s, i), 26, { x: 80, width: 700, color: GRAY, lineHeight: 1.6, name: 'list_item', gap: 40 });
      c.image(itemCut(i), 50, 760, 520, 24, 40);
      c.space(60);
    });
    return { fill: c.palette.bgLight, colorVar: 'bgLight', bottom: 50 };
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
        let y = c.y + 24;
        const cut = itemCut(i);
        if (cut) {
          c.nodes.push(imageNode(c.id(), x, c.y, cardW, cardW, 20, cut.id));
          y = c.y + cardW + 24;
        } else {
          c.roleBox(x + 24, y, 56, 56, 'main', { cornerRadius: 28 });
          c.textAt(String(i + 1), x + 24, y + 14, 56, 26, { weight: 800, color: WHITE, name: 'badge' });
          y += 80;
        }
        const pad = cut ? 0 : 24;
        const title = c.textAt(itemTitle(s, i) || itemText(s, i), x + pad, y, cardW - pad * 2, 30, { weight: 700, align: cut ? 'center' : 'left', name: 'list_title' });
        y += Number(title.height) + 12;
        if (itemTitle(s, i)) {
          const body = c.textAt(itemText(s, i), x + pad, y, cardW - pad * 2, 22, { color: GRAY, lineHeight: 1.55, align: cut ? 'center' : 'left', name: 'list_item' });
          y += Number(body.height);
        }
        const h = y - c.y + 24;
        if (!cut) c.boxBehind(start, x, c.y, cardW, h, WHITE, { cornerRadius: 20, name: 'card' });
        rowH = Math.max(rowH, h);
      }
      c.space(rowH + 40);
    }
    return { fill: c.palette.bgLight, colorVar: 'bgLight', bottom: 70 };
  },

  compare: (ctx) => {
    const { c, s, sectionCut } = ctx;
    header(ctx);
    c.image(sectionCut, X, CW, 460, 24, 48);
    c.textAt('확인할 점', X + 30, c.y, 260, 22, { weight: 700, color: GRAY, align: 'left', name: 'label' });
    c.textAt('이 상품', X + 310, c.y, 400, 22, { weight: 700, ...c.color('main'), align: 'left', name: 'label' });
    c.space(46);
    s.items.forEach((_, i) => {
      const start = c.nodes.length;
      const left = c.textAt(itemTitle(s, i), X + 30, c.y + 28, 250, 24, { weight: 700, align: 'left', name: 'list_title' });
      const right = c.textAt(itemText(s, i), X + 310, c.y + 28, 400, 24, { align: 'left', lineHeight: 1.5, name: 'list_item' });
      const h = Math.max(Number(left.height), Number(right.height)) + 56;
      c.boxBehind(start, X, c.y, CW, h, WHITE, { cornerRadius: 16, name: 'row' });
      c.boxBehind(start + 1, X + 290, c.y + 20, 2, h - 40, c.palette.point, { colorVar: 'point', name: 'divider' });
      c.space(h + 14);
    });
    return { fill: c.palette.bgDark, colorVar: 'bgDark', bottom: 96 };
  },

  size: (ctx) => {
    const { c, s, sectionCut } = ctx;
    header(ctx);
    c.image(sectionCut, 50, 760, 620, 24, 50);
    s.items.forEach((_, i) => {
      c.roleBox(X + 40, c.y + 12, 14, 14, 'main', { cornerRadius: 7 });
      const value = [itemTitle(s, i), itemText(s, i)].filter(Boolean).join('  ');
      c.text(value, 28, { x: X + 74, width: CW - 74, align: 'left', lineHeight: 1.5, name: 'list_item', gap: 22 });
    });
    return { fill: c.palette.bgLight, colorVar: 'bgLight' };
  },

  story: (ctx) => {
    const { c, s, sectionCut } = ctx;
    c.y = 0;
    if (!c.image(sectionCut, 0, W, 720, 0, 80)) c.y = 110;
    header(ctx, { titleSize: 46 });
    s.items.forEach((_, i) => {
      c.text(itemTitle(s, i), 32, { weight: 700, name: 'list_title', gap: 14 });
      c.text(itemText(s, i), 26, { x: 80, width: 700, color: INK, lineHeight: 1.75, name: 'explanation', gap: 44 });
    });
    return { fill: c.palette.bgDark, colorVar: 'bgDark' };
  },

  steps: (ctx) => {
    const { c, s, itemCut } = ctx;
    header(ctx);
    const circles: number[] = [];
    s.items.forEach((_, i) => {
      const top = c.y;
      circles.push(top);
      c.roleBox(X, top, 72, 72, 'main', { cornerRadius: 36 });
      c.textAt(String(i + 1), X, top + 20, 72, 28, { weight: 800, color: WHITE, name: 'badge' });
      c.y = top + 8;
      c.text(itemTitle(s, i) || itemText(s, i), 32, { x: X + 100, width: CW - 100, weight: 700, align: 'left', name: 'list_title', gap: 12 });
      if (itemTitle(s, i)) c.text(itemText(s, i), 24, { x: X + 100, width: CW - 100, color: GRAY, align: 'left', lineHeight: 1.6, name: 'list_item', gap: 24 });
      c.image(itemCut(i), X + 100, CW - 100, 360, 20, 24);
      c.y = Math.max(c.y, top + 72) + 44;
    });
    circles.slice(0, -1).forEach((top, i) => {
      const from = top + 80;
      const to = circles[i + 1] - 8;
      if (to > from) c.boxBehind(0, X + 34, from, 4, to - from, c.palette.point, { colorVar: 'point', name: 'connector' });
    });
    return { fill: c.palette.bgLight, colorVar: 'bgLight', bottom: 66 };
  },

  table: (ctx) => {
    const { c, s, sectionCut } = ctx;
    header(ctx);
    c.image(sectionCut, 150, 560, 560, 24, 60);
    c.box(X, c.y, CW, 2, INK, { name: 'divider' });
    c.space(2);
    s.items.forEach((_, i) => {
      const label = c.textAt(itemTitle(s, i), X + 20, c.y + 26, 220, 24, { weight: 700, align: 'left', name: 'list_title' });
      const value = c.textAt(itemText(s, i), X + 260, c.y + 26, CW - 280, 24, { color: GRAY, align: 'left', lineHeight: 1.5, name: 'list_item' });
      const h = Math.max(Number(label.height), Number(value.height)) + 52;
      c.box(X, c.y + h - 1, CW, 1, DIVIDER, { name: 'divider' });
      c.space(h);
    });
    return { fill: WHITE };
  },

  faq: (ctx) => {
    const { c, s } = ctx;
    header(ctx);
    s.items.forEach((_, i) => {
      const start = c.nodes.length;
      const top = c.y;
      c.textAt('Q', X + 36, top + 34, 40, 30, { weight: 800, ...c.color('main'), name: 'badge' });
      const q = c.textAt(itemTitle(s, i), X + 90, top + 36, CW - 130, 28, { weight: 700, align: 'left', name: 'list_title' });
      const aTop = top + 36 + Number(q.height) + 18;
      const a = c.textAt(itemText(s, i), X + 90, aTop, CW - 130, 24, { color: GRAY, align: 'left', lineHeight: 1.6, name: 'list_item' });
      const h = aTop - top + Number(a.height) + 36;
      c.boxBehind(start, X, top, CW, h, WHITE, { cornerRadius: 20, name: 'card' });
      c.space(h + 20);
    });
    return { fill: c.palette.bgLight, colorVar: 'bgLight', bottom: 90 };
  },

  reviews: (ctx) => {
    const { c, s } = ctx;
    header(ctx);
    s.items.forEach((_, i) => {
      const start = c.nodes.length;
      const top = c.y;
      c.textAt('★★★★★', X + 40, top + 36, 300, 26, { color: STAR, align: 'left', name: 'badge' });
      const body = c.textAt(itemText(s, i), X + 40, top + 84, CW - 80, 26, { align: 'left', lineHeight: 1.6, name: 'list_item' });
      const authorTop = top + 84 + Number(body.height) + 20;
      c.textAt(itemTitle(s, i) || '구매 고객', X + 40, authorTop, CW - 80, 22, { color: GRAY, align: 'left', name: 'label' });
      const h = authorTop - top + 66;
      c.boxBehind(start, X, top, CW, h, WHITE, { cornerRadius: 24, name: 'card' });
      c.space(h + 24);
    });
    return { fill: c.palette.bgDark, colorVar: 'bgDark', bottom: 86 };
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
        c.roleBox(x + (cardW - 120) / 2, c.y + 36, 120, 120, 'main', { cornerRadius: 60 });
        c.textAt('인증', x + (cardW - 120) / 2, c.y + 80, 120, 28, { weight: 800, color: WHITE, name: 'badge' });
        const name = c.textAt(itemTitle(s, i) || itemText(s, i), x + 24, c.y + 184, cardW - 48, 28, { weight: 700, name: 'list_title' });
        let y = c.y + 184 + Number(name.height) + 10;
        if (itemTitle(s, i)) {
          const no = c.textAt(itemText(s, i), x + 24, y, cardW - 48, 22, { color: GRAY, name: 'list_item' });
          y += Number(no.height);
        }
        const h = y - c.y + 36;
        c.boxBehind(start, x, c.y, cardW, h, WHITE, { cornerRadius: 24, name: 'card' });
        rowH = Math.max(rowH, h);
      }
      c.space(rowH + 24);
    }
    return { fill: c.palette.bgLight, colorVar: 'bgLight', bottom: 86 };
  },

  cta: (ctx) => {
    const { c, s, sectionCut } = ctx;
    c.space(10);
    header(ctx, { light: true, titleSize: 56 });
    c.image(sectionCut, (W - 420) / 2, 420, 420, 210, 60);
    s.items.forEach((_, i) => {
      const value = [itemTitle(s, i), itemText(s, i)].filter(Boolean).join(' · ');
      c.text(value, 26, { color: WHITE, lineHeight: 1.6, name: 'list_item', gap: 18 });
    });
    return { fill: c.palette.main, colorVar: 'main', bottom: 110 };
  },

  contact: (ctx) => {
    const { c, s } = ctx;
    header(ctx);
    const start = c.nodes.length;
    const top = c.y;
    c.space(20);
    s.items.forEach((_, i) => {
      const label = c.textAt(itemTitle(s, i), X + 40, c.y + 20, 200, 24, { weight: 700, align: 'left', name: 'list_title' });
      const value = c.textAt(itemText(s, i), X + 260, c.y + 20, CW - 300, 24, { color: GRAY, align: 'left', lineHeight: 1.5, name: 'list_item' });
      c.space(Math.max(Number(label.height), Number(value.height)) + 40);
    });
    c.space(20);
    c.boxBehind(start, X, top, CW, c.y - top, WHITE, { cornerRadius: 24, name: 'card' });
    return { fill: c.palette.bgDark, colorVar: 'bgDark' };
  },

  notice: ({ c, s }) => {
    c.y = 44;
    c.text(s.title.text, 20, { weight: 700, color: GRAY, name: 'main_copy', gap: 12 });
    s.items.forEach((_, i) => {
      const value = [itemTitle(s, i), itemText(s, i)].filter(Boolean).join(': ');
      c.text(value, 18, { color: GRAY, lineHeight: 1.6, name: 'list_item', gap: 8 });
    });
    return { fill: WHITE, bottom: 36 };
  },
};

/** 섹션 하나를 프레임으로 만든다 (id는 미리보기용 고정값 — 프로젝트에 넣을 때 새로 발급) */
export function buildSectionFrame(section: DraftSection, type: SectionType, palette: DraftPalette): FrameNode {
  const c = new Canvas(section.id, palette);
  const cuts = section.cuts;
  const sectionCut = type.cuts === 'none' ? undefined : (cuts.find((cut) => cut.itemIndex == null) ?? cuts[0]);
  const itemCut = (index: number) =>
    type.cuts === 'perItem' ? (cuts.find((cut) => cut.itemIndex === index) ?? (cuts.some((cut) => cut.itemIndex != null) ? undefined : cuts[index])) : undefined;

  const { fill, colorVar, bottom = 110 } = LAYOUTS[type.layout]({ c, s: section, type, sectionCut, itemCut });
  const frame = frameNode(`${section.id}-root`, type.name, Math.ceil(c.y + bottom), fill, c.nodes, colorVar);
  frame.sectionTypeId = type.id;
  return frame;
}

/** 섹션 종류가 기대하는 컷 개수 */
export const expectedCutCount = (type: SectionType, itemCount: number) =>
  type.cuts === 'none' ? 0 : type.cuts === 'one' ? 1 : itemCount;
