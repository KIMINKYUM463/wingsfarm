import { z } from 'zod';

export const apiKeySchema = z.object({
  apiKey: z.string().min(1, 'API 키를 입력해 주세요.'),
});

export type ApiKeyFormData = z.infer<typeof apiKeySchema>;
