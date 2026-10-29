import { rateLimit } from "@/lib/server/rateLimit";
import { z } from "zod";
import { OPENAI_MODEL, errorResponse, missingKeyResponse, openaiClient, openaiErrorResponse, parseDataUrl } from "@/lib/server/openai";

const MAX_IMAGE = 8_000_000;

const RequestSchema = z.object({
  image: z.string().regex(/^data:image\/(png|jpeg|webp|jpg);base64,/i).max(MAX_IMAGE),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parseDataUrl(parsed.data.image)) {
    return errorResponse("상품 사진(PNG/JPG)을 확인해 주세요.", 400);
  }

  try {
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content:
            "당신은 농수산물 스마트스토어 셀러입니다. 사진을 보고 한국어 상품명만 한 줄로 적습니다. " +
            "품종·구성·선물세트 여부를 짧게 반영하세요. 예: 사과 배 선물세트, 제주 감귤 5kg, 해남 절임배추. " +
            "따옴표·설명문·문장 부호 없이 상품명만. 최대 30자.",
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: "이 상품의 스마트스토어용 상품명을 한 줄로 적어 주세요." },
            { type: "input_image", image_url: parsed.data.image, detail: "low" },
          ],
        },
      ],
    });

    const raw = (response.output_text ?? "").trim().replace(/^["'「『]|["'」』]$/g, "").trim();
    const product = raw.slice(0, 40);
    if (!product) return errorResponse("상품명을 읽지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json({ product });
  } catch (err) {
    return openaiErrorResponse(err, "thumbnails-name", "상품명 분석 중 오류가 발생했습니다.");
  }
}
