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

const ShotSchema = z.object({
  id: z.string().max(20),
  title: z.string().max(80),
  scene: z.string().max(400),
  prompt: z.string().min(10).max(2000),
});

const RequestSchema = z.object({
  image: z.string().regex(/^data:image\/(png|jpeg|webp|jpg);base64,/i).max(MAX_IMAGE),
  product: z.string().min(1).max(60),
  shot: ShotSchema,
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "image");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("상품 사진과 장면 정보가 필요합니다.", 400);
  const file = parseDataUrl(parsed.data.image);
  if (!file) return errorResponse("이미지 형식이 올바르지 않습니다.", 400);

  const prompt = [
    `Product name (Korean market): ${parsed.data.product}`,
    `Shot title: ${parsed.data.shot.title}`,
    parsed.data.shot.prompt,
    "Keep the product appearance consistent with the reference photo. Square 1:1 commercial food thumbnail. No watermarks, no fake logos, no large overlaid Korean/English text.",
  ].join("\n");

  try {
    // 업로드 사진을 참고해 같은 상품이 나오는 새 장면 생성
    const result = await client.images.edit({
      model: OPENAI_IMAGE_MODEL,
      image: await toFile(file.buffer, `product.${file.ext}`, { type: file.mime }),
      prompt,
      size: "1024x1024",
      quality: "high",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return errorResponse("이미지를 생성하지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json({
      id: parsed.data.shot.id,
      title: parsed.data.shot.title,
      image: `data:image/png;base64,${b64}`,
    });
  } catch (err) {
    return openaiErrorResponse(err, "thumbnails-generate", "썸네일 이미지 생성 중 오류가 발생했습니다.");
  }
}
