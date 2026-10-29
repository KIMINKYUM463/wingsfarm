import { z } from 'zod';

/**
 * AI 텍스트 생성 프롬프트 스키마
 * - 최소 4글자 이상 (3글자 이하는 유효성 통과 안됨)
 */
export const textGeneratorSchema = z.object({
  prompt: z.string().min(3),
});

export type TextGeneratorData = z.infer<typeof textGeneratorSchema>;
