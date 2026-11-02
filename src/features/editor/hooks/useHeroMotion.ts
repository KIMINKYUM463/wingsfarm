import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { applyHeroMotion, getHeroMotion, requestHeroGif, startHeroMotion, type HeroMotionRequest } from '@/features/editor/api';
import { downloadBlob } from '@/features/editor/hooks/useImageDownload';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useHeroVideoStore } from '@/features/editor/store/useHeroVideoStore';
import { queryKeys } from '@/shared/constants/queryKeys';
import { errorMessage } from '@/shared/lib/errorMessage';
import { isMotionApplied, type HeroMotionInfo } from '@/shared/types/heroMotion';
import { showToast } from '@/utils/toast';

const POLL_MS = 4000;

/**
 * 맨 위 움직이는 컷 — 상태 확인(만드는 중이면 4초마다) · 만들기 · 첫 섹션 위에 넣기/빼기 · GIF 받기
 * stale: 사진으로 만든 컷인데 맨 위 사진을 바꿨거나 지웠으면 다시 만들어야 한다 (무료 영상은 사진과 무관)
 * 적용된 컷은 useHeroVideoStore로 에디터 맨 위 영상 섹션·미리보기에 보인다
 * 에디터에서 한 번만 부르고(KonvaEditor) 필요한 곳에 넘긴다
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
    if (!motion?.elementId) return undefined;
    const element = state.flatElements.get(motion.elementId);
    return element && 'assetId' in element ? (element.assetId as string | undefined) : undefined;
  });
  const stale = Boolean(motion && motion.kind !== 'stock' && motion.status === 'ready' && currentAssetId !== motion.assetId);
  const ready = Boolean(motion?.status === 'ready' && motion.clipUrl && !stale);
  const applied = ready && isMotionApplied(motion!);

  const setHeroVideo = useHeroVideoStore((state) => state.setHeroVideo);
  const playing = applied ? motion! : null;
  const playingUrl = playing?.clipUrl ?? null;
  const playingWidth = playing?.width ?? 0;
  const playingHeight = playing?.height ?? 0;
  useEffect(() => {
    if (!playingUrl || !playingWidth || !playingHeight) return;
    setHeroVideo({ url: playingUrl, width: playingWidth, height: playingHeight });
    return () => setHeroVideo(null);
  }, [playingUrl, playingWidth, playingHeight, setHeroVideo]);

  const save = (next: HeroMotionInfo | null) => queryClient.setQueryData(key, next);

  const start = useMutation({
    mutationFn: (request: HeroMotionRequest) => startHeroMotion(projectId, request),
    onSuccess: save,
    onError: (err) => showToast.error(errorMessage(err)),
  });

  /** true = 첫 섹션 위에 넣기, false = 빼기 */
  const apply = useMutation({
    mutationFn: (value: boolean) => applyHeroMotion(projectId, value),
    onSuccess: save,
    onError: (err) => showToast.error(errorMessage(err)),
  });

  /** 지금 만들고 있는 GIF 너비 (없으면 null) */
  const [downloadingGif, setDownloadingGif] = useState<number | null>(null);
  const productName = useCanvasDataStore((state) => state.productName);

  const downloadGif = async (outWidth: number) => {
    if (!ready) return;
    setDownloadingGif(outWidth);
    try {
      const gif = await requestHeroGif(projectId, outWidth);
      downloadBlob(gif, `${productName || 'detail-page'}_움직이는컷_${outWidth}.gif`);
    } catch (err) {
      showToast.error(errorMessage(err));
    } finally {
      setDownloadingGif(null);
    }
  };

  return { motion, stale, ready, applied, start, apply, downloadGif, downloadingGif };
}

export type HeroMotionState = ReturnType<typeof useHeroMotion>;
