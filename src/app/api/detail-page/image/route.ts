import { rateLimit } from "@/lib/server/rateLimit";
import { z } from "zod";
import { buildSectionImagePrompt } from "@/lib/detailPageAi";
import {
  createImage,
  errorResponse,
  imageDataUrl,
  missingKeyResponse,
  openaiClient,
  openaiErrorResponse,
  parseDataUrl,
} from "@/lib/server/openai";

const RequestSchema = z.object({
  product: z.string().trim().min(1).max(60),
  prompt: z.string().trim().min(8).max(1500),
  /** 대표 상품 사진 — 있으면 같은 상품이 나오도록 참고 */
  reference: imageDataUrl.optional(),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "image");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("상품명과 사진 설명(8자 이상)을 확인해 주세요.", 400);
  const { product, prompt, reference } = parsed.data;
  const file = reference ? parseDataUrl(reference) : null;
  if (reference && !file) return errorResponse("이미지 형식이 올바르지 않습니다.", 400);

  try {
    const image = await createImage(client, {
      prompt: buildSectionImagePrompt(product, prompt, Boolean(file)),
      reference: file,
      size: "1536x1024",
    });
    if (!image) return errorResponse("사진을 만들지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json({ image });
  } catch (err) {
    return openaiErrorResponse(err, "detail-image", "사진 생성 중 오류가 발생했습니다.");
  }
}
