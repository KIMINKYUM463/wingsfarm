import { rateLimit } from "@/lib/server/rateLimit";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  SUB_COUNTS,
  buildThumbnailPlanSchema,
  buildThumbnailPlanUserText,
  normalizeThumbnailPlan,
  thumbnailPlanPrompt,
  totalShotCount,
  type SubCount,
} from "@/lib/thumbnailAi";
import { OPENAI_MODEL, errorResponse, missingKeyResponse, openaiClient, openaiErrorResponse, parseDataUrl } from "@/lib/server/openai";

const MAX_IMAGE = 8_000_000;

const RequestSchema = z.object({
  image: z.string().regex(/^data:image\/(png|jpeg|webp|jpg);base64,/i).max(MAX_IMAGE),
  product: z.string().min(1).max(60),
  note: z.string().max(500).default(""),
  includeMain: z.boolean().default(true),
  subCount: z.number().int().min(0).max(9).default(9),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("상품 사진(PNG/JPG)과 상품명·장수 설정을 확인해 주세요.", 400);
  if (!parseDataUrl(parsed.data.image)) return errorResponse("이미지 형식이 올바르지 않습니다.", 400);

  const includeMain = parsed.data.includeMain;
  const subCount = (SUB_COUNTS.includes(parsed.data.subCount as SubCount) ? parsed.data.subCount : 9) as SubCount;
  const opts = { includeMain, subCount };

  if (totalShotCount(opts) < 1) {
    return errorResponse("메인 또는 서브 썸네일을 하나 이상 선택해 주세요.", 400);
  }

  try {
    const schema = buildThumbnailPlanSchema(opts);
    const response = await client.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: thumbnailPlanPrompt(opts) },
        {
          role: "user",
          content: [
            { type: "input_text", text: buildThumbnailPlanUserText(parsed.data.product, parsed.data.note, opts) },
            { type: "input_image", image_url: parsed.data.image, detail: "high" },
          ],
        },
      ],
      text: { format: zodTextFormat(schema, `thumbnail_plan_m${includeMain ? 1 : 0}_s${subCount}`) },
    });

    if (!response.output_parsed) return errorResponse("썸네일 구성을 만들지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json(normalizeThumbnailPlan(response.output_parsed, opts));
  } catch (err) {
    return openaiErrorResponse(err, "thumbnails-plan", "썸네일 구성 중 오류가 발생했습니다.");
  }
}
