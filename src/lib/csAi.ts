import { z } from "zod";
import { CLAIM_TYPES, CS_GUIDES, type ClaimType } from "@/lib/data/cs";
import { CS_BOT_NAME } from "@/lib/brand";

export const CS_TONES = {
  warm: "따뜻하고 다정하게 (공감 표현 풍부, 이모지 1~2개 허용)",
  polite: "정중하고 신뢰감 있게 (격식체, 이모지 없음)",
  brief: "짧고 명확하게 (핵심만 3~4문장)",
} as const;

export type CsTone = keyof typeof CS_TONES;

export const INQUIRY_TYPES = [...CLAIM_TYPES, "inquiry", "praise"] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];

export const INQUIRY_LABELS: Record<InquiryType, string> = {
  ...(Object.fromEntries(CLAIM_TYPES.map((t) => [t, CS_GUIDES[t].label])) as Record<ClaimType, string>),
  inquiry: "일반 문의",
  praise: "칭찬·후기",
};

export const CS_GREETING = `안녕하세요. ${CS_BOT_NAME}입니다. 무엇을 도와드릴까요?`;

export const CsResultSchema = z.object({
  mode: z
    .enum(["cs_reply", "message"])
    .describe("cs_reply = 고객 문의(캡처·붙여넣은 글)에 대한 답변 작성 또는 직전 답변 수정 / message = 그 외 대화(질문 답변, 추가 정보 요청, 읽을 수 없는 캡처 안내)"),
  message: z.string().describe("판매자에게 하는 말. cs_reply면 한두 문장 코멘트(예: 파손 문의네요. 사진 확인 후 부분환불로 안내하는 답변을 준비했어요), message면 대화 답변 전체"),
  extractedText: z.string().describe("cs_reply: 고객 문의 원문 (판매자 답변·광고 문구 제외). message면 빈 문자열"),
  customerName: z.string().describe("고객 이름 또는 닉네임. 개인정보 보호를 위해 성+** 형태(예: 김**)로, 모르면 빈 문자열"),
  channel: z.string().describe("추정 판매채널 (스마트스토어, 쿠팡, 카카오톡, 문자 등). 모르면 빈 문자열"),
  summary: z.string().describe("cs_reply: 문의 핵심 한 문장. message면 빈 문자열"),
  type: z.enum(INQUIRY_TYPES),
  sentiment: z.enum(["angry", "upset", "neutral", "positive"]),
  matchedSkuId: z.string().describe("제공된 상품 목록 중 해당하는 id. 없거나 불확실하면 빈 문자열"),
  evidenceToRequest: z.array(z.string()).describe("보상 판단을 위해 고객에게 추가로 받아야 할 증빙. 이미 받은 건 제외"),
  reply: z.string().describe("cs_reply: 고객에게 보낼 답변 전문. message면 빈 문자열"),
  shortReply: z.string().describe("cs_reply: 리뷰 댓글·문자용 2~3문장 답변. message면 빈 문자열"),
  sellerTodos: z.array(z.string()).describe("판매자가 해야 할 후속 조치 체크리스트 (공급처 연락, 재발송 등)"),
});

export type CsResult = z.infer<typeof CsResultSchema>;

export interface CsChatTurn {
  role: "user" | "assistant";
  text: string;
  /** 용량을 줄이기 위해 마지막 사용자 메시지에만 담는다 */
  images?: string[];
}

export interface CsChatRequest {
  messages: CsChatTurn[];
  tone: CsTone;
  policy: string;
  products: { id: string; name: string }[];
}

/** 이전 AI 응답을 다음 요청의 대화 기록으로 넘길 때 쓰는 텍스트 */
export function resultToTurnText(r: CsResult) {
  if (r.mode === "message") return r.message;
  return [
    r.message,
    `[분석] 유형: ${INQUIRY_LABELS[r.type]} / 감정: ${r.sentiment} / 요약: ${r.summary}`,
    `[고객 문의 원문]\n${r.extractedText}`,
    `[고객 답변]\n${r.reply}`,
    `[짧은 버전]\n${r.shortReply}`,
  ].join("\n");
}

export function buildSystemPrompt({ tone, policy, products }: Omit<CsChatRequest, "messages">) {
  const guides = CLAIM_TYPES.map((t) => {
    const g = CS_GUIDES[t];
    return `- ${t} (${g.label}): 증빙 ${g.evidence.join(", ")} / 처리 ${g.actions.join("; ")}`;
  }).join("\n");

  return `당신은 "${CS_BOT_NAME}"입니다. 농수산물(과일·채소·수산물) 온라인 위탁판매 셀러 옆에서 CS를 도와주는 베테랑 CS 담당자로, 판매자와 대화합니다.
판매자는 고객 문의 캡처(쇼핑몰 문의, 리뷰, 톡톡, 카카오톡, 문자 등)나 문의 글을 보내고, 당신은 고객에게 보낼 답변을 만들어 줍니다.

[대화 방식]
- 판매자가 고객 문의(캡처 또는 붙여넣은 글)를 주면 mode=cs_reply로 분석과 답변을 작성합니다.
- 판매자가 직전 답변 수정을 요청하면("더 짧게", "재발송으로 바꿔줘" 등) mode=cs_reply로 같은 문의에 대한 수정본을 다시 작성합니다. 분석 항목은 유지하고 요청한 부분만 바꿉니다.
- 판매자의 일반 질문(보상 기준, 응대 요령 등)이나 인사에는 mode=message로 짧고 실용적으로 답합니다.
- 고객 문의인지 애매하거나 캡처를 읽을 수 없으면 mode=message로 어떤 정보·캡처가 필요한지 물어봅니다.
- 판매자에게 하는 말(message)은 존댓말로 짧게 씁니다.

[고객 답변 작성 원칙]
1. 첫 문장은 고객 이름(있으면)과 함께 인사하고, 고객이 느꼈을 감정에 먼저 공감합니다.
2. 불편 사항이면 변명 없이 진심으로 사과합니다. "규정상", "원래", "고객님이" 같은 책임 전가 표현은 쓰지 않습니다.
3. 고객이 말한 구체적인 내용(상품명, 상태, 날짜)을 짚어서 제대로 읽었음을 보여줍니다.
4. 해결 방법과 다음 단계를 명확히 안내합니다. 증빙이 더 필요하면 "번거로우시겠지만"처럼 부드럽게 요청합니다.
5. 아래 판매자 보상 정책을 넘어서는 약속(금액, 기한)은 절대 하지 않습니다. 정책에 없는 내용은 "확인 후 빠르게 안내드리겠다"고 씁니다. 판매자가 대화에서 직접 지시한 보상은 따릅니다.
6. 농산물 특성(수분 감량, 후숙, 개체별 크기·당도 차이)은 필요할 때만 변명이 아닌 정보로 부드럽게 설명합니다.
7. 재발 방지 노력과 감사 인사로 마무리합니다.
8. 칭찬·후기에는 구체적으로 감사하고 재구매를 자연스럽게 권합니다.
9. 문체: ${CS_TONES[tone]}
10. 캡처에 보이는 전화번호·주소 등 개인정보는 답변에 옮기지 않습니다.

[판매자 보상 정책]
${policy.trim() || "(정책 미입력 — 금액·기한 약속 없이 확인 후 안내하겠다고 답변)"}

[클레임 유형별 가이드]
${guides}
- inquiry (일반 문의): 배송 조회, 보관법, 출고일 등
- praise (칭찬·후기)

[판매 중인 상품 목록 (id: 이름)]
${products.length ? products.map((p) => `${p.id}: ${p.name}`).join("\n") : "(등록된 상품 없음)"}`;
}
