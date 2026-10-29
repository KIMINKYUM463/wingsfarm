import { z } from "zod";

export const MAX_REVIEW_CHARS = 30_000;

export const ReviewAnalysisSchema = z.object({
  summary: z.string().describe("리뷰 전체를 판매자 관점에서 2~3문장으로 요약"),
  positiveShare: z.number().describe("긍정 리뷰 비율 추정치(0~100). 정확한 집계가 아니라 대략값"),
  issues: z
    .array(
      z.object({
        topic: z.string().describe("불만 주제 (예: 배송 중 눌림)"),
        category: z.enum(["damage", "spoiled", "underweight", "quality", "delay", "wrongItem", "packaging", "other"]),
        share: z.number().describe("이 불만이 나온 리뷰 비율 추정치(0~100)"),
        examples: z.array(z.string()).describe("리뷰 원문에서 그대로 인용한 문장 1~2개 (지어내지 말 것, 이름·연락처는 가림)"),
        cause: z.string().describe("가장 그럴듯한 원인 (선별·포장·택배·보관 안내 등)"),
        fix: z.string().describe("구체적인 개선 조치"),
        owner: z.enum(["supplier", "seller", "courier"]).describe("주로 누가 고쳐야 하는지"),
      }),
    )
    .describe("불만이 많은 순서. 없으면 빈 배열"),
  praises: z.array(z.object({ point: z.string(), examples: z.array(z.string()) })).describe("고객이 반복해서 칭찬한 강점"),
  detailPageIdeas: z.array(z.string()).describe("상세페이지·썸네일에 반영할 점 (강점 강조, 오해를 줄이는 안내). 효능·과장 표현 금지"),
  supplierMessage: z.string().describe("공급처에 보낼 품질 피드백 카톡 메시지. 정중하고 구체적으로, 비율·사례 포함"),
  replyTemplates: z.array(z.object({ situation: z.string(), text: z.string() })).describe("자주 나온 상황별 리뷰 답글 2~3개"),
});

export type ReviewAnalysis = z.infer<typeof ReviewAnalysisSchema>;

export const ISSUE_OWNER_LABEL: Record<ReviewAnalysis["issues"][number]["owner"], string> = {
  supplier: "공급처",
  seller: "판매자",
  courier: "택배",
};

export const REVIEW_SYSTEM_PROMPT = `당신은 농수산물(과일·채소·수산물) 온라인 위탁판매 셀러의 품질 관리 담당자입니다.
판매자가 붙여넣은 고객 리뷰를 분석해 반복되는 불만과 강점, 원인과 개선 조치를 정리합니다.

[원칙]
- 리뷰에 없는 사실·수치를 만들지 않습니다. 비율은 리뷰 개수 기준 대략값으로만 씁니다.
- examples는 반드시 리뷰 원문에서 그대로 인용합니다. 고객 이름·연락처·주소는 **로 가립니다.
- 농산물 특성(개체별 크기·당도 차이, 후숙, 수분 감량)은 변명이 아니라 안내 개선 포인트로 다룹니다.
- 원인은 선별(공급처), 포장(공급처·판매자), 택배(택배사), 상세페이지 안내 부족(판매자) 중에서 판단합니다.
- 상세페이지 제안에 질병 예방·치료 효능이나 근거 없는 최상급 표현을 쓰지 않습니다.
- 공급처 메시지는 탓하는 말투가 아니라 같이 고치자는 말투로, 무엇을 언제까지 어떻게 바꿔 달라는지 구체적으로 씁니다.`;

export function buildReviewPrompt(product: string, reviews: string[]) {
  return `[상품] ${product || "(미입력)"}\n[리뷰 ${reviews.length}개]\n${reviews.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
}
