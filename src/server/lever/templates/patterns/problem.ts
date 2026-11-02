import { CW, SIZE, W, X } from '../canvas';
import { accentFill, bottomOf, cardRow, disc, divider, onAccent, outline, overlay, titled, type PatternGroup } from './kit';

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
      key: 'stat',
      name: '숫자로 짚는 고민',
      guide: '큰 숫자: 출처가 있는 조사 결과만 (없으면 이 템플릿을 쓰지 마세요)\n설명 (25자 이내)\n출처: 기관·연도',
      draw: (c) => {
        c.header('DATA', '많은 분들이\n같은 고민을 해요');
        c.text('10명 중 [0]명', 96, { weight: 900, ...c.accent(), lineHeight: 1.15, name: 'badge', fontFamily: c.t.font.heading, gap: 20 });
        c.heading('[어떤 고민을 겪는지 적어 주세요]', 40, { name: 'list_title', gap: 16 });
        c.text('출처: [조사 기관·연도]', SIZE.caption, { color: c.muted, name: 'list_item', gap: 56 });
        c.slot(X, c.y, CW, 520);
        c.space(520);
        return 100;
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
      key: 'chat',
      name: '대화형',
      guide: '고객 말풍선 2개: 고객이 실제로 하는 말 (각 25자 이내)\n판매자 말풍선 1개: 해결을 약속하는 한마디 (30자 이내)',
      draw: (c) => {
        c.header('TALK', '이런 이야기,\n자주 들어요');
        const bubble = (value: string, who: string, mine: boolean) => {
          const w = 560;
          const x = mine ? W - X - w : X;
          // 꼬리가 말한 사람 이름 쪽(왼쪽 위 / 오른쪽 위)을 가리킨다
          const tail = { side: 'top' as const, at: mine ? w - 48 : 48, size: 16 };
          c.textAt(who, x, c.y, w, SIZE.caption, { color: c.muted, align: mine ? 'right' : 'left', name: 'label' });
          c.space(52);
          if (!mine) {
            cardRow(c, 1, (_, ix, iw, top) => bottomOf(c.textAt(value, ix, top, iw, SIZE.body, { align: 'left', lineHeight: 1.5, name: 'list_item' })), { x, width: w, pad: 32, after: 32, tail });
            return;
          }
          const start = c.nodes.length;
          const t = c.textAt(value, x + 32, c.y + 32, w - 64, SIZE.body, { weight: 700, align: 'left', lineHeight: 1.5, name: 'main_copy', ...onAccent(c) });
          const h = Number(t.height) + 64;
          accentFill(c, start, x, c.y, w, h, c.t.radius.card, tail);
          c.space(h + 32);
        };
        bubble('과일은 사진이랑 다를까 봐\n온라인으로 사기 망설여져요', '고객', false);
        bubble('지난번엔 반 넘게 물러서\n결국 버렸어요', '고객', false);
        bubble('그래서 저희는 [선별 기준]으로\n한 알씩 골라 보내요', '농부', true);
        return 80;
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