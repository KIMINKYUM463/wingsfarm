import { z } from 'zod';

/**
 * AI 이미지 생성 프롬프트 스키마
 * - 최소 4글자 이상 (3글자 이하는 유효성 통과 안됨)
 */
export const imageGeneratorSchema = z.object({
  prompt: z.string().min(3),
});

export type ImageGeneratorData = z.infer<typeof imageGeneratorSchema>;
