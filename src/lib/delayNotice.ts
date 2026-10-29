/** 출고 지연 선제 안내 문구 — AI 없이 템플릿으로 즉시 생성 (요금 없음) */

export const DELAY_REASONS = [
  { id: "weather", label: "기상 악화", line: "산지 기상 악화(폭우·폭염 등)로 수확·선별 작업이 늦어져", short: "산지 기상 악화" },
  { id: "harvest", label: "선별 강화", line: "좋은 상품만 보내드리기 위해 수확 후 선별 작업에 시간이 더 걸려", short: "선별 작업 지연" },
  { id: "volume", label: "주문 폭주", line: "예상보다 많은 주문이 몰려 순차 출고를 진행하고 있어", short: "주문 증가로 순차 출고" },
  { id: "courier", label: "택배 물량", line: "택배사 물량 증가(집하 제한)로 출고가 늦어져", short: "택배사 집하 지연" },
  { id: "holiday", label: "명절·연휴", line: "명절 연휴 택배 운영 일정에 따라", short: "연휴 택배 일정" },
  { id: "stock", label: "산지 물량 부족", line: "산지 물량이 일시적으로 부족해 다음 수확분으로 보내드리게 되어", short: "다음 수확분으로 출고" },
] as const;

export const COMPENSATIONS = [
  { id: "none", label: "없음" },
  { id: "coupon", label: "적립금·쿠폰" },
  { id: "extra", label: "덤 증정" },
] as const;

export type DelayReason = (typeof DELAY_REASONS)[number]["id"];
export type Compensation = (typeof COMPENSATIONS)[number]["id"];

export interface DelayNoticeInput {
  storeName: string;
  product: string;
  reason: DelayReason;
  /** YYYY-MM-DD */
  newDate: string;
  compensation: Compensation;
  couponAmount: number;
  extraItem: string;
}

export interface DelayNotice {
  channel: "talk" | "sms" | "notice";
  label: string;
  title: string;
  text: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-10-31" → "10월 31일(토)" (로컬 날짜로 해석) */
export function koreanDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${m}월 ${d}일(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}

function compensationLine(input: DelayNoticeInput) {
  if (input.compensation === "coupon" && input.couponAmount > 0) {
    return `기다려 주시는 마음에 보답하고자 ${input.couponAmount.toLocaleString("ko-KR")}원 적립금(쿠폰)을 드립니다.`;
  }
  if (input.compensation === "extra" && input.extraItem.trim()) {
    return `기다려 주셔서 감사한 마음으로 ${input.extraItem.trim()}을(를) 함께 넣어 드리겠습니다.`;
  }
  return "";
}

export function buildDelayNotices(input: DelayNoticeInput): DelayNotice[] {
  const reason = DELAY_REASONS.find((r) => r.id === input.reason) ?? DELAY_REASONS[0];
  const store = input.storeName.trim() || "판매자";
  const product = input.product.trim() || "주문 상품";
  const when = koreanDate(input.newDate);
  const comp = compensationLine(input);

  const talk = [
    `안녕하세요, ${store}입니다.`,
    `주문하신 [${product}] 출고 일정을 미리 안내드립니다.`,
    "",
    `${reason.line} ${when}에 출고될 예정입니다.`,
    "기다려 주시는 만큼 신선하고 좋은 상품으로 꼼꼼히 포장해 보내드리겠습니다.",
    comp,
    "",
    "일정이 맞지 않으시면 언제든 말씀해 주세요. 바로 취소·환불 도와드리겠습니다.",
    "불편을 드려 진심으로 죄송합니다. 🙏",
  ]
    .filter((line, i, arr) => line !== "" || arr[i - 1] !== "")
    .join("\n");

  const sms = `[${store}] ${product} 출고 안내: ${reason.short}로 ${when} 출고 예정입니다.${comp ? " 작은 보답을 준비했어요." : ""} 취소를 원하시면 회신 주세요. 죄송합니다.`;

  const noticeTitle = `[출고 안내] ${product} ${when} 순차 출고`;
  const notice = [
    `${reason.line} ${product} 주문 건이 ${when}부터 순차 출고됩니다.`,
    "",
    "· 주문 순서대로 출고되며, 출고 후 송장번호를 알림으로 보내드립니다.",
    "· 일정이 맞지 않으시면 문의(톡톡)로 말씀해 주시면 바로 취소·환불해 드립니다.",
    comp ? `· ${comp}` : "",
    "",
    "기다려 주시는 모든 고객님께 감사드립니다.",
  ]
    .filter((line, i, arr) => line !== "" || arr[i - 1] !== "")
    .join("\n");

  return [
    { channel: "talk", label: "톡톡·카카오톡", title: "1:1 메시지", text: talk },
    { channel: "sms", label: "문자", title: `짧은 문자 (${[...sms].length}자)`, text: sms },
    { channel: "notice", label: "스토어 공지", title: noticeTitle, text: `${noticeTitle}\n\n${notice}` },
  ];
}

/** 안내 후 판매자가 할 일 */
export const DELAY_TODOS = [
  "판매 채널 관리자에서 해당 주문을 '발송 지연' 처리하고 예정일을 입력하기 (지연 페널티 완화)",
  "공급처에 확정 출고일 다시 확인받기",
  "출고 당일 송장 등록 후 도착 예정 안내",
  "취소 요청 고객은 미출고 상태에서 즉시 처리",
];
