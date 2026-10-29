import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getHeroMotion, requestHeroGif, startHeroMotion } from '@/features/editor/api';
import { downloadBlob, exportHeroLayers } from '@/features/editor/hooks/useImageDownload';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useStageRefStore } from '@/features/editor/store/useStageRefStore';
import { queryKeys } from '@/shared/constants/queryKeys';
import { errorMessage } from '@/shared/lib/errorMessage';
import type { HeroMotionKind } from '@/shared/types/heroMotion';
import { showToast } from '@/utils/toast';

const POLL_MS = 4000;

/**
 * 맨 위 움직이는 컷 — 상태 확인(만드는 중이면 4초마다) · 다시 만들기 · GIF 받기
 * stale: 움직이는 컷을 만든 뒤 맨 위 사진을 바꿨거나 지웠으면 다시 만들어야 한다
 */
export function useHeroMotion(projectId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.EDITOR.heroMotion(projectId);
  const { data: motion = null } = useQuery({
    queryKey: key,
    queryFn: () => getHeroMotion(projectId),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? POLL_MS : false),
    refetchOnWindowFocus: false,
  });

  const currentAssetId = useCanvasDataStore((state) => {
    if (!motion) return undefined;
    const element = state.flatElements.get(motion.elementId);
    return element && 'assetId' in element ? (element.assetId as string | undefined) : undefined;
  });
  const stale = Boolean(motion && motion.status === 'ready' && currentAssetId !== motion.assetId);

  const start = useMutation({
    mutationFn: (kind: HeroMotionKind) => startHeroMotion(projectId, kind),
    onSuccess: (next) => queryClient.setQueryData(key, next),
    onError: (err) => showToast.error(errorMessage(err)),
  });

  /** 지금 만들고 있는 GIF 너비 (없으면 null) */
  const [downloadingGif, setDownloadingGif] = useState<number | null>(null);
  const getStage = useStageRefStore((state) => state.getStage);
  const frames = useCanvasDataStore((state) => state.frames);
  const productName = useCanvasDataStore((state) => state.productName);

  const downloadGif = async (outWidth: number) => {
    if (!motion?.clipUrl || stale) return;
    const frame = frames.find((f) => f.id === motion.frameId);
    const stage = getStage(motion.frameId);
    const layers = frame && stage ? exportHeroLayers(stage, frame, motion.elementId) : null;
    if (!layers) return showToast.error('맨 위 섹션을 찾지 못했어요. 페이지를 새로고침 후 다시 시도해주세요.');
    setDownloadingGif(outWidth);
    try {
      const gif = await requestHeroGif(projectId, { ...layers, outWidth });
      downloadBlob(gif, `${productName || 'detail-page'}_움직이는컷_${outWidth}.gif`);
    } catch (err) {
      showToast.error(errorMessage(err));
    } finally {
      setDownloadingGif(null);
    }
  };

  return { motion, stale, start, downloadGif, downloadingGif };
}
