import { CW, SIZE, W, X } from '../canvas';
import { bottomOf, cardRow, columns, disc, outline, titled, titledAt, type PatternGroup } from './kit';

const POINTS = [
  ['첫 번째 강점', '강점이 고객에게 주는 이득을 한두 문장으로 적어 주세요.'],
  ['두 번째 강점', '사진과 함께 보여 줄 장점을 적어 주세요.'],
  ['세 번째 강점', '다른 상품과 다른 점을 적어 주세요.'],
];
const GUIDE = '메인 카피 (15자 이내)\n포인트 3개: 제목 12자 + 설명 1~2문장 (스펙이 아니라 고객이 얻는 이득으로)';

export const POINTS_GROUP: PatternGroup = {
  key: 'points',
  part2: '핵심 포인트',
  patterns: [
    {
      key: 'icons3',
      name: '번호 3칸',
      guide: GUIDE,
      draw: (c) => {
        c.header('POINT', '꼭 알아야 할\n세 가지');
        cardRow(
          c,
          3,
          (i, x, w, top) => {
            disc(c, String(i + 1), x + (w - 72) / 2, top, 72, 30);
            return titledAt(c, POINTS[i][0], POINTS[i][1], x, top + 100, w, { align: 'center', titleSize: 28, textSize: SIZE.fine });
          },
          { pad: 26, gap: 16 },
        );
        return 70;
      },
    },
    {
      key: 'bento',
      name: '큰 카드 + 작은 카드',
      guide: `${GUIDE}\n큰 카드에 대표 사진 1장`,
      draw: (c) => {
        c.header('POINT', '한눈에 보는\n핵심 포인트');
        cardRow(
          c,
          1,
          (_, x, w, top) => {
            c.slot(x, top, w, 400);
            return titledAt(c, POINTS[0][0], POINTS[0][1], x, top + 432, w, { titleSize: 36, textSize: SIZE.small });
          },
          { pad: 32, after: 20 },
        );
        cardRow(c, 2, (i, x, w, top) => titledAt(c, POINTS[i + 1][0], POINTS[i + 1][1], x, top, w, { titleSize: 30 }), { pad: 32 });
        return 70;
      },
    },
    {
      key: 'bignum',
      name: '큰 번호',
      guide: GUIDE,
      draw: (c) => {
        c.header('POINT', '이 상품을\n고르는 이유');
        POINTS.forEach(([title, text], i) => {
          c.text(String(i + 1).padStart(2, '0'), 120, { weight: 900, color: c.palette.point, colorVar: 'point', lineHeight: 1, name: 'badge', fontFamily: c.t.font.heading, gap: 12 });
          c.heading(title, 42, { name: 'list_title', gap: 16 });
          c.text(text, SIZE.body, { color: c.muted, lineHeight: 1.6, name: 'list_item', gap: 80 });
        });
        return 30;
      },
    },
    {
      key: 'photocards',
      name: '사진 카드 세로 3장',
      guide: `${GUIDE}\n포인트별 사진 1장씩`,
      draw: (c) => {
        c.header('POINT', '사진으로 보는\n세 가지 강점');
        POINTS.forEach(([title, text], i) => {
          const top = c.y;
          const start = c.nodes.length;
          c.slot(X, top, CW, 440, c.t.radius.card);
          c.textAt(`POINT ${String(i + 1).padStart(2, '0')}`, X + 40, top + 476, CW - 80, SIZE.caption, { weight: 700, ...c.accent(), align: 'left', letterSpacing: 2, name: 'label' });
          const end = titledAt(c, title, text, X + 40, top + 520, CW - 80, { titleSize: 36, textSize: SIZE.small });
          c.card(start, X, top, CW, end - top + 40);
          c.y = end + 40 + 32;
        });
        return 70;
      },
    },
    {
      key: 'rows',
      name: '글 + 오른쪽 사진 행',
      guide: `${GUIDE}\n포인트별 정사각 사진`,
      draw: (c) => {
        c.header('POINT', '하나씩\n살펴볼까요?');
        const img = 240;
        POINTS.forEach(([title, text], i) => {
          const top = c.y;
          c.slot(W - X - img, top, img, img);
          c.textAt(String(i + 1).padStart(2, '0'), X, top, 100, SIZE.caption, { weight: 800, ...c.accent(), align: 'left', name: 'label' });
          const end = titledAt(c, title, text, X, top + 44, CW - img - 40, { titleSize: 34, textSize: SIZE.small });
          c.y = Math.max(end, top + img) + 40;
          if (i < POINTS.length - 1) {
            c.box(X, c.y, CW, 1, c.line, { name: 'divider' });
            c.space(41);
          }
        });
        return 90;
      },
    },
    {
      key: 'keywords',
      name: '키워드 3개 + 대표 설명',
      guide: '메인 카피 (15자 이내)\n키워드 3개 (각 6자 이내, 첫 번째가 가장 중요한 것)\n대표 사진 + 첫 키워드 설명 2문장',
      draw: (c) => {
        c.header('KEYWORD', '세 단어로\n말하면');
        const cells = columns(3, 16);
        const words = ['[키워드 1]', '[키워드 2]', '[키워드 3]'];
        cells.forEach(({ x, w }, i) => {
          if (i === 0) c.badge(words[i], x, c.y, w, 72, { radius: c.t.radius.chip, size: SIZE.small });
          else {
            outline(c, x, c.y, w, 72, c.t.radius.chip, true);
            c.textAt(words[i], x, c.y + 18, w, SIZE.small, { weight: 700, ...c.accent(), name: 'badge' });
          }
        });
        c.space(72 + 40);
        c.slot(X, c.y, CW, 520);
        c.space(520 + 40);
        titled(c, '[키워드 1]이란', '첫 번째 키워드가 고객에게 어떤 의미인지 두 문장으로 설명해 주세요.', { gap: 0 });
        return 100;
      },
    },
    {
      key: 'bars',
      name: '강조 막대 목록',
      guide: GUIDE,
      draw: (c) => {
        c.header('POINT', '이것만은\n자신 있어요');
        for (const [title, text] of POINTS) {
          const top = c.y;
          const end = titledAt(c, title, text, X + 44, top + 4, CW - 44, { titleSize: 36, textSize: SIZE.small });
          c.accentBox(X, top, 8, end - top + 4, { name: 'bar' });
          c.y = end + 56;
        }
        return 50;
      },
    },
    {
      key: 'circles',
      name: '원형 사진 3개',
      guide: `${GUIDE}\n원형 사진 3장 (상품 디테일)`,
      draw: (c) => {
        c.header('POINT', '가까이서 보면\n더 좋아요');
        cardRow(
          c,
          3,
          (i, x, w, top) => {
            const d = 200;
            c.slot(x + (w - d) / 2, top, d, d, d / 2);
            return titledAt(c, POINTS[i][0], POINTS[i][1], x, top + d + 28, w, { align: 'center', titleSize: 28, textSize: SIZE.fine });
          },
          { bare: true, gap: 20, after: 0 },
        );
        return 100;
      },
    },
    {
      key: 'stats',
      name: '숫자 카드 2×2',
      guide: '메인 카피 (15자 이내)\n숫자 카드 4개: 숫자 + 단위 + 설명 (확인된 수치만, 모르면 카드를 지우세요)',
      draw: (c) => {
        c.header('NUMBER', '숫자로 보는\n이 상품');
        const stats = [['[00]', '[단위]', '[평균 당도]'], ['[00]', '[단위]', '[수확 후 발송까지]'], ['[00]', '[단위]', '[재배 경력]'], ['[00]', '[단위]', '[한 상자 개수]']];
        for (let row = 0; row < 2; row++) {
          cardRow(
            c,
            2,
            (i, x, w, top) => {
              const [value, unit, label] = stats[row * 2 + i];
              const v = c.textAt(value, x, top, w, 72, { weight: 900, ...c.accent(), align: 'left', lineHeight: 1.1, name: 'badge', fontFamily: c.t.font.heading });
              const u = c.textAt(unit, x, bottomOf(v) + 4, w, SIZE.caption, { weight: 700, align: 'left', name: 'list_title' });
              return bottomOf(c.textAt(label, x, bottomOf(u) + 8, w, SIZE.caption, { color: c.muted, align: 'left', name: 'list_item' }));
            },
            { pad: 36, after: 20 },
          );
        }
        return 90;
      },
    },
    {
      key: 'one',
      name: '딱 하나만',
      guide: '메인 카피: 가장 강한 장점 하나 (2줄, 줄당 8자 이내)\n사진 1장\n설명 2문장',
      draw: (c) => {
        c.y = 140;
        c.label('ONLY ONE');
        c.heading('딱 하나만\n기억하세요', 80, { lineHeight: 1.2, name: 'main_copy', gap: 56 });
        c.slot(0, c.y, W, 760, 0);
        c.space(760 + 56);
        titled(c, POINTS[0][0], POINTS[0][1], { titleSize: 42, gap: 0 });
        return 110;
      },
    },
  ],
};
