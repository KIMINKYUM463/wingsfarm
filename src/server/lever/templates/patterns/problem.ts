import { CW, SIZE, W, X } from '../canvas';
import { bottomOf, cardRow, disc, divider, outline, overlay, titled, titledAt, type PatternGroup } from './kit';

const PAINS = ['마트에서 산 과일이\n생각보다 싱거웠어요', '상자를 열어 보니\n무른 게 섞여 있었어요', '선물하기엔\n모양이 들쭉날쭉했어요'];
const GUIDE = '메인 카피: 고객의 고민을 질문형으로 (15자 이내)\n고민 3개: 고객이 실제로 겪는 불편을 고객 말투로 (각 2줄 이내)';

export const PROBLEM: PatternGroup = {
  key: 'problem',
  part2: '문제 제기',
  patterns: [
    {
      key: 'bubbles',
      name: '말풍선 고민',
      guide: GUIDE,
      draw: (c) => {
        c.header('WHY', '이런 고민,\n있으셨죠?');
        PAINS.forEach((value, i) => {
          const w = 560;
          const right = i % 2 === 1;
          cardRow(c, 1, (_, x, iw, top) => bottomOf(c.textAt(value, x, top, iw, SIZE.body, { align: 'left', lineHeight: 1.5, name: 'list_item' })), {
            x: right ? W - X - w : X,
            width: w,
            pad: 36,
            after: 40,
            // 지그재그로 놓인 말풍선 꼬리가 바깥쪽 아래를 가리킨다
            tail: { side: 'bottom', at: right ? w - 56 : 56, size: 16 },
          });
        });
        return 90;
      },
    },
    {
      key: 'checklist',
      name: '체크리스트',
      guide: '메인 카피: "이런 분께 필요해요" 형식 (15자 이내)\n체크 5줄: 고객 상황 (각 20자 이내)',
      draw: (c) => {
        c.header('CHECK', '이런 분께\n꼭 필요해요');
        const rows = ['제철 과일을 제대로 맛보고 싶은 분', '산지에서 바로 받고 싶은 분', '아이 간식을 고민하는 분', '부모님 선물을 찾는 분', '한 번 사서 넉넉히 두고 먹는 분'];
        cardRow(
          c,
          1,
          (_, x, w, top) => {
            let y = top;
            rows.forEach((value, i) => {
              outline(c, x, y, 44, 44, 8, true);
              c.textAt('✓', x, y + 4, 44, 28, { weight: 800, ...c.accent(), name: 'badge' });
              const t = c.textAt(value, x + 68, y + 4, w - 68, SIZE.body, { align: 'left', name: 'list_item' });
              y = Math.max(y + 44, bottomOf(t)) + 22;
              if (i < rows.length - 1) {
                c.box(x, y, w, 1, c.line, { name: 'divider' });
                y += 23;
              }
            });
            return y - 22;
          },
          { pad: 44 },
        );
        return 70;
      },
    },
    {
      key: 'xmarks',
      name: '고민 → 해결 한 줄',
      guide: `${GUIDE}\n해결 문장: 이 상품이 그 고민을 어떻게 덜어 주는지 (25자 이내)`,
      draw: (c) => {
        c.header('PROBLEM', '이런 경험\n한 번쯤 있으시죠?');
        for (const value of PAINS) {
          const top = c.y;
          disc(c, '✕', X, top, 52, 26);
          const t = c.textAt(value.replace('\n', ' '), X + 76, top + 8, CW - 76, SIZE.body, { color: c.muted, align: 'left', name: 'list_item' });
          c.y = Math.max(top + 52, bottomOf(t)) + 28;
        }
        c.space(12);
        c.text('↓', 56, { weight: 800, ...c.accent(), align: 'center', name: 'badge', gap: 24 });
        const bg = c.badge('그래서 [상품명]을 준비했어요', X, c.y, CW, 110, { radius: c.t.radius.card, size: 34, name: 'main_copy' });
        c.space(Number(bg.height));
        return 100;
      },
    },
    {
      key: 'quote',
      name: '큰 따옴표 한마디',
      guide: '큰 인용: 고객이 자주 하는 말 한 문장 (25자 이내)\n출처 한 줄\n아래 사진: 고민이 드러나는 장면',
      draw: (c) => {
        c.y = 100;
        c.text('“', 200, { weight: 900, ...c.accent(), lineHeight: 0.9, name: 'badge', fontFamily: c.t.font.heading, gap: 0 });
        c.heading('맛있는 과일 고르기,\n왜 이렇게 어려울까요?', 52, { name: 'main_copy', gap: 28 });
        c.text('— 구매 전 고객들이 가장 많이 한 말', SIZE.small, { color: c.muted, name: 'sub_copy', gap: 64 });
        c.slot(X, c.y, CW, 620);
        c.space(620);
        return 100;
      },
    },
    {
      key: 'numbered',
      name: '번호 고민',
      guide: `${GUIDE}\n각 고민: 제목 10자 + 설명 1문장`,
      draw: (c) => {
        c.header('WORRY', '이런 점이\n걱정되셨죠?');
        const items = [['맛이 들쭉날쭉', '상자마다 맛이 달라 믿고 사기 어려웠어요.'], ['배송 중 상처', '받고 보니 눌리고 무른 과일이 섞여 있었어요.'], ['애매한 크기', '사진만 보고는 크기를 가늠하기 어려웠어요.']];
        items.forEach(([title, text], i) => {
          const top = c.y;
          c.textAt(String(i + 1).padStart(2, '0'), X, top - 6, 120, 72, { weight: 900, ...c.accent(), align: 'left', name: 'badge', fontFamily: c.t.font.heading });
          c.y = top;
          titled(c, title, text, { x: X + 140, width: CW - 140, align: 'left', gap: 36 });
          if (i < items.length - 1) divider(c, 40);
        });
        return 80;
      },
    },
    {
      key: 'household',
      name: '가구별 추천',
      guide: '메인 카피 (15자 이내)\n카드 3개: 가구·상황 (6자) + 맞는 옵션 (10자) + 이유 1문장 (20자 이내, 입력한 옵션 그대로)',
      draw: (c) => {
        c.header('FOR YOU', '우리 집엔\n어떤 게 맞을까요?');
        const rows = [
          ['1~2인 가구', '[소용량 옵션]', '남기지 않고 신선할 때 다 먹어요'],
          ['3~4인 가족', '[기본 옵션]', '주말 식탁과 아이 간식까지 넉넉해요'],
          ['선물·명절', '[선물 옵션]', '선물 포장으로 바로 보내기 좋아요'],
        ];
        rows.forEach(([who, option, why], i) => {
          cardRow(
            c,
            1,
            (_, x, w, top) => {
              disc(c, String(i + 1), x, top, 64, 28);
              const t = c.textAt(who, x + 92, top - 2, w - 92, SIZE.caption, { weight: 700, color: c.muted, align: 'left', name: 'label' });
              const o = c.textAt(option, x + 92, bottomOf(t) + 6, w - 92, SIZE.itemTitle, { weight: 800, align: 'left', name: 'list_title', fontFamily: c.t.font.heading });
              return bottomOf(c.textAt(why, x + 92, bottomOf(o) + 10, w - 92, SIZE.small, { color: c.muted, align: 'left', lineHeight: 1.5, name: 'list_item' }));
            },
            { pad: 40, after: i < rows.length - 1 ? 20 : 40 },
          );
        });
        return 70;
      },
    },
    {
      key: 'photogrid',
      name: '상황 사진 2×2',
      guide: '메인 카피 (15자 이내)\n사진 4장: 고객이 불편을 겪는 장면\n사진 설명 4개 (각 15자 이내)',
      draw: (c) => {
        c.header('SCENE', '혹시 이런 장면,\n익숙하신가요?');
        const captions = ['싱거운 맛에 실망', '눌리고 무른 과일', '들쭉날쭉한 크기', '금방 상해 버린 과일'];
        for (let row = 0; row < 2; row++) {
          cardRow(
            c,
            2,
            (i, x, w, top) => {
              c.slot(x, top, w, 300);
              return bottomOf(c.textAt(captions[row * 2 + i], x, top + 320, w, SIZE.small, { weight: 700, name: 'list_item' }));
            },
            { bare: true, after: 44 },
          );
        }
        return 70;
      },
    },
    {
      key: 'moments',
      name: '이런 순간에',
      guide: '메인 카피 (15자 이내)\n사진 3장: 먹는·나누는 장면\n장면마다 제목 (10자) + 한 문장 (22자 이내)',
      draw: (c) => {
        c.header('MOMENT', '이럴 때\n꺼내 드세요');
        const rows = [
          ['아침 식탁에', '썰어 두기만 해도 근사한 한 접시'],
          ['아이 간식으로', '껍질째 한 입, 손에 묻지 않게'],
          ['손님 맞이에', '상자째 내놓아도 넉넉한 양'],
        ];
        rows.forEach(([title, text], i) => {
          const top = c.y;
          const size = 300;
          const photoX = i % 2 ? W - X - size : X;
          const textX = i % 2 ? X : X + size + 40;
          c.slot(photoX, top, size, size);
          const end = titledAt(c, title, text, textX, top + 90, CW - size - 40, { titleSize: SIZE.itemTitle, textSize: SIZE.small });
          c.y = Math.max(top + size, end) + 40;
        });
        return 70;
      },
    },
    {
      key: 'dim',
      name: '어두운 사진 위 질문',
      guide: '사진: 고민이 드러나는 장면 (글자가 올라가니 단순한 컷)\n질문 (2줄, 줄당 10자 이내)\n아래 고민 2개: 제목 + 설명',
      draw: (c) => {
        const H = 1000;
        c.y = 0;
        overlay(c, 0, 0, W, H, () => {
          c.y = 380;
          c.header('WHY', '혹시 이런 경험\n있으신가요?', '고객이 겪는 불편을 한 문장으로 짚어 주세요');
        });
        c.y = H + 80;
        titled(c, '고민 하나', '고객이 실제로 느끼는 불편을 구체적으로 적어 주세요.');
        titled(c, '고민 둘', '그 불편 때문에 생기는 상황을 적어 주세요.', { gap: 0 });
        return 100;
      },
    },
    {
      key: 'beforeafter',
      name: '지금 vs 바뀐 뒤',
      guide: '왼쪽: 지금 겪는 고민 3줄\n오른쪽: 이 상품으로 바뀌는 점 3줄 (사실만, 과장 금지)',
      draw: (c) => {
        c.header('CHANGE', '고민이 이렇게\n달라져요');
        const sides = [
          { tag: '지금은', lines: ['맛이 들쭉날쭉', '받으면 무른 과일', '크기 가늠이 어려움'] },
          { tag: '이제는', lines: ['[선별 기준]으로 고른 맛', '[포장 방법]으로 안전하게', '[크기 기준] 안내'] },
        ];
        cardRow(
          c,
          2,
          (i, x, w, top) => {
            const side = sides[i];
            const tag = i ? c.badge(side.tag, x, top, 140, 52, { radius: c.t.radius.chip, size: SIZE.caption, name: 'label' }) : outline(c, x, top, 140, 52);
            if (!i) c.textAt(side.tag, x, top + 12, 140, SIZE.caption, { weight: 700, color: c.muted, name: 'label' });
            let y = top + Number(tag.height) + 28;
            for (const line of side.lines) {
              const t = c.textAt(`· ${line}`, x, y, w, SIZE.small, { align: 'left', weight: i ? 700 : 400, color: i ? c.ink : c.muted, name: 'list_item' });
              y = bottomOf(t) + 16;
            }
            return y - 16;
          },
          { pad: 36 },
        );
        return 70;
      },
    },
  ],
};