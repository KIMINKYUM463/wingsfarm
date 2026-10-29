import { rateLimit } from "@/lib/server/rateLimit";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { KEYWORD_SYSTEM, KeywordGroupsSchema, buildKeywordUserText } from "@/lib/detailPageAi";
import { OPENAI_MODEL, errorResponse, imageDataUrl, missingKeyResponse, openaiClient, openaiErrorResponse } from "@/lib/server/openai";

const RequestSchema = z.object({
  product: z.string().trim().min(1).max(60),
  note: z.string().max(500).default(""),
  image: imageDataUrl.optional(),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("상품명을 확인해 주세요.", 400);
  const { product, note, image } = parsed.data;

  try {
    const response = await client.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: KEYWORD_SYSTEM },
        {
          role: "user",
          content: [
            { type: "input_text", text: buildKeywordUserText(product, note.trim()) },
            ...(image ? [{ type: "input_image" as const, image_url: image, detail: "low" as const }] : []),
          ],
        },
      ],
      text: { format: zodTextFormat(KeywordGroupsSchema, "detail_keywords") },
    });
    const result = response.output_parsed;
    if (!result) return errorResponse("키워드를 만들지 못했습니다. 다시 시도해 주세요.", 502);
    const groups = result.groups
      .map((g) => ({ name: g.name.trim(), keywords: [...new Set(g.keywords.map((k) => k.trim()).filter(Boolean))].slice(0, 8) }))
      .filter((g) => g.name && g.keywords.length > 0)
      .slice(0, 5);
    return Response.json({ groups });
  } catch (err) {
    return openaiErrorResponse(err, "detail-keywords", "키워드 생성 중 오류가 발생했습니다.");
  }
}
