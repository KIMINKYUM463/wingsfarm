import { rateLimit } from "@/lib/server/rateLimit";
import { z } from "zod";
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
  /** 업로드한 상품 참고 사진 (없으면 프롬프트만으로 생성) */
  image: imageDataUrl.optional(),
  product: z.string().min(1).max(60),
  slideNumber: z.number().int().min(1).max(12),
  headline: z.string().max(120).default(""),
  imagePrompt: z.string().min(8).max(2000),
  artDirection: z.string().max(400).default(""),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "image");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("상품명과 이미지 프롬프트가 필요합니다.", 400);

  const { product, slideNumber, headline, imagePrompt, artDirection, image } = parsed.data;
  const reference = image ? parseDataUrl(image) : null;
  if (image && !reference) return errorResponse("이미지 형식이 올바르지 않습니다.", 400);

  const prompt = [
    `Korean farm produce marketing photo for blog or carousel.`,
    `Product: ${product}`,
    headline ? `Context: ${headline}` : "",
    artDirection ? `Art direction: ${artDirection}` : "",
    imagePrompt,
    "Composition suitable for a blog article or Instagram (landscape or square ok).",
    "Photorealistic food photography. No watermarks, no logos, no readable text overlays.",
    reference ? "Keep the product appearance consistent with the reference photo." : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await createImage(client, { prompt, reference });
    if (!result) return errorResponse("이미지를 생성하지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json({ slideNumber, image: result });
  } catch (err) {
    return openaiErrorResponse(err, "carousel-image", "카드뉴스 이미지 생성 중 오류가 발생했습니다.");
  }
}
