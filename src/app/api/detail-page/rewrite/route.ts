import { rateLimit } from "@/lib/server/rateLimit";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { SECTION_TYPES } from "@/lib/detailPage";
import { REWRITE_SYSTEM, SectionCopySchema, buildRewriteUserText, normalizeCopy } from "@/lib/detailPageAi";
import { OPENAI_MODEL, errorResponse, missingKeyResponse, openaiClient, openaiErrorResponse } from "@/lib/server/openai";

const RequestSchema = z.object({
  product: z.string().trim().min(1).max(60),
  company: z.string().trim().max(60).default(""),
  type: z.enum(SECTION_TYPES),
  copy: z.object({
    eyebrow: z.string().max(60),
    headline: z.string().max(200),
    body: z.string().max(1500),
    items: z.array(z.object({ title: z.string().max(120), text: z.string().max(600) })).max(12),
  }),
  instruction: z.string().trim().min(2).max(300),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("상품명과 요청 내용을 확인해 주세요.", 400);

  try {
    const response = await client.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: REWRITE_SYSTEM },
        { role: "user", content: buildRewriteUserText(parsed.data) },
      ],
      text: { format: zodTextFormat(SectionCopySchema, "detail_section_copy") },
    });
    const copy = response.output_parsed;
    if (!copy) return errorResponse("문구를 다시 쓰지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json(normalizeCopy(copy, parsed.data.type));
  } catch (err) {
    return openaiErrorResponse(err, "detail-rewrite", "문구 수정 중 오류가 발생했습니다.");
  }
}
