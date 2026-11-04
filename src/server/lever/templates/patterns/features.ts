import { trapezoidPath } from '@/shared/lib/shapePaths';
import { CW, SIZE, W, X } from '../canvas';
import { WHITE } from '../nodes';
import { accentFill, bottomOf, cardRow, chips, columns, disc, divider, onAccent, softPaint, titledAt, type PatternGroup } from './kit';

export const FEATURES: PatternGroup = {
  key: 'features',
  part2: '상품 특징',
  patterns: [
    {
      key: 'crosscut',
      name: '단면·과육',
      guide: '메인 카피 (12자 이내)\n왼쪽: 겉모습 사진 / 오른쪽: 단면·과육 사진 (같은 개체면 더 좋음)\n아래 설명 2줄: 색·과즙·씨앗 등 눈으로 확인되는 사실만',
      draw: (c) => {
        c.header('INSIDE', '겉과 속을\n함께 보세요');
        cardRow(
          c,
          2,
          (i, x, w, top) => {
            c.slot(x, top, w, 480);
            c.badge(i ? '단면' : '겉면', x + 20, top + 20, 120, 48, { radius: c.t.radius.chip, size: SIZE.fine, name: 'label' });
            return bottomOf(
              c.textAt(i ? '[과육·색·수분 상태를 한 줄로]' : '[겉 색·모양을 한 줄로]', x, top + 504, w, SIZE.small, {
                weight: 700,
                name: 'list_item',
              }),
            );
          },
          { bare: true, after: 24 },
        );
        c.text('※ 개체·수확 시기에 따라 색과 숙도가 조금 다를 수 있어요', SIZE.caption, { color: c.muted, name: 'sub_copy', gap: 0 });
        return 100;
      },
    },
    {
      key: 'checktable',
      name: '체크 표',
      guide: '메인 카피 (12자 이내)\n표 4줄: 왼쪽 확인할 점(8자) / 오른쪽 이 상품의 사실(20자)\n※ 다른 상품을 깎아내리지 말고 이 상품의 사실만',
      draw: (c) => {
        c.header('CHECK', '고르기 전에\n확인해 보세요');
        const head = c.nodes.length;
        const style = { weight: 700, align: 'left' as const, name: 'label', ...onAccent(c) };
        c.textAt('확인할 점', X + 32, c.y + 22, 240, SIZE.caption, style);
        c.textAt('이 상품', X + 300, c.y + 22, CW - 332, SIZE.caption, style);
        accentFill(c, head, X, c.y, CW, 76, Math.min(c.t.radius.card, 16));
        c.space(76);
        const rows = [['맛', '[맛을 결정하는 기준]'], ['선별', '[선별 기준]'], ['포장', '[포장 방법]'], ['배송', '[출고 기준]']];
        for (const [k, v] of rows) {
          const top = c.y;
          const a = c.textAt(k, X + 32, top + 28, 240, SIZE.small, { weight: 700, align: 'left', name: 'list_title' });
          const b = c.textAt(`✓  ${v}`, X + 300, top + 28, CW - 332, SIZE.small, { align: 'left', name: 'list_item' });
          c.y = Math.max(bottomOf(a), bottomOf(b)) + 28;
          divider(c);
        }
        return 90;
      },
    },
    {
      key: 'flow',
      name: '가로 4단계',
      guide: '메인 카피 (12자 이내)\n단계 4개: 이름 (6자 이내) + 설명 (12자 이내)',
      draw: (c) => {
        c.header('FLOW', '이렇게\n준비해요');
        const steps = [['수확', '[수확 방법]'], ['선별', '[선별 기준]'], ['세척', '[손질 방법]'], ['포장', '[포장 방법]']];
        const cells = columns(4, 20);
        const d = 110;
        const top = c.y;
        const lineAt = c.nodes.length;
        let bottom = top;
        cells.forEach(({ x, w }, i) => {
          disc(c, String(i + 1), x + (w - d) / 2, top, d, 40);
          bottom = Math.max(bottom, titledAt(c, steps[i][0], steps[i][1], x, top + d + 24, w, { align: 'center', titleSize: 30, textSize: SIZE.fine }));
        });
        const first = cells[0].x + cells[0].w / 2;
        const last = cells[3].x + cells[3].w / 2;
        c.boxBehind(lineAt, first, top + d / 2 - 2, last - first, 4, c.palette.point, { colorVar: 'point', name: 'connector' });
        c.y = bottom;
        return 100;
      },
    },
    {
      key: 'recipe',
      name: '레시피 카드',
      guide: '메인 카피 (12자 이내)\n완성 사진 1장\n재료 4개 (각 6자 이내)\n만드는 법 3단계 (각 1문장)',
      draw: (c) => {
        c.header('RECIPE', '이렇게도\n즐겨 보세요');
        c.slot(X, c.y, CW, 500);
        c.space(500 + 40);
        c.text('재료', SIZE.itemTitle, { weight: 700, name: 'list_title', gap: 20 });
        chips(c, ['[재료 1]', '[재료 2]', '[재료 3]', '[재료 4]'], { width: 170, height: 60 });
        c.space(48);
        c.text('만드는 법', SIZE.itemTitle, { weight: 700, name: 'list_title', gap: 20 });
        ['[첫 단계를 적어 주세요]', '[두 번째 단계를 적어 주세요]', '[마지막 단계를 적어 주세요]'].forEach((step, i) => {
          const top = c.y;
          disc(c, String(i + 1), X, top, 44, 22);
          const t = c.textAt(step, X + 64, top + 6, CW - 64, SIZE.small, { align: 'left', name: 'list_item' });
          c.y = Math.max(top + 44, bottomOf(t)) + 20;
        });
        return 90;
      },
    },
    {
      key: 'scenes',
      name: '활용 장면 2×2',
      guide: '메인 카피 (15자 이내)\n사진 4장: 먹는·쓰는 장면\n장면 이름 4개 (각 8자 이내)',
      draw: (c) => {
        c.header('HOW TO ENJOY', '이럴 때\n딱 좋아요');
        const scenes = ['아침 한 접시', '아이 간식', '홈카페 디저트', '정성 담은 선물'];
        const size = 360;
        for (let row = 0; row < 2; row++) {
          cardRow(
            c,
            2,
            (i, x, w, top) => {
              c.slot(x, top, w, size);
              const tagH = 56;
              c.box(x + 20, top + size - tagH - 20, 220, tagH, 'rgba(0, 0, 0, 1)', { opacity: 0.55, name: 'image_dim', cornerRadius: Math.min(c.t.radius.chip, tagH / 2) });
              c.textAt(scenes[row * 2 + i], x + 20, top + size - tagH - 20 + 14, 220, SIZE.caption, { weight: 700, color: WHITE, name: 'list_item' });
              return top + size;
            },
            { bare: true, after: 20 },
          );
        }
        return 90;
      },
    },
    {
      key: 'zoom',
      name: '디테일 확대 번호',
      guide: '메인 카피 (15자 이내)\n큰 사진 1장 (확대해서 보여 줄 부분이 있는 컷)\n번호 설명 3개 (각 20자 이내) — 번호 위치는 사진에 맞게 옮겨 주세요',
      draw: (c) => {
        c.header('DETAIL', '가까이\n들여다보면');
        const top = c.y;
        const H = 700;
        c.slot(X, top, CW, H);
        [[0.22, 0.28], [0.62, 0.42], [0.38, 0.74]].forEach(([fx, fy], i) => disc(c, String(i + 1), X + CW * fx, top + H * fy, 60, 26));
        c.y = top + H + 48;
        ['[1번 위치에서 보이는 특징]', '[2번 위치에서 보이는 특징]', '[3번 위치에서 보이는 특징]'].forEach((value, i) => {
          const rowTop = c.y;
          disc(c, String(i + 1), X, rowTop, 44, 22);
          const t = c.textAt(value, X + 64, rowTop + 6, CW - 64, SIZE.small, { align: 'left', name: 'list_item' });
          c.y = Math.max(rowTop + 44, bottomOf(t)) + 20;
        });
        return 90;
      },
    },
    {
      key: 'gauge',
      name: '맛 지표',
      guide: '메인 카피 (12자 이내)\n지표 4줄: 이름 (4자) + 다섯 칸 중 채운 칸 수 (판매자가 직접 판단한 기준)\n아래 한 줄: 기준 설명',
      draw: (c) => {
        c.header('TASTE', '맛을 한눈에');
        const rows: [string, number][] = [['단맛', 4], ['신맛', 2], ['식감', 4], ['향', 3]];
        cardRow(
          c,
          1,
          (_, x, w, top) => {
            let y = top;
            for (const [label, level] of rows) {
              c.textAt(label, x, y + 2, 140, SIZE.small, { weight: 700, align: 'left', name: 'list_title' });
              const segW = Math.floor((w - 160 - 4 * 8) / 5);
              for (let s = 0; s < 5; s++) {
                const sx = x + 160 + s * (segW + 8);
                if (s < level) c.accentBox(sx, y + 6, segW, 26, { cornerRadius: Math.min(13, c.t.radius.chip), name: 'gauge_on' });
                else c.box(sx, y + 6, segW, 26, c.line, { cornerRadius: Math.min(13, c.t.radius.chip), name: 'gauge_off' });
              }
              y += 72;
            }
            return y - 32;
          },
          { pad: 44, after: 24 },
        );
        c.text('※ [판매자가 직접 맛본 기준이에요]', SIZE.caption, { color: c.muted, name: 'list_item', gap: 0 });
        return 100;
      },
    },
    {
      key: 'brix',
      name: '당도 측정',
      guide: '메인 카피 (12자 이내)\n측정 장면 사진 1장\n큰 숫자: 확인된 당도(Brix)만\n한 줄: 측정 기준·편차 안내 (보장 과장 금지)',
      draw: (c) => {
        c.header('BRIX', '숫자로 보는\n당도');
        c.slot(X, c.y, CW, 520);
        c.space(520 + 48);
        cardRow(
          c,
          1,
          (_, x, w, top) => {
            const num = c.textAt('[00]', x, top, w, 120, {
              weight: 900,
              ...c.accent(),
              align: 'left',
              lineHeight: 1,
              name: 'badge',
              fontFamily: c.t.font.heading,
            });
            const unit = c.textAt('°Brix  (측정 기준을 적어 주세요)', x, bottomOf(num) + 8, w, SIZE.small, {
              weight: 700,
              align: 'left',
              name: 'list_title',
            });
            return bottomOf(
              c.textAt('수확 시기·개체에 따라 당도 차이가 있을 수 있어요', x, bottomOf(unit) + 16, w, SIZE.caption, {
                color: c.muted,
                align: 'left',
                name: 'list_item',
              }),
            );
          },
          { pad: 36, after: 0 },
        );
        return 90;
      },
    },
    {
      key: 'funnel',
      name: '선별 깔때기',
      guide: '메인 카피 (15자 이내)\n단계 3개: 위에서 아래로 좁아지는 선별 과정 (각 제목 10자 + 설명 15자, 실제 기준만)',
      draw: (c) => {
        c.header('SELECT', '이렇게 골라서\n보내요');
        const steps = [['수확한 전체', '[수확 기준]'], ['1차 선별', '[크기·모양 기준]'], ['최종 출고', '[당도·상태 기준]']];
        const step = 140;
        steps.forEach(([title, text], i) => {
          const w = CW - i * step;
          const x = (W - w) / 2;
          const top = c.y;
          const start = c.nodes.length;
          const last = i === steps.length - 1;
          const color = last ? onAccent(c) : {};
          // 아랫변이 다음 칸 폭만큼 좁아지는 사다리꼴 — 글자는 좁아진 폭 안에 둔다
          const inner = { x: x + step / 2, w: w - step };
          const t = c.textAt(title, inner.x, top + 28, inner.w, 32, { weight: 700, name: 'list_title', ...color });
          const b = c.textAt(text, inner.x, bottomOf(t) + 8, inner.w, SIZE.caption, { name: 'list_item', ...(last ? color : { color: c.muted }) });
          const h = bottomOf(b) - top + 28;
          const paint = last ? c.accentPaint : softPaint(c);
          c.path(trapezoidPath(w, h, step / 2), x, top, w, h, paint.fill, { colorVar: paint.colorVar, name: last ? 'accent_bg' : 'soft_bg' }, start);
          c.y = top + h;
          if (!last) c.text('▼', 28, { ...c.accent(), align: 'center', name: 'badge', gap: 8 });
        });
        return 100;
      },
    },
    {
      key: 'grade',
      name: '등급·기대치',
      guide: '메인 카피 (12자 이내)\n등급 3칸: 정품 / 가정용 / 못난이(또는 실속) — 각 외관·용도 1~2문장 (맛 단정·과장 금지)\n아래 한 줄: 선물용 추천 옵션',
      draw: (c) => {
        c.header('GRADE', '등급을 알고\n고르세요');
        const grades = [
          ['정품', '외관·선별이 비교적 고른 구성', '선물·사진용'],
          ['가정용', '맛은 즐기되 색·흠·모양이 섞일 수 있어요', '일상 섭취'],
          ['못난이', '모양·흠이 있어도 활용하기 좋은 실속형', '가공·즙·요리'],
        ];
        cardRow(
          c,
          3,
          (i, x, w, top) => {
            const [name, desc, use] = grades[i];
            const title = c.textAt(name, x, top, w, 36, { weight: 800, align: 'left', name: 'list_title', fontFamily: c.t.font.heading });
            const body = c.textAt(desc, x, bottomOf(title) + 14, w, SIZE.caption, {
              color: c.muted,
              align: 'left',
              lineHeight: 1.5,
              name: 'list_item',
            });
            return bottomOf(
              c.textAt(use, x, bottomOf(body) + 16, w, SIZE.fine, { weight: 700, ...c.accent(), align: 'left', name: 'label' }),
            );
          },
          { pad: 28, gap: 16 },
        );
        c.text('선물용이면 [정품 옵션명]을 권장드려요', SIZE.small, { color: c.muted, name: 'sub_copy', gap: 0 });
        return 90;
      },
    },
  ],
};
