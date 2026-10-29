import { rateLimit } from "@/lib/server/rateLimit";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { normalizeKeyword } from "@/lib/keyword";
import { TITLE_SYSTEM_PROMPT, TitleIdeasSchema, buildTitlePrompt } from "@/lib/titleMaker";
import { OPENAI_MODEL, errorResponse, missingKeyResponse, openaiClient, openaiErrorResponse } from "@/lib/server/openai";

const RequestSchema = z.object({
  keyword: z.string().min(1).max(40),
  modifiers: z.array(z.string().max(30)).max(40).default([]),
  note: z.string().max(500).default(""),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  const keyword = parsed.success ? normalizeKeyword(parsed.data.keyword) : "";
  if (!parsed.success || !keyword) return errorResponse("메인 키워드를 입력해 주세요.", 400);

  try {
    const response = await client.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: TITLE_SYSTEM_PROMPT },
        { role: "user", content: buildTitlePrompt(keyword, parsed.data.modifiers, parsed.data.note) },
      ],
      text: { format: zodTextFormat(TitleIdeasSchema, "title_ideas") },
    });

    if (!response.output_parsed) return errorResponse("AI가 상품명을 만들지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json(response.output_parsed);
  } catch (err) {
    return openaiErrorResponse(err, "titles-ai", "상품명 생성 중 오류가 발생했습니다.");
  }
}
