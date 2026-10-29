import { z } from 'zod';

/**
 * 프로젝트 설정 모달 폼 스키마
 */
export const projectSetupFormSchema = z.object({
  productName: z.string().min(1, '상품명을 입력해주세요.'),
});

export type ProjectSetupFormData = z.infer<typeof projectSetupFormSchema>;
