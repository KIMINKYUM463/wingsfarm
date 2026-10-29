import OpenAI, { toFile } from "openai";
import { z } from "zod";

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-6-astra";
/** 썸네일 이미지 생성 (images.edit / generate) */
export const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

export const errorResponse = (message: string, status: number) => Response.json({ error: message }, { status });

export function openaiClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

export const missingKeyResponse = () =>
  errorResponse("OPENAI_API_KEY가 설정되지 않았습니다. 프로젝트 폴더의 .env.local 파일에 키를 넣고 서버를 다시 시작하세요.", 503);

export function openaiErrorResponse(err: unknown, tag: string, fallback: string) {
  if (err instanceof OpenAI.APIError) {
    const message =
      err.status === 401
        ? "OpenAI API 키가 올바르지 않습니다."
        : err.status === 429
          ? "OpenAI 사용 한도를 초과했거나 요청이 너무 많습니다. 잠시 후 다시 시도하세요."
          : `OpenAI 오류: ${err.message}`;
    return errorResponse(message, err.status ?? 502);
  }
  console.error(`[${tag}]`, err);
  return errorResponse(fallback, 500);
}

/** 요청 본문의 업로드 이미지(data URL) 검증용 */
export const imageDataUrl = z
  .string()
  .regex(/^data:image\/(png|jpeg|webp|jpg);base64,/i)
  .max(8_000_000);

/** data URL → OpenAI toFile용 Buffer + mime */
export function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  return { mime, buffer: Buffer.from(match[2], "base64"), ext: mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg" };
}

export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";

/** 참고 사진이 있으면 images.edit(같은 상품 유지), 없으면 images.generate. 실패 시 null */
export async function createImage(
  client: OpenAI,
  { prompt, reference, size = "1024x1024" }: { prompt: string; reference?: ReturnType<typeof parseDataUrl>; size?: ImageSize },
) {
  const result = reference
    ? await client.images.edit({
        model: OPENAI_IMAGE_MODEL,
        image: await toFile(reference.buffer, `product.${reference.ext}`, { type: reference.mime }),
        prompt,
        size,
        quality: "high",
      })
    : await client.images.generate({ model: OPENAI_IMAGE_MODEL, prompt, size, quality: "high" });
  const b64 = result.data?.[0]?.b64_json;
  return b64 ? `data:image/png;base64,${b64}` : null;
}
