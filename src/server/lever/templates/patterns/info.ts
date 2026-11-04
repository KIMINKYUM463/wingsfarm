import { CW, SIZE, X, type Canvas } from '../canvas';
import { accentFill, bottomOf, cardRow, columns, disc, divider, onAccent, outline, titledAt, type PatternGroup } from './kit';

const FACTS = '(입력한 사실 그대로)';

/** 항목 / 내용 두 칸 표의 한 줄 → 줄 높이 */
function tableRow(c: Canvas, label: string, value: string, top: number, o: { labelW?: number; padY?: number; size?: number } = {}) {
  const labelW = o.labelW ?? 220;
  const padY = o.padY ?? 26;
  const size = o.size ?? SIZE.small;
  const a = c.textAt(label, X + 28, top + padY, labelW, size, { weight: 700, align: 'left', name: 'list_title' });
  const b = c.textAt(value, X + 48 + labelW, top + padY, CW - labelW - 76, size, { color: c.muted, align: 'left', lineHeight: 1.5, name: 'list_item' });
  return Math.max(bottomOf(a), bottomOf(b)) - top + padY;
}

const INFO_ROWS = [['상품명', '[상품명]'], ['원산지', '[원산지]'], ['중량·수량', '[중량·수량]'], ['보관 방법', '[보관 방법]'], ['소비기한', '[소비기한]']];

export const INFO: PatternGroup = {
  key: 'info',
  part2: '상세 정보',
  patterns: [
    {
      key: 'sizes',
      name: '크기 비교 3단',
      guide: `메인 카피 (12자 이내)\n사진 3장: 소·중·대 같은 구도\n크기별 중량·개수 ${FACTS}`,
      draw: (c) => {
        c.header('SIZE', '크기를\n비교해 보세요');
        const sizes = [['소과', 150], ['중과', 190], ['대과', 230]] as const;
        const base = c.y + 230;
        let bottom = base;
        columns(3, 20).forEach(({ x, w }, i) => {
          const [name, d] = sizes[i];
          c.slot(x + (w - d) / 2, base - d, d, d);
          const end = titledAt(c, name, '[중량·개수]', x, base + 28, w, { align: 'center', titleSize: 30, textSize: SIZE.caption });
          bottom = Math.max(bottom, end);
        });
        c.y = bottom;
        return 100;
      },
    },
    {
      key: 'options',
      name: '옵션 카드',
      guide: `메인 카피 (12자 이내)\n옵션 3개: 중량 / 가격 / 개수·용도 ${FACTS}\n가운데 옵션에 '추천' 표시`,
      draw: (c) => {
        c.header('OPTION', '구성을\n골라 주세요');
        const options = [['[1kg]', '[가격]원', '[개수·용도]'], ['[3kg]', '[가격]원', '[개수·용도]'], ['[5kg]', '[가격]원', '[개수·용도]']];
        cardRow(
          c,
          3,
          (i, x, w, top) => {
            let y = top;
            if (i === 1) y += Number(c.badge('추천', x + (w - 100) / 2, top, 100, 44, { radius: c.t.radius.chip, size: SIZE.fine, name: 'label' }).height) + 16;
            else y += 60;
            const weight = c.textAt(options[i][0], x, y, w, 44, { weight: 800, name: 'list_title', fontFamily: c.t.font.heading });
            const price = c.textAt(options[i][1], x, bottomOf(weight) + 12, w, SIZE.small, { weight: 700, ...c.accent(), name: 'list_item' });
            return bottomOf(c.textAt(options[i][2], x, bottomOf(price) + 8, w, SIZE.fine, { color: c.muted, name: 'list_item' }));
          },
          { pad: 24, gap: 16 },
        );
        return 70;
      },
    },
    {
      key: 'specgrid',
      name: '정보 상자 2×3',
      guide: `메인 카피 (15자 이내)\n상자 6개: 항목 / 내용 ${FACTS}`,
      draw: (c) => {
        c.header('INFO', '한눈에 보는\n상품 정보');
        const cells = [['원산지', '[원산지]'], ['품종', '[품종]'], ['중량', '[중량]'], ['수확 시기', '[수확 시기]'], ['보관', '[보관 방법]'], ['소비기한', '[소비기한]']];
        for (let row = 0; row < 3; row++) {
          cardRow(
            c,
            2,
            (i, x, w, top) => {
              const [k, v] = cells[row * 2 + i];
              const a = c.textAt(k, x, top, w, SIZE.caption, { color: c.muted, align: 'left', name: 'list_title' });
              return bottomOf(c.textAt(v, x, bottomOf(a) + 8, w, 32, { weight: 700, align: 'left', name: 'list_item' }));
            },
            { pad: 32, after: 20 },
          );
        }
        return 90;
      },
    },
    {
      key: 'boxflat',
      name: '박스 구성',
      guide: `메인 카피 (12자 이내)\n상자·트레이를 연 구성 사진 1장\n아래 3칸: 총 중량 / 예상 과수·개수 / 포장재 포함 여부 ${FACTS}\n한 줄: 과수는 선별 상황에 따라 달라질 수 있음`,
      draw: (c) => {
        c.header('IN THE BOX', '상자를 열면\n이렇게 담겨요');
        c.slot(X, c.y, CW, 560);
        c.space(560 + 40);
        const cells = [
          ['총 중량', '[중량]'],
          ['과수·개수', '[대략 개수]'],
          ['포장재', '[포함 / 별도]'],
        ];
        cardRow(
          c,
          3,
          (i, x, w, top) => {
            const [k, v] = cells[i];
            const a = c.textAt(k, x, top, w, SIZE.caption, { color: c.muted, align: 'left', name: 'list_title' });
            return bottomOf(c.textAt(v, x, bottomOf(a) + 10, w, 32, { weight: 800, align: 'left', name: 'list_item' }));
          },
          { pad: 28, gap: 16 },
        );
        c.text('과수·크기는 산지 선별에 따라 조금 달라질 수 있어요', SIZE.caption, { color: c.muted, name: 'sub_copy', gap: 0 });
        return 90;
      },
    },
    {
      key: 'package',
      name: '구성품 번호',
      guide: `메인 카피 (12자 이내)\n구성 사진 1장 (상자를 연 모습)\n구성품 3~4개 ${FACTS}`,
      draw: (c) => {
        c.header('PACKAGE', '이렇게\n담아 보내요');
        c.slot(X, c.y, CW, 560);
        c.space(560 + 44);
        ['[구성품 1]', '[구성품 2]', '[구성품 3]', '[구성품 4]'].forEach((value, i) => {
          const top = c.y;
          disc(c, String(i + 1), X, top, 48, 22);
          const t = c.textAt(value, X + 72, top + 6, CW - 72, SIZE.small, { align: 'left', name: 'list_item' });
          c.y = Math.max(top + 48, bottomOf(t)) + 18;
          if (i < 3) divider(c, 18);
        });
        return 90;
      },
    },
    {
      key: 'boxed',
      name: '테두리 표',
      guide: `메인 카피 (10자 이내)\n표 5줄: 항목 / 내용 ${FACTS}`,
      draw: (c) => {
        c.header('SPEC', '상세 정보');
        const top = c.y;
        const head = c.nodes.length;
        const style = { weight: 700, align: 'left' as const, name: 'label', ...onAccent(c) };
        c.textAt('항목', X + 28, top + 22, 220, SIZE.caption, style);
        c.textAt('내용', X + 268, top + 22, CW - 296, SIZE.caption, style);
        accentFill(c, head, X, top, CW, 76, 0);
        c.y = top + 76;
        INFO_ROWS.forEach(([k, v], i) => {
          const h = tableRow(c, k, v, c.y);
          c.space(h);
          if (i < INFO_ROWS.length - 1) divider(c);
        });
        outline(c, X, top, CW, c.y - top, 0);
        c.box(X + 248, top + 76, 1, c.y - top - 76, c.line, { name: 'divider' });
        return 100;
      },
    },
    {
      key: 'calendar',
      name: '수확 달력',
      guide: '메인 카피 (10자 이내)\n막대 달력: 높은 막대를 실제 수확 달로 옮겨 주세요\n아래 한 줄: 수확·출고 시기 (사실 그대로)',
      draw: (c) => {
        c.header('HARVEST', '수확 달력');
        const harvest = new Set([8, 9, 10]);
        const top = c.y;
        const H = 220;
        columns(12, 8).forEach(({ x, w }, m) => {
          const on = harvest.has(m);
          const h = on ? H : 60;
          if (on) c.accentBox(x, top + H - h, w, h, { cornerRadius: Math.min(8, c.t.radius.chip), name: 'bar_on' });
          else c.box(x, top + H - h, w, h, c.line, { cornerRadius: Math.min(8, c.t.radius.chip), name: 'bar_off' });
          c.textAt(`${m + 1}`, x - 4, top + H + 14, w + 8, SIZE.fine, { weight: on ? 800 : 400, color: on ? c.ink : c.muted, name: 'list_title' });
        });
        c.y = top + H + 14 + 40 + 40;
        c.text('[수확 시기]에 수확해 [출고 기준]에 보내 드려요', SIZE.small, { lineHeight: 1.6, name: 'list_item', gap: 0 });
        return 100;
      },
    },
    {
      key: 'storage',
      name: '보관 방법 3칸',
      guide: `메인 카피 (12자 이내)\n보관 3가지: 방법 / 기간 / 한 줄 설명 ${FACTS}`,
      draw: (c) => {
        c.header('STORAGE', '이렇게\n보관하세요');
        const ways = [['냉장', '[기간]', '[냉장 보관 방법]'], ['실온', '[기간]', '[실온 보관 방법]'], ['냉동', '[기간]', '[냉동 보관 방법]']];
        cardRow(
          c,
          3,
          (i, x, w, top) => {
            disc(c, ways[i][0], x + (w - 96) / 2, top, 96, 26);
            const period = c.textAt(ways[i][1], x, top + 120, w, 36, { weight: 800, ...c.accent(), name: 'list_title', fontFamily: c.t.font.heading });
            return bottomOf(c.textAt(ways[i][2], x, bottomOf(period) + 10, w, SIZE.fine, { color: c.muted, lineHeight: 1.5, name: 'list_item' }));
          },
          { pad: 26, gap: 16 },
        );
        return 70;
      },
    },
    {
      key: 'delivery',
      name: '주문 → 도착 타임라인',
      guide: '메인 카피 (12자 이내)\n단계 4개: 날짜(D+0 등) / 이름 / 설명 (실제 출고·배송 일정 그대로)',
      draw: (c) => {
        c.header('DELIVERY', '주문부터\n도착까지');
        const steps = [['D+0', '주문', '[주문 마감 시각]'], ['D+[0]', '수확', '[수확 방식]'], ['D+[0]', '출고', '[출고 기준]'], ['D+[0]', '도착', '[택배사·지역]']];
        const cells = columns(4, 16);
        const top = c.y;
        const lineAt = c.nodes.length;
        let bottom = top;
        cells.forEach(({ x, w }, i) => {
          c.textAt(steps[i][0], x, top, w, SIZE.small, { weight: 800, ...c.accent(), name: 'label' });
          c.accentBox(x + w / 2 - 12, top + 52, 24, 24, { cornerRadius: c.t.radius.chip ? 12 : 0, name: 'dot' });
          bottom = Math.max(bottom, titledAt(c, steps[i][1], steps[i][2], x, top + 100, w, { align: 'center', titleSize: 30, textSize: SIZE.fine }));
        });
        const first = cells[0].x + cells[0].w / 2;
        const last = cells[3].x + cells[3].w / 2;
        c.boxBehind(lineAt, first, top + 62, last - first, 4, c.palette.point, { colorVar: 'point', name: 'connector' });
        c.y = bottom;
        return 100;
      },
    },
    {
      key: 'notice',
      name: '상품정보 제공고시',
      guide: `상품정보 제공고시 표 (농수산물 품목 기준 항목) ${FACTS}`,
      draw: (c) => {
        c.y = 60;
        const head = c.nodes.length;
        c.textAt('상품정보 제공고시', X + 24, c.y + 18, CW - 48, SIZE.caption, { weight: 700, align: 'left', name: 'main_copy', ...onAccent(c) });
        accentFill(c, head, X, c.y, CW, 68, 0);
        c.space(68);
        const rows = [['품목 또는 명칭', '[품목]'], ['생산자·수입자', '[생산자]'], ['원산지', '[원산지]'], ['제조·생산 연월일', '[생산일]'], ['중량·수량·크기', '[중량]'], ['보관 방법·취급 방법', '[보관 방법]'], ['소비자 상담 전화', '[전화번호]']];
        rows.forEach(([k, v]) => {
          c.space(tableRow(c, k, v, c.y, { labelW: 240, padY: 16, size: SIZE.fine }));
          divider(c);
        });
        return 60;
      },
    },
  ],
};
