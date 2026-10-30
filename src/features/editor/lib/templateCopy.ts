import type { TemplateCopyStatus } from '@/features/editor/types';
import { showToast } from '@/utils/toast';

/** 템플릿 문구를 상품에 맞게 쓰는 동안 보여 줄 안내 */
export const TEMPLATE_COPY_LOADING = '상품에 맞게 문구를 쓰고 있어요';

const FALLBACK_MESSAGES: Record<Exclude<TemplateCopyStatus, 'written'>, string> = {
  no_key: 'Gemini API 키가 없어 템플릿 예시 문구를 그대로 넣었어요. 키를 등록하면 상품에 맞게 자동으로 써 드려요.',
  failed: '일부 문구를 상품에 맞게 쓰지 못해 템플릿 예시 문구로 두었어요. "AI로 수정"으로 다시 써 보세요.',
};

/** 템플릿 예시 문구가 그대로 남았을 때만 알린다 */
export function notifyTemplateCopy(status: TemplateCopyStatus | undefined) {
  if (status && status !== 'written') showToast.warn(FALLBACK_MESSAGES[status]);
}
