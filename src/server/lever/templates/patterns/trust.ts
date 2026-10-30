import { CW, SIZE, W, X } from '../canvas';
import { bottomOf, cardRow, chips, columns, disc, divider, stars, type PatternGroup } from './kit';

const REVIEW = '[실제 구매 후기를 그대로 옮겨 적어 주세요]';
const REAL = '(실제 후기·실제 기록만, 지어내지 않기)';

export const TRUST: PatternGroup = {
  key: 'trust',
  part2: '고객 후기',
  patterns: [
    {
      key: 'photoreviews',
      name: '포토 후기 2×2',
      guide: `메인 카피 (15자 이내)\n포토 후기 4개: 고객 사진 + 후기 원문 + 작성자 ${REAL}`,
      draw: (c) => {
        c.header('PHOTO REVIEW', '사진으로 보는\n후기');
        for (let row = 0; row < 2; row++) {
          cardRow(
            c,
            2,
            (_, x, w, top) => {
              c.slot(x, top, w, 260);
              stars(c, x, top + 284, w, 'left', 24);
              const body = c.textAt(REVIEW, x, top + 326, w, SIZE.caption, { align: 'left', lineHeight: 1.55, name: 'list_item' });
              return bottomOf(c.textAt('[작성자]', x, bottomOf(body) + 12, w, SIZE.fine, { color: c.muted, align: 'left', name: 'label' }));
            },
            { pad: 24, after: 20 },
          );
        }
        return 90;
      },
    },
    {
      key: 'featured',
      name: '대표 후기 한 줄',
      guide: `가장 인상 깊은 후기 한 문장 (원문 그대로)\n작성자\n아래 짧은 후기 2개 ${REAL}`,
      draw: (c) => {
        c.y = 110;
        c.text('“', 180, { weight: 900, ...c.accent(), lineHeight: 0.9, name: 'badge', fontFamily: c.t.font.heading, gap: 0 });
        c.heading('[가장 인상 깊은 실제 후기\n한 문장을 옮겨 주세요]', 48, { name: 'main_copy', gap: 24 });
        stars(c, c.alignX(300), c.y, 300, c.t.align === 'left' ? 'left' : 'center', 30);
        c.space(52);
        c.text('[작성자] · [구매 옵션]', SIZE.small, { color: c.muted, name: 'label', gap: 64 });
        divider(c, 48);
        for (const i of [0, 1]) c.text(`“${REVIEW}” — [작성자]`, SIZE.small, { color: c.muted, lineHeight: 1.6, name: 'list_item', gap: i ? 0 : 28 });
        return 110;
      },
    },
    {
      key: 'rating',
      name: '평점 요약',
      guide: `평균 평점·후기 수 (스토어에 표시된 숫자 그대로)\n점수별 비율 (스토어 통계 그대로)\n후기 2개 ${REAL}`,
      draw: (c) => {
        c.header('RATING', '구매 고객 평점');
        cardRow(
          c,
          1,
          (_, x, w, top) => {
            const avg = c.textAt('[4.9]', x, top, 240, 72, { weight: 900, ...c.accent(), lineHeight: 1.1, name: 'badge', fontFamily: c.t.font.heading });
            stars(c, x, bottomOf(avg) + 4, 240, 'center', 28);
            const count = c.textAt('후기 [0]개', x, bottomOf(avg) + 52, 240, SIZE.caption, { color: c.muted, name: 'list_item' });
            const barX = x + 280;
            const barW = w - 280 - 110;
            let y = top + 4;
            for (const score of [5, 4, 3, 2, 1]) {
              c.textAt(`${score}점`, barX, y, 70, SIZE.caption, { weight: 700, align: 'left', name: 'list_title' });
              c.box(barX + 70, y + 10, barW - 70, 14, c.line, { cornerRadius: 7, name: 'bar_track' });
              c.textAt('[00]%', barX + barW + 10, y, 100, SIZE.caption, { color: c.muted, align: 'right', name: 'list_item' });
              y += 46;
            }
            return Math.max(bottomOf(count), y - 14);
          },
          { pad: 40, after: 28 },
        );
        for (const i of [0, 1]) {
          cardRow(c, 1, (_, x, w, top) => {
            stars(c, x, top, w, 'left', 24);
            return bottomOf(c.textAt(REVIEW, x, top + 42, w, SIZE.caption, { align: 'left', lineHeight: 1.55, name: 'list_item' }));
          }, { pad: 32, after: i ? 0 : 16 });
        }
        return 100;
      },
    },
    {
      key: 'bubbles',
      name: '말풍선 후기',
      guide: `메인 카피 (15자 이내)\n후기 3개: 원문 + 작성자 ${REAL}`,
      draw: (c) => {
        c.header('VOICE', '받아 보신 분들의\n한마디');
        [0, 1, 2].forEach((i) => {
          const w = 600;
          const x = i % 2 ? W - X - w : X;
          const top = c.y;
          const avatarX = i % 2 ? W - X - 64 : X;
          disc(c, '★', avatarX, top, 64, 26);
          c.y = top + 80;
          cardRow(
            c,
            1,
            (_, ix, iw, itop) => {
              const body = c.textAt(REVIEW, ix, itop, iw, SIZE.small, { align: 'left', lineHeight: 1.55, name: 'list_item' });
              return bottomOf(c.textAt('[작성자]', ix, bottomOf(body) + 12, iw, SIZE.fine, { color: c.muted, align: 'left', name: 'label' }));
            },
            { x, width: w, pad: 32, after: 32 },
          );
        });
        return 70;
      },
    },
    {
      key: 'keywords',
      name: '후기 키워드',
      guide: `메인 카피 (15자 이내)\n후기에 자주 나온 말 6개 (실제 후기에서 뽑기, 각 6자 이내)\n대표 후기 한 줄 ${REAL}`,
      draw: (c) => {
        c.header('KEYWORD', '후기에 가장\n많이 나온 말');
        chips(c, ['[키워드 1]', '[키워드 2]', '[키워드 3]']);
        c.space(16);
        chips(c, ['[키워드 4]', '[키워드 5]', '[키워드 6]']);
        c.space(48);
        cardRow(c, 1, (_, x, w, top) => {
          stars(c, x, top, w, 'left', 24);
          return bottomOf(c.textAt(REVIEW, x, top + 42, w, SIZE.small, { align: 'left', lineHeight: 1.6, name: 'list_item' }));
        }, { pad: 36 });
        return 70;
      },
    },
    {
      key: 'numbers',
      name: '숫자 신뢰',
      guide: `메인 카피 (15자 이내)\n숫자 3개: 누적 판매·재구매율·후기 수 등 (스토어 기록 그대로) ${REAL}`,
      draw: (c) => {
        c.header('TRUST', '숫자로 보는\n믿음');
        const stats = [['[00]', '[누적 판매]'], ['[00]%', '[재구매율]'], ['[00]', '[누적 후기]']];
        cardRow(
          c,
          3,
          (i, x, w, top) => {
            const v = c.textAt(stats[i][0], x, top, w, 56, { weight: 900, ...c.accent(), lineHeight: 1.15, name: 'badge', fontFamily: c.t.font.heading });
            return bottomOf(c.textAt(stats[i][1], x, bottomOf(v) + 10, w, SIZE.caption, { color: c.muted, name: 'list_item' }));
          },
          { pad: 28, gap: 16 },
        );
        c.text('기준: [집계 기간·출처]', SIZE.fine, { color: c.muted, name: 'list_item', gap: 0 });
        return 100;
      },
    },
    {
      key: 'seals',
      name: '인증 마크 3개',
      guide: `메인 카피 (12자 이내)\n인증 1~3개: 인증명 / 인증번호 (실제로 받은 인증만, 없으면 지우기)`,
      draw: (c) => {
        c.header('CERTIFIED', '믿을 수 있는\n인증');
        let bottom = c.y;
        const top = c.y;
        columns(3, 20).forEach(({ x, w }) => {
          const d = 170;
          disc(c, '인증', x + (w - d) / 2, top, d, 34);
          const name = c.textAt('[인증명]', x, top + d + 24, w, SIZE.small, { weight: 700, name: 'list_title' });
          bottom = Math.max(bottom, bottomOf(c.textAt('[인증번호]', x, bottomOf(name) + 8, w, SIZE.fine, { color: c.muted, name: 'list_item' })));
        });
        c.y = bottom;
        return 100;
      },
    },
    {
      key: 'history',
      name: '수상·이력',
      guide: `메인 카피 (10자 이내)\n이력 4줄: 연도 / 내용 ${REAL}`,
      draw: (c) => {
        c.header('HISTORY', '걸어온 길');
        [0, 1, 2, 3].forEach((i) => {
          const top = c.y;
          const year = c.textAt('[연도]', X, top, 180, 36, { weight: 800, ...c.accent(), align: 'left', name: 'label', fontFamily: c.t.font.heading });
          const text = c.textAt('[수상·선정·출연 이력을 적어 주세요]', X + 200, top + 4, CW - 200, SIZE.small, { align: 'left', lineHeight: 1.5, name: 'list_item' });
          c.y = Math.max(bottomOf(year), bottomOf(text)) + 28;
          if (i < 3) divider(c, 28);
        });
        return 90;
      },
    },
    {
      key: 'list',
      name: '후기 목록',
      guide: `메인 카피 (15자 이내)\n후기 3개: 별점 / 구매 옵션 / 원문 / 작성자·날짜 ${REAL}`,
      draw: (c) => {
        c.header('REVIEW', '실제 구매 후기');
        divider(c, 32);
        [0, 1, 2].forEach(() => {
          const top = c.y;
          stars(c, X, top, 200, 'left', 24);
          c.textAt('[구매 옵션]', X + 200, top + 2, CW - 200, SIZE.fine, { color: c.muted, align: 'right', name: 'label' });
          const body = c.textAt(REVIEW, X, top + 46, CW, SIZE.small, { align: 'left', lineHeight: 1.6, name: 'list_item' });
          const who = c.textAt('[작성자] · [작성일]', X, bottomOf(body) + 14, CW, SIZE.fine, { color: c.muted, align: 'left', name: 'label' });
          c.y = bottomOf(who) + 32;
          divider(c, 32);
        });
        return 70;
      },
    },
    {
      key: 'repeat',
      name: '재구매 이야기',
      guide: `메인 카피 (15자 이내)\n같은 고객의 첫 구매 후기 → 재구매 후기 (원문 그대로) ${REAL}`,
      draw: (c) => {
        c.header('REPURCHASE', '또 찾아 주셨어요');
        cardRow(
          c,
          1,
          (_, x, w, top) => {
            let y = top;
            ['첫 구매', '재구매'].forEach((tag, i) => {
              const bg = c.badge(tag, x, y, 150, 50, { radius: c.t.radius.chip, size: SIZE.fine, name: 'label' });
              const body = c.textAt(REVIEW, x, y + Number(bg.height) + 18, w, SIZE.small, { align: 'left', lineHeight: 1.6, name: 'list_item' });
              y = bottomOf(body);
              if (!i) {
                c.textAt('↓', x, y + 16, 60, 40, { weight: 800, ...c.accent(), align: 'left', name: 'badge' });
                y += 84;
              }
            });
            return bottomOf(c.textAt('[작성자] · 재구매 [0]회', x, y + 20, w, SIZE.fine, { color: c.muted, align: 'right', name: 'label' }));
          },
          { pad: 44 },
        );
        return 70;
      },
    },
  ],
};
