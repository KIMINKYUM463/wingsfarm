import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { MAX_ORDER_TEXT, ORDER_PARSE_PROMPT, ParsedOrdersSchema, buildOrderParsePrompt } from "@/lib/orderAi";
import { rateLimit } from "@/lib/server/rateLimit";
import { OPENAI_MODEL, errorResponse, missingKeyResponse, openaiClient, openaiErrorResponse } from "@/lib/server/openai";

const RequestSchema = z.object({
  text: z.string().min(5).max(MAX_ORDER_TEXT),
  products: z.array(z.string().max(200)).max(300).default([]),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(`주문 글을 ${MAX_ORDER_TEXT.toLocaleString("ko-KR")}자 이내로 붙여넣어 주세요.`, 400);

  try {
    const response = await client.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: ORDER_PARSE_PROMPT },
        { role: "user", content: buildOrderParsePrompt(parsed.data.text, parsed.data.products) },
      ],
      text: { format: zodTextFormat(ParsedOrdersSchema, "parsed_orders") },
    });
    if (!response.output_parsed) return errorResponse("AI가 주문을 정리하지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json(response.output_parsed);
  } catch (err) {
    return openaiErrorResponse(err, "orders-parse", "주문 정리 중 오류가 발생했습니다.");
  }
}
