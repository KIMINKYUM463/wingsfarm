'use client';

import { useCallback } from 'react';
import { collectBlankImageSlots } from '@/features/editor/lib/element-finder';
import { useGenerateAIImages } from '@/features/editor/hooks/useGenerateAIImages';
import { useActiveFrames, useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { confirmAiImages } from '@/shared/ui/Dialog';
import { showToast } from '@/utils/toast';

/**
 * 비어 있는 `_image` 자리에 AI 사진을 한 번에 만들어 넣는다.
 * 장수·비용을 확인한 뒤, 기존 일괄 생성 큐(useGenerateAIImages)에 넘긴다.
 */
export function useFillBlankSlots() {
  const frames = useActiveFrames();
  const count = collectBlankImageSlots(frames).length;
  const { mutateAsync, isPending } = useGenerateAIImages();

  const fill = useCallback(async () => {
    if (isPending) return;
    const slots = collectBlankImageSlots(useCanvasDataStore.getState().frames.filter((frame) => frame.status === 'active'));
    if (!slots.length) {
      showToast.warn('비어 있는 사진 자리가 없어요.');
      return;
    }
    const ok = await confirmAiImages({
      count: slots.length,
      hint: '빈 자리마다 다른 장면으로 만들어 바로 넣어요. 만드는 동안 새로고침하지 마세요.',
    });
    if (ok) await mutateAsync(slots);
  }, [isPending, mutateAsync]);

  return { count, fill, isPending };
}
