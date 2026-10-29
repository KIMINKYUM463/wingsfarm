import { z } from 'zod';

/**
 * AI 이미지 생성 폼 스키마
 *
 * - styleId: 연출 스타일 ID (필수)
 * - prompt: 프롬프트 (필수, 2~1000자)
 * - assetId: 참조 이미지 ID (선택)
 */
export const aiImageFormSchema = z.object({
  styleId: z.string().min(1),
  prompt: z.string().min(2).max(1000),
  assetId: z.string().optional().or(z.literal('')),
});

export type AIImageFormData = z.infer<typeof aiImageFormSchema>;
