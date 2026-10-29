import { z } from "zod";

export const MAX_ORDER_TEXT = 20_000;

export const ParsedOrdersSchema = z.object({
  orders: z.array(
    z.object({
      receiver: z.string().describe("받는 분 이름. 없으면 빈 문자열"),
      phone: z.string().describe("받는 분 연락처 (010-0000-0000 형식). 없으면 빈 문자열"),
      zipcode: z.string().describe("우편번호. 없으면 빈 문자열"),
      address: z.string().describe("받는 분 주소 전체 (상세주소 포함)"),
      productName: z.string().describe("상품명. 판매 상품 목록과 같은 상품이면 목록의 상품명으로"),
      optionName: z.string().describe("옵션(중량·등급 등). 판매 상품 목록의 옵션 표기로 맞추고, 없으면 빈 문자열"),
      qty: z.number().describe("수량. 언급이 없으면 1"),
      message: z.string().describe("배송 요청사항. 없으면 빈 문자열"),
      orderer: z.string().describe("주문한 사람(받는 분과 다를 때). 없으면 빈 문자열"),
    }),
  ),
  warnings: z.array(z.string()).describe("주소·연락처 누락, 수량 불명확 등 판매자가 확인할 점"),
});

export type ParsedOrders = z.infer<typeof ParsedOrdersSchema>;

export const ORDER_PARSE_PROMPT = `당신은 농수산물 판매자의 주문 정리 담당입니다. 문자·카카오톡·전화 메모로 받은 주문 글을 배송용 주문 목록으로 정리합니다.

[원칙]
- 글에 없는 정보는 절대 지어내지 않고 빈 문자열로 둡니다. 특히 연락처·주소를 추측하지 않습니다.
- 한 사람이 여러 곳으로 보내면 받는 곳마다 한 줄씩 만듭니다.
- 한 곳에 여러 상품이면 상품마다 한 줄씩 만듭니다.
- 판매 상품 목록에 있는 상품이면 그 상품명·옵션 표기로 맞춥니다 (예: "사과 5키로" → 목록의 "청송 사과" / "5kg").
- 주소가 불완전하거나 연락처가 없으면 warnings에 "OOO님 주소 확인 필요"처럼 남깁니다.
- 인사말·입금 확인 같은 대화는 무시합니다.`;

export function buildOrderParsePrompt(text: string, products: string[]) {
  return `[판매 상품 목록]\n${products.length ? products.join("\n") : "(등록 상품 없음)"}\n\n[주문 글]\n${text}`;
}
