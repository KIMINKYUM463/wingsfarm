import { useCallback, useEffect, useRef, useState } from 'react';
import { collectAnimated, pageLengthOf } from '@/features/editor/lib/animation';
import { exportPageAnimation, type AnimationFormat } from '@/features/editor/lib/animationExport';
import { createPageAnimator } from '@/features/editor/lib/animationPlayer';
import { downloadBlob, getMainLayer } from '@/features/editor/hooks/useImageDownload';
import { formatBytes } from '@/features/editor/lib/download-options';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useStageRefStore } from '@/features/editor/store/useStageRefStore';
import { GIF_MAX_BYTES } from '@/shared/lib/draftMedia';
import { errorMessage } from '@/shared/lib/errorMessage';
import { showToast } from '@/utils/toast';

interface ExportState {
  format: AnimationFormat;
  width: number;
  done: number;
  total: number;
}

const fileNameOf = (name: string) => name.replace(/[<>:"/\\|?*]/g, '').trim() || 'detail-page';

/**
 * 페이지 움직임 — 캔버스에서 미리보기 재생 · GIF/WebP 받기
 * - 늘 store의 최신 페이지를 읽는다 (효과를 바꾼 직후 바로 재생해도 새 효과로)
 */
export function usePageAnimation() {
  const getStage = useStageRefStore((state) => state.getStage);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportState | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => stopRef.current?.(), []);
  useEffect(() => stop, [stop]);

  const play = useCallback(
    (frameId: string) => {
      stop();
      const frame = useCanvasDataStore.getState().getFrameById(frameId);
      const stage = getStage(frameId);
      const layer = stage && getMainLayer(stage);
      const elements = frame ? collectAnimated(frame.children) : [];
      if (!frame || !layer || !elements.length) return;

      const animator = createPageAnimator(layer, elements);
      const length = pageLengthOf(frame);
      const startedAt = performance.now();
      let raf = 0;
      const finish = () => {
        cancelAnimationFrame(raf);
        animator.restore();
        layer.batchDraw();
        stopRef.current = null;
        setPlayingId(null);
      };
      const tick = (now: number) => {
        const t = (now - startedAt) / 1000;
        if (t >= length) return finish();
        animator.apply(t);
        layer.batchDraw();
        raf = requestAnimationFrame(tick);
      };
      stopRef.current = finish;
      setPlayingId(frameId);
      raf = requestAnimationFrame(tick);
    },
    [getStage, stop],
  );

  const download = async (frameId: string, format: AnimationFormat, width: number) => {
    stop();
    const { frames, productName } = useCanvasDataStore.getState();
    const frame = frames.find((f) => f.id === frameId);
    const stage = getStage(frameId);
    if (!frame || !stage) return showToast.error('페이지를 찾지 못했어요. 새로고침 후 다시 시도해 주세요.');

    setExporting({ format, width, done: 0, total: 0 });
    try {
      const blob = await exportPageAnimation(stage, frame, {
        format,
        width,
        onProgress: (done, total) => setExporting({ format, width, done, total }),
      });
      const page = frames.filter((f) => f.status === 'active').indexOf(frame) + 1;
      downloadBlob(blob, `${fileNameOf(productName ?? '')}_${page}페이지_움직임_${width}.${format}`);
      if (blob.size > GIF_MAX_BYTES) {
        showToast.warn(`파일이 ${formatBytes(blob.size)}예요. 마켓에 올릴 때 용량 제한에 걸릴 수 있어요. 움직이는 요소나 재생 길이를 줄이면 작아져요.`);
      }
    } catch (err) {
      showToast.error(errorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  return { playingId, play, stop, exporting, download };
}
