import { rateLimit } from "@/lib/server/rateLimit";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { VOLUMES } from "@/lib/detailPage";
import {
  GENERATION_METHODS,
  LIMITS,
  buildDraftSchema,
  buildDraftUserText,
  draftSystemPrompt,
  normalizeDraft,
  type DetailGenerateBody,
} from "@/lib/detailPageAi";
import { OPENAI_MODEL, errorResponse, imageDataUrl, missingKeyResponse, openaiClient, openaiErrorResponse } from "@/lib/server/openai";

const ids = <T extends { id: string }>(list: readonly T[]) => list.map((x) => x.id) as [T["id"], ...T["id"][]];

const RequestSchema = z
  .object({
    product: z.string().trim().min(1).max(60),
    company: z.string().trim().max(60).default(""),
    note: z.string().trim().max(800).default(""),
    method: z.enum(ids(GENERATION_METHODS)),
    keywords: z.array(z.string().trim().max(40)).max(40).default([]),
    customFeatures: z.string().trim().max(1000).default(""),
    references: z.array(imageDataUrl).max(LIMITS.referenceTiles).default([]),
    productImages: z.array(imageDataUrl).max(LIMITS.productImages).default([]),
    volume: z.enum(ids(VOLUMES)),
  })
  .refine((b) => (b.method === "benchmark" ? b.references.length > 0 : b.keywords.length > 0 || b.customFeatures.length > 0), {
    message: "키워드를 고르거나 특징을 적어 주세요. 벤치마킹 방식은 참고 이미지가 필요합니다.",
  }) satisfies z.ZodType<DetailGenerateBody, unknown>;

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.", 400);
  const body = parsed.data;
  const productCount = body.productImages.length;

  const images = [
    ...body.productImages.flatMap((src, i) => [
      { type: "input_text" as const, text: `상품 사진 ${i}번` },
      { type: "input_image" as const, image_url: src, detail: "low" as const },
    ]),
    ...(body.method === "benchmark"
      ? [
          { type: "input_text" as const, text: "참고 상세페이지 캡처 (위에서 아래 순서로 자른 조각)" },
          ...body.references.map((src) => ({ type: "input_image" as const, image_url: src, detail: "high" as const })),
        ]
      : []),
  ];

  try {
    const response = await client.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: draftSystemPrompt(body.volume, productCount, body.method) },
        { role: "user", content: [{ type: "input_text", text: buildDraftUserText(body) }, ...images] },
      ],
      text: { format: zodTextFormat(buildDraftSchema(body.volume), `detail_draft_${body.volume}`) },
    });
    const draft = response.output_parsed;
    if (!draft) return errorResponse("상세페이지 초안을 만들지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json(normalizeDraft(draft, body.volume, productCount));
  } catch (err) {
    return openaiErrorResponse(err, "detail-generate", "상세페이지 생성 중 오류가 발생했습니다.");
  }
}
