import 'server-only';
import OpenAI from 'openai';
import { openaiClient } from '@/lib/server/openai';
import type { InlineImage } from './gemini';
import { canFallback } from './geminiModels';
import { ApiError } from './http';

/**
 * 상세페이지 판매 문구(copy 등급)는 OpenAI 키가 있으면 GPT가 쓴다 — Gemini보다 AI 말투가 덜하다
 * - 키가 없거나 한도·서버 문제로 실패하면 null을 돌려주고, 호출한 쪽이 Gemini로 대신 쓴다
 * - 키가 틀렸거나 권한이 없으면 Gemini로 몰래 넘어가지 않고 오류로 알린다
 */
export const OPENAI_COPY_MODEL = process.env.OPENAI_COPY_MODEL || 'gpt-6-astra';

const SYSTEM_PROMPT =
  '너는 한국 이커머스 상세페이지 카피라이터다. 사람이 직접 쓴 것처럼 자연스러운 한국어로 쓰고, 요청한 형식의 JSON 객체 하나만 출력한다.';

const toImageInput = (image: InlineImage) => ({
  type: 'input_image' as const,
  image_url: `data:${image.mimeType};base64,${image.data}`,
  detail: 'auto' as const,
});

export async function writeCopyWithOpenAI(prompt: string, images: InlineImage[] = []): Promise<string | null> {
  const client = openaiClient();
  if (!client) return null;
  try {
    const response = await client.responses.create({
      model: OPENAI_COPY_MODEL,
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: [{ type: 'input_text', text: prompt }, ...images.map(toImageInput)] },
      ],
      text: { format: { type: 'json_object' } },
    });
    return response.output_text || null;
  } catch (err) {
    if (err instanceof OpenAI.APIError && !canFallback(err.status ?? 500, err.message)) {
      throw new ApiError(
        400,
        err.status === 401
          ? 'OpenAI API 키가 올바르지 않아요. .env.local의 OPENAI_API_KEY를 확인하고 서버를 다시 켜 주세요.'
          : `OpenAI 키로 ${OPENAI_COPY_MODEL} 모델을 쓸 수 없어요. 키 권한이나 OPENAI_COPY_MODEL 값을 확인해 주세요.`,
      );
    }
    console.warn(`[lever] ${OPENAI_COPY_MODEL} 문구 작성 실패 → Gemini로 다시 시도:`, err instanceof Error ? err.message : err);
    return null;
  }
}
