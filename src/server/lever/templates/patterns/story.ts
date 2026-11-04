import { CW, SIZE, W, X } from '../canvas';
import { bottomOf, cardRow, disc, divider, titled, titledAt, type PatternGroup } from './kit';

const FACT_NOTE = '(확인된 사실만, 지어내지 않기)';

export const STORY: PatternGroup = {
  key: 'story',
  part2: '호기심 유발',
  patterns: [
    {
      key: 'timeline',
      name: '한 해 재배 일지',
      guide: `메인 카피 (15자 이내)\n시기 4개: 시기 + 한 일 제목 + 설명 1문장 ${FACT_NOTE}`,
      draw: (c) => {
        c.header('STORY', '한 해 동안\n이렇게 키웠어요');
        const steps = [['[봄]', '꽃을 솎아 내요', '[이 시기에 하는 일을 적어 주세요]'], ['[여름]', '햇볕을 고르게', '[이 시기에 하는 일을 적어 주세요]'], ['[가을]', '익은 것만 수확', '[이 시기에 하는 일을 적어 주세요]'], ['[겨울]', '나무를 쉬게 해요', '[이 시기에 하는 일을 적어 주세요]']];
        const lineAt = c.nodes.length;
        const tops: number[] = [];
        for (const [when, title, text] of steps) {
          const top = c.y;
          tops.push(top);
          c.accentBox(X, top + 4, 36, 36, { cornerRadius: c.t.radius.chip ? 18 : 0, name: 'dot' });
          c.textAt(when, X + 72, top, 300, SIZE.caption, { weight: 700, ...c.accent(), align: 'left', name: 'label' });
          c.y = top + 40;
          titled(c, title, text, { x: X + 72, width: CW - 72, align: 'left', gap: 48 });
        }
        c.boxBehind(lineAt, X + 16, tops[0] + 22, 4, tops[tops.length - 1] - tops[0], c.palette.point, { colorVar: 'point', name: 'connector' });
        return 60;
      },
    },
    {
      key: 'interview',
      name: '생산자 인터뷰',
      guide: `생산자 사진 (얼굴 또는 손·작업 모습)\n이름·농장\n질문 2개 + 답 (답은 생산자가 실제로 한 말) ${FACT_NOTE}`,
      draw: (c) => {
        c.header('INTERVIEW', '농부에게\n물었어요');
        const d = 240;
        c.slot(c.alignX(d), c.y, d, d, d / 2);
        c.space(d + 24);
        c.text('[농장 이름] [이름] 농부', SIZE.small, { weight: 700, name: 'label', gap: 56 });
        const qa = [['Q. 가장 신경 쓰는 건 무엇인가요?', 'A. [생산자의 답을 그대로 옮겨 적어 주세요]'], ['Q. 언제 수확하나요?', 'A. [생산자의 답을 그대로 옮겨 적어 주세요]']];
        for (const [q, a] of qa) {
          c.text(q, SIZE.itemTitle, { weight: 700, ...c.accent(), name: 'list_title', gap: 14 });
          c.text(a, SIZE.body, { lineHeight: 1.65, name: 'list_item', gap: 44 });
        }
        return 70;
      },
    },
    {
      key: 'origin',
      name: '산지 소개 카드',
      guide: `지역명 (크게)\n산지 한 줄 소개\n가로 사진: 밭·과수원 풍경\n정보 4줄: 재배 방식·토양/기후·수확 시기·재배 경력 ${FACT_NOTE}`,
      draw: (c) => {
        c.label('ORIGIN');
        c.heading('[지역명]', 96, { lineHeight: 1.15, name: 'main_copy', gap: 20 });
        c.text('[산지를 한 줄로 소개해 주세요]', SIZE.sub, { color: c.muted, name: 'sub_copy', gap: 56 });
        c.slot(0, c.y, W, 560, 0);
        c.space(560 + 40);
        const rows = [['재배 방식', '[재배 방식]'], ['토양·기후', '[토양·기후]'], ['수확 시기', '[수확 시기]'], ['재배 경력', '[경력]']];
        rows.forEach(([k, v]) => {
          const top = c.y;
          const a = c.textAt(k, X, top + 24, 220, SIZE.small, { weight: 700, align: 'left', name: 'list_title' });
          const b = c.textAt(v, X + 240, top + 24, CW - 240, SIZE.small, { color: c.muted, align: 'left', name: 'list_item' });
          c.y = Math.max(bottomOf(a), bottomOf(b)) + 24;
          divider(c);
        });
        return 90;
      },
    },
    {
      key: 'magazine',
      name: '왼쪽 사진 · 오른쪽 글',
      guide: `세로 사진 1장\n제목 (3줄, 줄당 6자 이내)\n문단 2개 (각 2~3문장) ${FACT_NOTE}`,
      draw: (c) => {
        c.y = 110;
        const top = c.y;
        const col = { x: X + 380, width: CW - 380, align: 'left' as const };
        c.slot(X, top, 340, 640);
        c.text('STORY', SIZE.caption, { ...col, weight: 700, ...c.accent(), letterSpacing: 3, name: 'label', gap: 20 });
        c.heading('이 맛이\n만들어지기\n까지', 48, { ...col, name: 'main_copy', gap: 32 });
        c.text('이 상품을 만들게 된 이유를 두세 문장으로 적어 주세요.', SIZE.small, { ...col, color: c.muted, lineHeight: 1.7, name: 'list_item', gap: 24 });
        c.text('만드는 과정에서 지키는 원칙을 적어 주세요.', SIZE.small, { ...col, color: c.muted, lineHeight: 1.7, name: 'list_item', gap: 0 });
        c.y = Math.max(c.y, top + 640);
        return 110;
      },
    },
    {
      key: 'reasons',
      name: '맛있는 이유 3가지',
      guide: `메인 카피 (15자 이내)\n이유 3개: 제목 10자 + 설명 1문장 ${FACT_NOTE}`,
      draw: (c) => {
        c.header('REASON', '맛있는 데는\n이유가 있어요');
        const items = [['[이유 하나]', '재배 환경·품종 등 맛의 근거를 적어 주세요.'], ['[이유 둘]', '수확·선별 방법을 적어 주세요.'], ['[이유 셋]', '배송·보관 방법을 적어 주세요.']];
        items.forEach(([title, text], i) => {
          disc(c, String(i + 1), c.alignX(88), c.y, 88, 36);
          c.space(88 + 24);
          titled(c, title, text, { gap: 64 });
        });
        return 50;
      },
    },
    {
      key: 'process',
      name: '과정 4컷',
      guide: `메인 카피 (15자 이내)\n사진 4장: 재배 → 수확 → 선별 → 포장 순서\n단계 이름 4개 (각 6자 이내) ${FACT_NOTE}`,
      draw: (c) => {
        c.header('PROCESS', '밭에서 상자까지', '하나하나 손으로 확인해요');
        const steps = ['재배', '수확', '선별', '포장'];
        cardRow(
          c,
          4,
          (i, x, w, top) => {
            c.slot(x, top, w, 220);
            c.textAt(`STEP ${i + 1}`, x, top + 240, w, SIZE.fine, { weight: 700, ...c.accent(), letterSpacing: 2, name: 'label' });
            return bottomOf(c.textAt(steps[i], x, top + 276, w, SIZE.small, { weight: 700, name: 'list_title' }));
          },
          { bare: true, gap: 20, after: 0 },
        );
        return 100;
      },
    },
    {
      key: 'letter',
      name: '농부의 편지',
      guide: `편지 제목\n본문 3문단 (생산자가 직접 쓴 말투로) ${FACT_NOTE}\n서명: 농장 이름·이름`,
      draw: (c) => {
        c.header('LETTER', '농부의 편지');
        cardRow(
          c,
          1,
          (_, x, w, top) => {
            let y = top;
            for (const value of ['안녕하세요, [농장 이름]입니다.', '[어떤 마음으로 키우는지 적어 주세요]', '[받는 분께 전하고 싶은 말을 적어 주세요]']) {
              y = bottomOf(c.textAt(value, x, y, w, SIZE.body, { align: 'left', lineHeight: 1.9, name: 'list_item' })) + 28;
            }
            return bottomOf(c.textAt('[농장 이름] [이름] 드림', x, y + 20, w, SIZE.small, { weight: 700, align: 'right', name: 'label' }));
          },
          { pad: 56 },
        );
        return 70;
      },
    },
    {
      key: 'caption',
      name: '큰 사진 + 인용',
      guide: `화면을 꽉 채운 산지 사진\n인용 한 문장 (생산자의 실제 말, 25자 이내)\n설명 1~2문장 ${FACT_NOTE}`,
      draw: (c) => {
        c.y = 0;
        c.slot(0, 0, W, 1040, 0);
        c.y = 1040 + 80;
        const top = c.y;
        c.heading('“[생산자가 실제로 한 말을\n옮겨 적어 주세요]”', 44, { x: X + 36, width: CW - 36, align: 'left', name: 'main_copy', gap: 20 });
        c.text('— [농장 이름] [이름] 농부', SIZE.small, { x: X + 36, width: CW - 36, color: c.muted, align: 'left', name: 'label', gap: 0 });
        c.accentBox(X, top, 6, c.y - top, { name: 'quote_bar' });
        c.space(56);
        c.text('사진 속 장소와 그곳에서 하는 일을 한두 문장으로 적어 주세요.', SIZE.body, { lineHeight: 1.7, align: 'left', name: 'list_item', gap: 0 });
        return 110;
      },
    },
    {
      key: 'harvestship',
      name: '수확에서 출고까지',
      guide: `메인 카피 (12자 이내)\n단계 3개: 수확 → 선별 → 출고 (각 제목 8자 + 실제 기준 1문장) ${FACT_NOTE}\n아래 사진: 수확·포장 중 한 장면`,
      draw: (c) => {
        c.header('FRESH PATH', '수확한 그날\n바로 보내요');
        const steps = [
          ['수확', '[수확 시각·방식]'],
          ['선별', '[선별 기준]'],
          ['출고', '[출고·택배 기준]'],
        ];
        steps.forEach(([title, text], i) => {
          const top = c.y;
          disc(c, String(i + 1), X, top, 72, 28);
          const end = titledAt(c, title, text, X + 100, top + 8, CW - 100, { titleSize: 36, textSize: SIZE.small });
          c.y = Math.max(top + 72, end) + 28;
          if (i < steps.length - 1) {
            c.box(X + 34, c.y - 20, 4, 28, c.line, { name: 'divider' });
            c.space(12);
          }
        });
        c.space(36);
        c.slot(X, c.y, CW, 480);
        c.space(480);
        return 90;
      },
    },
    {
      key: 'day',
      name: '농장의 하루',
      guide: `메인 카피 (10자 이내)\n시간 4개: 시각 + 하는 일 + 설명 1문장 ${FACT_NOTE}`,
      draw: (c) => {
        c.header('A DAY', '농장의 하루');
        const rows = [['[05:00]', '해 뜨기 전 수확'], ['[09:00]', '한 알씩 선별'], ['[13:00]', '꼼꼼하게 포장'], ['[17:00]', '그날 바로 출고']];
        rows.forEach(([time, title], i) => {
          const top = c.y;
          const t = c.textAt(time, X, top, 180, 40, { weight: 800, ...c.accent(), align: 'left', name: 'label', fontFamily: c.t.font.heading });
          const end = titledAt(c, title, '[이 시간에 하는 일을 한 문장으로 적어 주세요]', X + 200, top + 4, CW - 200, { titleSize: 32, textSize: SIZE.small });
          c.y = Math.max(bottomOf(t), end) + 32;
          if (i < rows.length - 1) divider(c, 32);
        });
        return 80;
      },
    },
  ],
};
