import { CW, SIZE, W, X } from '../canvas';
import { bottomOf, button, cardRow, columns, disc, divider, outline, overlay, titledAt, type PatternGroup } from './kit';

const SELLER = '(판매 정보 그대로)';

export const PURCHASE: PatternGroup = {
  key: 'purchase',
  part2: '구매 안내',
  patterns: [
    {
      key: 'week',
      name: '출고 요일',
      guide: `메인 카피 (12자 이내)\n출고 요일: 강조한 요일을 실제 출고일로 바꿔 주세요\n안내 2줄: 주문 마감 시각·휴무 ${SELLER}`,
      draw: (c) => {
        c.header('SHIPPING', '출고 요일 안내');
        const days = ['월', '화', '수', '목', '금', '토', '일'];
        const ship = new Set([0, 1, 2, 3]);
        columns(7, 10).forEach(({ x, w }, i) => {
          if (ship.has(i)) c.badge(days[i], x, c.y, w, 96, { radius: c.t.radius.card ? 16 : 0, size: SIZE.small });
          else {
            outline(c, x, c.y, w, 96, c.t.radius.card ? 16 : 0);
            c.textAt(days[i], x, c.y + 30, w, SIZE.small, { color: c.muted, name: 'list_item' });
          }
        });
        c.space(96 + 24);
        c.text('■ 출고하는 날', SIZE.caption, { ...c.accent(), weight: 700, name: 'label', gap: 40 });
        c.text('[오후 0시] 이전 주문은 당일 출고해요', SIZE.small, { name: 'list_item', gap: 12 });
        c.text('[휴무일·공휴일 안내]', SIZE.small, { color: c.muted, name: 'list_item', gap: 0 });
        return 100;
      },
    },
    {
      key: 'qa',
      name: 'Q. A. 목록',
      guide: `메인 카피 (15자 이내)\n질문 3~4개 (20자) / 답 1~2문장 ${SELLER}`,
      draw: (c) => {
        c.header('Q&A', '구매 전에\n많이 물어보세요');
        const qa = [['언제 받을 수 있나요?', '[출고 기준과 배송 기간을 적어 주세요]'], ['상한 게 오면 어떻게 하나요?', '[교환·환불 조건을 적어 주세요]'], ['선물 포장이 되나요?', '[포장 안내를 적어 주세요]']];
        qa.forEach(([q, a], i) => {
          const top = c.y;
          c.textAt('Q.', X, top, 70, 34, { weight: 900, ...c.accent(), align: 'left', name: 'badge', fontFamily: c.t.font.heading });
          const qt = c.textAt(q, X + 70, top + 2, CW - 70, 32, { weight: 700, align: 'left', name: 'list_title' });
          const at = c.textAt(`A. ${a}`, X + 70, bottomOf(qt) + 14, CW - 70, SIZE.small, { color: c.muted, align: 'left', lineHeight: 1.6, name: 'list_item' });
          c.y = bottomOf(at) + 36;
          if (i < qa.length - 1) divider(c, 36);
        });
        return 80;
      },
    },
    {
      key: 'pricecta',
      name: '옵션 가격 + 버튼',
      guide: `메인 카피 (12자 이내)\n사진 1장\n옵션 3줄: 이름 / 가격 ${SELLER}\n버튼 문구 (8자 이내)`,
      draw: (c) => {
        c.header('ORDER', '지금 주문하면\n이렇게 받아요');
        c.slot(X, c.y, CW, 480);
        c.space(480 + 40);
        for (const option of ['[옵션 1]', '[옵션 2]', '[옵션 3]']) {
          cardRow(
            c,
            1,
            (_, x, w, top) => {
              const a = c.textAt(option, x, top, w - 240, SIZE.small, { weight: 700, align: 'left', name: 'list_title' });
              const b = c.textAt('[가격]원', x + w - 240, top, 240, SIZE.small, { weight: 800, ...c.accent(), align: 'right', name: 'list_item' });
              return Math.max(bottomOf(a), bottomOf(b));
            },
            { pad: 28, after: 14 },
          );
        }
        c.space(30);
        button(c, '옵션 선택하고 주문하기');
        return 110;
      },
    },
    {
      key: 'icons3',
      name: '배송·교환·문의 3칸',
      guide: `메인 카피 (15자 이내)\n3칸: 배송 / 교환·환불 / 문의 — 각 1~2문장 ${SELLER}`,
      draw: (c) => {
        c.header('GUIDE', '구매 전\n확인해 주세요');
        const cells = [['배송', '[출고·배송 기간]'], ['교환', '[교환·환불 조건]'], ['문의', '[연락처·운영 시간]']];
        cardRow(
          c,
          3,
          (i, x, w, top) => {
            disc(c, cells[i][0], x + (w - 96) / 2, top, 96, 26);
            return bottomOf(c.textAt(cells[i][1], x, top + 124, w, SIZE.caption, { color: c.muted, lineHeight: 1.55, name: 'list_item' }));
          },
          { pad: 26, gap: 16 },
        );
        return 70;
      },
    },
    {
      key: 'packing',
      name: '포장 안내',
      guide: `메인 카피 (12자 이내)\n포장 사진 1장\n포장 겹 3~4개: 재료와 이유 ${SELLER}`,
      draw: (c) => {
        c.header('PACKING', '안전하게\n포장해요');
        c.slot(X, c.y, CW, 520);
        c.space(520 + 44);
        ['[1겹: 포장재와 이유]', '[2겹: 포장재와 이유]', '[3겹: 포장재와 이유]'].forEach((value, i) => {
          cardRow(
            c,
            1,
            (_, x, w, top) => {
              disc(c, String(i + 1), x, top, 52, 22);
              return Math.max(top + 52, bottomOf(c.textAt(value, x + 76, top + 8, w - 76, SIZE.small, { align: 'left', name: 'list_item' })));
            },
            { pad: 24, after: 14, x: X + i * 30, width: CW - i * 60 },
          );
        });
        return 90;
      },
    },
    {
      key: 'policy',
      name: '교환 가능 / 어려움',
      guide: `메인 카피 (12자 이내)\n왼쪽: 교환·환불 가능한 경우 3줄\n오른쪽: 어려운 경우 3줄 ${SELLER}`,
      draw: (c) => {
        c.header('RETURN', '교환·환불 안내');
        const sides = [
          { title: '가능해요', lines: ['[받은 날 상한 경우]', '[배송 중 파손된 경우]', '[다른 상품이 온 경우]'] },
          { title: '어려워요', lines: ['[단순 변심]', '[받은 뒤 보관 부주의]', '[신청 기간이 지난 경우]'] },
        ];
        cardRow(
          c,
          2,
          (i, x, w, top) => {
            const title = c.textAt(`${i ? '✕' : '○'}  ${sides[i].title}`, x, top, w, 32, { weight: 800, align: 'left', name: 'list_title', ...(i ? { color: c.muted } : c.accent()) });
            let y = bottomOf(title) + 20;
            for (const line of sides[i].lines) y = bottomOf(c.textAt(`· ${line}`, x, y, w, SIZE.caption, { align: 'left', lineHeight: 1.55, name: 'list_item' })) + 12;
            return y - 12;
          },
          { pad: 32 },
        );
        c.text('[신청 기간·방법을 적어 주세요]', SIZE.caption, { color: c.muted, name: 'list_item', gap: 0 });
        return 100;
      },
    },
    {
      key: 'finale',
      name: '사진 위 마지막 한마디',
      guide: '사진: 가장 먹음직스러운 컷\n마지막 카피 (2줄, 줄당 10자 이내)\n서브 카피 (25자)\n버튼 문구 (8자 이내)',
      draw: (c) => {
        const H = 1100;
        c.y = 0;
        overlay(c, 0, 0, W, H, () => {
          c.y = 620;
          c.header('NOW', '올해 가장 맛있을 때\n보내 드릴게요', '마지막으로 한 번 더 핵심 혜택을 알려 주세요', 60);
        });
        c.y = H + 72;
        button(c, '지금 주문하기');
        return 110;
      },
    },
    {
      key: 'warning',
      name: '주의 상자',
      guide: `안내 3~4줄: 신선식품 특성상 생길 수 있는 차이·주의 사항 ${SELLER}`,
      draw: (c) => {
        c.y = 90;
        const top = c.y;
        const start = c.nodes.length;
        disc(c, '!', X + 40, top + 40, 56, 30);
        const title = c.textAt('구매 전 꼭 확인해 주세요', X + 120, top + 50, CW - 160, 32, { weight: 800, align: 'left', name: 'main_copy' });
        let y = bottomOf(title) + 28;
        for (const line of ['[크기·모양이 조금씩 다를 수 있어요]', '[받으면 바로 냉장 보관해 주세요]', '[교환·반품이 어려운 경우를 적어 주세요]']) {
          y = bottomOf(c.textAt(`· ${line}`, X + 40, y, CW - 80, SIZE.small, { align: 'left', lineHeight: 1.6, name: 'list_item' })) + 12;
        }
        const h = y - top + 28;
        c.boxBehind(start, X, top, CW, h, 'rgba(255, 255, 255, 0)', { cornerRadius: c.t.radius.card, stroke: c.palette[c.accentRole], strokeWidth: 3, name: 'warning_box' });
        c.y = top + h;
        return 90;
      },
    },
    {
      key: 'contact',
      name: '큰 전화번호',
      guide: `메인 카피 (15자 이내)\n전화번호 (크게)\n운영 시간·채팅 상담 ${SELLER}`,
      draw: (c) => {
        c.header('CONTACT', '궁금하면\n바로 연락 주세요');
        cardRow(
          c,
          1,
          (_, x, w, top) => {
            const label = c.textAt('전화 상담', x, top, w, SIZE.caption, { color: c.muted, name: 'label' });
            const phone = c.textAt('[000-0000-0000]', x, bottomOf(label) + 10, w, 60, { weight: 900, ...c.accent(), name: 'list_title', fontFamily: c.t.font.heading });
            const hours = c.textAt('[평일 09:00 ~ 18:00]', x, bottomOf(phone) + 24, w, SIZE.small, { name: 'list_item' });
            return bottomOf(c.textAt('채팅 상담: [채널 이름]', x, bottomOf(hours) + 12, w, SIZE.small, { color: c.muted, name: 'list_item' }));
          },
          { pad: 48 },
        );
        return 70;
      },
    },
    {
      key: 'arrival',
      name: '받으시면 이렇게',
      guide: `메인 카피 (12자 이내)\n받은 뒤 할 일 4단계: 제목 8자 + 설명 1문장 (상품에 맞는 보관 온도·기간만)\n아래 상자: 문제가 있을 때 연락 기한·방법 ${SELLER}`,
      draw: (c) => {
        c.header('AFTER ARRIVAL', '받으시면\n이렇게 해 주세요');
        const steps = [
          ['바로 열어 확인', '상자를 열어 눌리거나 무른 것이 없는지 봐 주세요.'],
          ['물기 없이 정리', '씻지 말고 겹치지 않게 펼쳐 숨을 돌려 주세요.'],
          ['[냉장 0~5℃] 보관', '[신문지·키친타월로 감싸 보관해 주세요.]'],
          ['[0일 안에] 드세요', '[가장 맛있게 드실 수 있는 기간이에요.]'],
        ];
        const d = 64;
        steps.forEach(([title, text], i) => {
          const top = c.y;
          disc(c, String(i + 1), X, top, d, 28);
          const end = titledAt(c, title, text, X + d + 32, top + 6, CW - d - 32, { titleSize: SIZE.itemTitle, textSize: SIZE.small });
          const next = Math.max(top + d, end) + 44;
          if (i < steps.length - 1) c.box(X + d / 2 - 1, top + d + 12, 2, next - top - d - 24, c.line, { name: 'divider' });
          c.y = next;
        });
        c.space(8);
        cardRow(
          c,
          1,
          (_, x, w, top) => {
            const t = c.textAt('문제가 있다면', x, top, w, SIZE.caption, { weight: 700, ...c.accent(), align: 'left', name: 'label' });
            return bottomOf(c.textAt('[받은 날 포함 0일 안에 사진과 함께 문의해 주세요]', x, bottomOf(t) + 10, w, SIZE.small, { weight: 700, align: 'left', lineHeight: 1.5, name: 'list_item' }));
          },
          { pad: 36, after: 0 },
        );
        return 100;
      },
    },
  ],
};
