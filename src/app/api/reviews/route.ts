import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { MAX_REVIEW_CHARS, REVIEW_SYSTEM_PROMPT, ReviewAnalysisSchema, buildReviewPrompt } from "@/lib/reviewAi";
import { rateLimit } from "@/lib/server/rateLimit";
import { OPENAI_MODEL, errorResponse, missingKeyResponse, openaiClient, openaiErrorResponse } from "@/lib/server/openai";

const RequestSchema = z.object({
  product: z.string().max(100).default(""),
  reviews: z.array(z.string().max(2000)).min(3).max(300),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("리뷰를 3개 이상 300개 이하로 붙여넣어 주세요.", 400);
  const { product, reviews } = parsed.data;
  if (reviews.join("").length > MAX_REVIEW_CHARS) return errorResponse(`리뷰가 너무 길어요. ${MAX_REVIEW_CHARS.toLocaleString("ko-KR")}자 이내로 나눠서 분석하세요.`, 400);

  try {
    const response = await client.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: REVIEW_SYSTEM_PROMPT },
        { role: "user", content: buildReviewPrompt(product, reviews) },
      ],
      text: { format: zodTextFormat(ReviewAnalysisSchema, "review_analysis") },
    });
    if (!response.output_parsed) return errorResponse("AI가 분석하지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json(response.output_parsed);
  } catch (err) {
    return openaiErrorResponse(err, "reviews", "리뷰 분석 중 오류가 발생했습니다.");
  }
}
