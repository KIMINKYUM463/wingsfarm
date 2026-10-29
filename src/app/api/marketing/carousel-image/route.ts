import { rateLimit } from "@/lib/server/rateLimit";
import { toFile } from "openai";
import { z } from "zod";
import {
  OPENAI_IMAGE_MODEL,
  errorResponse,
  missingKeyResponse,
  openaiClient,
  openaiErrorResponse,
  parseDataUrl,
} from "@/lib/server/openai";

const MAX_IMAGE = 8_000_000;

const RequestSchema = z.object({
  /** 업로드한 상품 참고 사진 (없으면 프롬프트만으로 생성) */
  image: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp|jpg);base64,/i)
    .max(MAX_IMAGE)
    .optional(),
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

  const prompt = [
    `Korean farm produce marketing photo for blog or carousel.`,
    `Product: ${product}`,
    headline ? `Context: ${headline}` : "",
    artDirection ? `Art direction: ${artDirection}` : "",
    imagePrompt,
    "Composition suitable for a blog article or Instagram (landscape or square ok).",
    "Photorealistic food photography. No watermarks, no logos, no readable text overlays.",
    image ? "Keep the product appearance consistent with the reference photo." : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    let b64: string | undefined;

    if (image) {
      const file = parseDataUrl(image);
      if (!file) return errorResponse("이미지 형식이 올바르지 않습니다.", 400);
      const result = await client.images.edit({
        model: OPENAI_IMAGE_MODEL,
        image: await toFile(file.buffer, `product.${file.ext}`, { type: file.mime }),
        prompt,
        size: "1024x1024",
        quality: "high",
      });
      b64 = result.data?.[0]?.b64_json;
    } else {
      const result = await client.images.generate({
        model: OPENAI_IMAGE_MODEL,
        prompt,
        size: "1024x1024",
        quality: "high",
      });
      b64 = result.data?.[0]?.b64_json;
    }

    if (!b64) return errorResponse("이미지를 생성하지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json({
      slideNumber,
      image: `data:image/png;base64,${b64}`,
    });
  } catch (err) {
    return openaiErrorResponse(err, "carousel-image", "카드뉴스 이미지 생성 중 오류가 발생했습니다.");
  }
}
