'use client';

import { formatCost, MEDIA_COST } from '@/shared/lib/draftMedia';
import { useDialog } from './useDialog';

interface ConfirmAiImagesOptions {
  /** 만들 AI 사진 장수 */
  count: number;
  /** 사진 외 추가 비용 (예: AI 영상) */
  extraUsd?: number;
  /** 추가 안내 */
  hint?: string;
}

/** AI 사진을 만들기 전에 장수·예상 비용을 보여 주고 만들지 묻는다 (취소하면 false) */
export const confirmAiImages = ({ count, extraUsd = 0, hint }: ConfirmAiImagesOptions) =>
  useDialog.getState().openConfirm({
    title: `AI 사진 ${count}장을 만들까요?`,
    description: `올린 상품 사진과 상품명을 바탕으로 장면마다 다른 사진을 만들어요. 예상 ${formatCost(
      count * MEDIA_COST.aiImageUsd + extraUsd,
    )} (등록한 Gemini 키로 청구)`,
    hint: hint ?? '만들지 않으면 사진 자리는 비워 두고 바로 만들어요.',
    confirmText: '만들기',
    cancelText: '만들지 않기',
  });
