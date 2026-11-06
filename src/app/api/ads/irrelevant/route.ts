import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { rateLimit } from "@/lib/server/rateLimit";
import { OPENAI_MODEL, errorResponse, missingKeyResponse, openaiClient, openaiErrorResponse } from "@/lib/server/openai";

const Body = z.object({
  products: z
    .array(
      z.object({
        product: z.string().min(1).max(200),
        spend: z.number().nonnegative(),
        keywords: z.array(z.object({ keyword: z.string().min(1).max(80), spend: z.number().nonnegative() })).max(30),
      }),
    )
    .max(10),
});

const Result = z.object({
  items: z
    .array(
      z.object({
        product: z.string(),
        keyword: z.string(),
        unrelated: z.boolean(),
        reason: z.string(),
      }),
    )
    .max(80),
});

const SYSTEM = `당신은 쿠팡 광고 키워드 심사자입니다. 상품명과 키워드가 같은 물건을 찾는지 판단합니다.

규칙:
- 상품명에서 핵심 품목(마늘, 사과, 홍게처럼 농수산물 이름)을 먼저 정합니다.
- 키워드가 그 품목을 포함하면 unrelated는 반드시 false입니다. 매출이 0이어도 관련 키워드입니다. 예: 상품이 의성마늘이면 깐마늘, 다진마늘, 마늘장아찌는 관련입니다.
- 키워드가 '-'이면 비검색 영역입니다. 절대 unrelated로 두지 않습니다.
- 품목과 검색 의도가 분명히 다른 단어만 unrelated true입니다. 예: 마늘 상품의 '김치'.
- reason은 한 문장으로, 왜 관련인지 또는 왜 광고비를 빼야 하는지 적습니다.`;

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.products.length) return errorResponse("판단할 키워드가 없습니다.", 400);

  const lines = parsed.data.products
    .map((p) => `- 상품명: "${p.product}" / 키워드: ${p.keywords.map((k) => `${k.keyword}(${Math.round(k.spend)}원)`).join(", ")}`)
    .join("\n");

  try {
    const response = await client.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `매출은 없고 광고비만 쓴 키워드입니다. 상품과 관련 없는 것만 골라 주세요.\n${lines}` },
      ],
      text: { format: zodTextFormat(Result, "irrelevant_keywords") },
    });
    const items = response.output_parsed?.items ?? [];
    return Response.json({ items });
  } catch (err) {
    return openaiErrorResponse(err, "ads-irrelevant", "키워드 연관 분석 중 오류가 발생했습니다.");
  }
}
