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

const ShotSchema = z.object({
  id: z.string().max(20),
  title: z.string().max(80),
  scene: z.string().max(400),
  prompt: z.string().min(10).max(2000),
});

const RequestSchema = z.object({
  image: imageDataUrl,
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
  const reference = parseDataUrl(parsed.data.image);
  if (!reference) return errorResponse("이미지 형식이 올바르지 않습니다.", 400);

  const prompt = [
    `Product name (Korean market): ${parsed.data.product}`,
    `Shot title: ${parsed.data.shot.title}`,
    parsed.data.shot.prompt,
    "Keep the product appearance consistent with the reference photo. Square 1:1 commercial food thumbnail. No watermarks, no fake logos, no large overlaid Korean/English text.",
  ].join("\n");

  try {
    const image = await createImage(client, { prompt, reference });
    if (!image) return errorResponse("이미지를 생성하지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json({ id: parsed.data.shot.id, title: parsed.data.shot.title, image });
  } catch (err) {
    return openaiErrorResponse(err, "thumbnails-generate", "썸네일 이미지 생성 중 오류가 발생했습니다.");
  }
}
