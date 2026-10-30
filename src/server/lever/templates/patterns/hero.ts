import { CW, SIZE, W, X } from '../canvas';
import { WHITE } from '../nodes';
import { bottomOf, cardRow, chips, columns, disc, outline, type PatternGroup } from './kit';

const BENEFITS = ['핵심 혜택 1', '핵심 혜택 2', '핵심 혜택 3'];
const SUB = '상품을 한 문장으로 소개하는 서브 문구';
const GUIDE = '라벨: 브랜드·산지 (10자 이내)\n메인 카피: 기능이 아니라 고객이 얻는 결과 (2~3줄, 줄당 8자 이내)\n서브 카피 (25자 내외)\n혜택 배지 3개 (각 8자 이내)';

export const HERO: PatternGroup = {
  key: 'hero',
  part2: '메인 비주얼',
  patterns: [
    {
      key: 'split',
      name: '반반 분할',
      guide: `왼쪽: 세로로 긴 대표 사진\n${GUIDE}`,
      draw: (c) => {
        const H = 1180;
        const col = { x: 470, width: W - 470 - 50, align: 'left' as const };
        c.slot(0, 0, 430, H, 0);
        c.y = 170;
        c.text('BRAND NAME', SIZE.caption, { ...col, weight: 700, ...c.accent(), letterSpacing: 2, name: 'label', gap: 28 });
        c.heading('산지에서\n바로 온\n제철의 맛', 64, { ...col, name: 'main_copy', gap: 28 });
        c.text(SUB, SIZE.small, { ...col, color: c.muted, lineHeight: 1.6, name: 'sub_copy', gap: 56 });
        for (const value of BENEFITS) {
          const bg = c.badge(value, col.x, c.y, col.width, 64, { radius: c.t.radius.chip, size: SIZE.caption });
          c.space(Number(bg.height) + 14);
        }
        c.y = Math.max(c.y + 60, H);
        return 0;
      },
    },
    {
      key: 'stat',
      name: '숫자 강조',
      guide: `큰 숫자: 확인된 수치만 (당도·수확 후 발송 시간 등)\n숫자 설명 (20자 이내)\n${GUIDE}`,
      draw: (c) => {
        c.label('BRAND NAME', 12);
        c.text('[00]', 180, { weight: 900, ...c.accent(), lineHeight: 1.1, name: 'badge', fontFamily: c.t.font.heading, gap: 0 });
        c.text('[숫자 설명] 예: 평균 당도(Brix)', SIZE.small, { color: c.muted, name: 'sub_copy', gap: 56 });
        c.heading('숫자로 확인하는\n제철의 맛', SIZE.heroTitle, { name: 'main_copy', gap: 64 });
        c.slot(0, c.y, W, 760, 0);
        c.space(760 + 56);
        chips(c, BENEFITS);
        return 100;
      },
    },
    {
      key: 'cover',
      name: '매거진 표지',
      guide: `위 줄: 브랜드 / 시즌\n메인 카피 (2줄, 줄당 6자 이내)\n표지 사진\n아래 정보 3칸: 산지·수확·중량 (사실 그대로)`,
      draw: (c) => {
        c.y = 70;
        c.textAt('BRAND NAME', X, c.y, 360, SIZE.caption, { weight: 800, align: 'left', letterSpacing: 3, name: 'label' });
        c.textAt('[2026] SEASON', W - X - 360, c.y, 360, SIZE.caption, { weight: 700, color: c.muted, align: 'right', letterSpacing: 2, name: 'label' });
        c.space(52);
        c.box(X, c.y, CW, 2, c.ink, { name: 'divider' });
        c.space(56);
        c.heading('계절이\n익혀 낸 맛', 104, { align: 'left', lineHeight: 1.15, name: 'main_copy', gap: 48 });
        c.slot(X, c.y, CW, 860);
        c.space(860 + 48);
        const top = c.y;
        let bottom = top;
        const infos = [['산지', '[지역]'], ['수확', '[수확 시기]'], ['중량', '[중량]']];
        columns(3, 0).forEach(({ x, w }, i) => {
          if (i) c.box(x, top, 1, 96, c.line, { name: 'divider' });
          c.textAt(infos[i][0], x, top, w, SIZE.caption, { color: c.muted, name: 'list_title' });
          bottom = Math.max(bottom, bottomOf(c.textAt(infos[i][1], x, top + 40, w, SIZE.small, { weight: 700, name: 'list_item' })));
        });
        c.y = bottom;
        return 100;
      },
    },
    {
      key: 'stamp',
      name: '원형 스탬프',
      guide: `${GUIDE}\n원형 스탬프: 산지직송·당일 수확처럼 사실인 한 마디 (4자 2줄)`,
      draw: (c) => {
        c.header('BRAND NAME', '받는 날까지\n싱싱하게', SUB, SIZE.heroTitle);
        const top = c.y;
        c.slot(0, top, W, 900, 0);
        disc(c, '산지\n직송', W - X - 200, top + 48, 200, 36);
        c.y = top + 900 + 56;
        chips(c, BENEFITS);
        return 100;
      },
    },
    {
      key: 'band',
      name: '사진 + 색 띠',
      guide: `위: 화면을 꽉 채운 대표 사진\n색 띠 안: ${GUIDE}`,
      draw: (c) => {
        c.y = 0;
        c.slot(0, 0, W, 960, 0);
        const top = 960;
        const start = c.nodes.length;
        const wasDark = c.dark;
        c.dark = !wasDark;
        c.y = top + 90;
        c.header('BRAND NAME', '고객이 얻는 결과를\n한 줄로 보여 주세요', SUB, SIZE.heroTitle);
        const h = c.y - top + 26;
        if (wasDark) c.boxBehind(start, 0, top, W, h, WHITE, { name: 'band' });
        else c.boxBehind(start, 0, top, W, h, c.palette.main, { name: 'band', colorVar: 'main' });
        c.dark = wasDark;
        c.y = top + h + 64;
        chips(c, BENEFITS);
        return 100;
      },
    },
    {
      key: 'spotlight',
      name: '원형 상품 사진',
      guide: `${GUIDE}\n가운데 원형 사진: 배경 없이 상품만 보이는 컷`,
      draw: (c) => {
        c.header('BRAND NAME', '한 알 한 알\n골라 담았어요', SUB, SIZE.heroTitle);
        const d = 600;
        c.slot((W - d) / 2, c.y, d, d, d / 2);
        c.space(d + 64);
        chips(c, BENEFITS);
        return 110;
      },
    },
    {
      key: 'collage',
      name: '사진 3장 콜라주',
      guide: `사진 3장: 큰 사진(전체 모습) + 작은 사진 2장(단면·디테일)\n${GUIDE}`,
      draw: (c) => {
        c.y = 80;
        const top = c.y;
        c.slot(X, top, 470, 720);
        c.slot(X + 490, top, 250, 350);
        c.slot(X + 490, top + 370, 250, 350);
        c.y = top + 720 + 72;
        c.header('BRAND NAME', '보기만 해도\n싱그러운 한 상자', SUB, SIZE.heroTitle);
        chips(c, BENEFITS);
        return 100;
      },
    },
    {
      key: 'checks',
      name: '체크 혜택',
      guide: `${GUIDE}\n체크 3줄: 혜택을 한 줄 문장으로 (각 15자 이내)`,
      draw: (c) => {
        c.header('BRAND NAME', '고민 없이 고르는\n제철 한 상자', SUB, SIZE.heroTitle);
        c.slot(0, c.y, W, 760, 0);
        c.space(760 + 48);
        cardRow(
          c,
          1,
          (_, x, w, top) => {
            let y = top;
            for (const value of BENEFITS) {
              disc(c, '✓', x, y, 48, 24);
              const t = c.textAt(`${value}을 한 줄로 적어 주세요`, x + 72, y + 6, w - 72, SIZE.body, { weight: 700, align: 'left', name: 'list_item' });
              y = Math.max(y + 48, bottomOf(t)) + 24;
            }
            return y - 24;
          },
          { pad: 40 },
        );
        return 70;
      },
    },
    {
      key: 'season',
      name: '제철 달력',
      guide: `라벨 SEASON\n메인 카피 (2줄)\n서브 카피: 수확 시기 (사실 그대로)\n달력: 강조한 달을 실제 수확 달로 바꿔 주세요\n대표 사진`,
      draw: (c) => {
        c.header('SEASON', '지금이 가장\n맛있을 때', '[수확 시기]에만 만날 수 있는 맛', SIZE.heroTitle);
        const harvest = new Set([9, 10, 11]);
        const cells = columns(6, 12);
        for (let row = 0; row < 2; row++) {
          cells.forEach(({ x, w }, col) => {
            const month = row * 6 + col;
            const label = `${month + 1}월`;
            if (harvest.has(month)) c.badge(label, x, c.y, w, 64, { radius: c.t.radius.chip, size: SIZE.caption });
            else {
              outline(c, x, c.y, w, 64);
              c.textAt(label, x, c.y + 17, w, SIZE.caption, { color: c.muted, name: 'list_item' });
            }
          });
          c.space(64 + 12);
        }
        c.space(48);
        c.slot(0, c.y, W, 760, 0);
        c.space(760);
        return 0;
      },
    },
    {
      key: 'panorama',
      name: '큰 글씨 + 가로 사진',
      guide: `메인 카피: 아주 짧게 (2줄, 줄당 5자 이내)\n가로로 긴 사진 (풍경·밭)\n${GUIDE}`,
      draw: (c) => {
        c.y = 140;
        c.text('BRAND NAME', SIZE.label, { weight: 700, ...c.accent(), letterSpacing: 4, name: 'label', gap: 36 });
        c.heading('오늘\n수확한 맛', 120, { lineHeight: 1.1, name: 'main_copy', gap: 64 });
        c.slot(0, c.y, W, 520, 0);
        c.space(520 + 56);
        c.text(SUB, SIZE.sub, { color: c.muted, lineHeight: 1.6, name: 'sub_copy', gap: 48 });
        chips(c, BENEFITS);
        return 110;
      },
    },
  ],
};
