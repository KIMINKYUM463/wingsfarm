import type Konva from 'konva';
import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import type { KonvaFrameElement } from '@/shared/types/konva';
import { frameRect, getMainLayer, withExportState } from '@/features/editor/hooks/useImageDownload';
import { ANIMATION_FPS, collectAnimated, frameTimes, pageLengthOf } from './animation';
import { createPageAnimator } from './animationPlayer';
import { diffIndexes } from './gifFrames';
import { muxAnimatedWebp, type WebpFrame } from './webpAnim';

export type AnimationFormat = 'gif' | 'webp';

const WEBP_QUALITY = 0.9;
const FRAME_MS = 1000 / ANIMATION_FPS;

/** 한 장 만들 때마다 화면이 멈추지 않게 잠깐 양보 */
const yieldToUi = () => new Promise((resolve) => setTimeout(resolve, 0));

/** 투명한 곳은 흰색으로 (GIF·WebP 모두 불투명하게) */
function flatten(source: HTMLCanvasElement) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

const pixelsOf = (canvas: HTMLCanvasElement) => canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height).data;

const toWebpBytes = (canvas: HTMLCanvasElement) =>
  new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== 'image/webp') return reject(new Error('이 브라우저는 WebP 저장을 지원하지 않아요. GIF로 받아 주세요.'));
        blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
      },
      'image/webp',
      WEBP_QUALITY,
    ),
  );

async function encodeGif(capture: (t: number) => HTMLCanvasElement, times: number[], pageLength: number, onFrame: () => void) {
  // 모든 요소가 다 나타난 마지막 모습에서 색표를 뽑아 모든 장이 같이 쓴다
  const palette = quantize(pixelsOf(capture(pageLength)), 255);
  const transparentIndex = palette.length;
  const gif = GIFEncoder();
  let first = true;
  const write = ({ indexes, delay }: { indexes: Uint8Array; delay: number }, width: number, height: number) => {
    gif.writeFrame(
      indexes,
      width,
      height,
      first
        ? { palette: [...palette, [255, 255, 255]], delay, repeat: 0, dispose: 1 }
        : { delay, transparent: true, transparentIndex, dispose: 1 },
    );
    first = false;
  };

  let previous: Uint8Array | null = null;
  let pending: { indexes: Uint8Array; delay: number } | null = null;
  let size = { width: 0, height: 0 };
  for (const t of times) {
    const canvas = capture(t);
    size = { width: canvas.width, height: canvas.height };
    const index = applyPalette(pixelsOf(canvas), palette);
    const { indexes, changed } = diffIndexes(previous, index, transparentIndex);
    if (pending && !changed) {
      pending.delay += FRAME_MS;
    } else {
      if (pending) write(pending, size.width, size.height);
      pending = { indexes, delay: FRAME_MS };
    }
    previous = index;
    onFrame();
    await yieldToUi();
  }
  if (pending) write(pending, size.width, size.height);
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

async function encodeWebp(capture: (t: number) => HTMLCanvasElement, times: number[], onFrame: () => void) {
  const frames: WebpFrame[] = [];
  for (const t of times) {
    frames.push({ file: await toWebpBytes(capture(t)), duration: FRAME_MS });
    onFrame();
    await yieldToUi();
  }
  return new Blob([muxAnimatedWebp(frames)], { type: 'image/webp' });
}

/**
 * 페이지 한 장을 움직이는 GIF·WebP로
 * - 장마다 짧게(동기로) 움직임 적용 → 캡처 → 원래대로 — 화면에는 중간 모습이 보이지 않는다
 * @param width 내보낼 폭 (860·780·1080 등)
 */
export async function exportPageAnimation(
  stage: Konva.Stage,
  frame: KonvaFrameElement,
  options: { format: AnimationFormat; width: number; onProgress?: (done: number, total: number) => void },
) {
  const layer = getMainLayer(stage);
  const elements = collectAnimated(frame.children);
  if (!layer || !elements.length) throw new Error('움직임을 넣은 요소가 없어요.');

  const animator = createPageAnimator(layer, elements);
  const rect = frameRect(frame);
  const pixelRatio = options.width / rect.width;
  const capture = (t: number) =>
    flatten(
      withExportState(stage, layer, () => {
        animator.apply(t);
        try {
          return layer.toCanvas({ ...rect, pixelRatio });
        } finally {
          animator.restore();
        }
      }),
    );

  const pageLength = pageLengthOf(frame);
  const times = frameTimes(pageLength);
  let done = 0;
  const onFrame = () => options.onProgress?.(++done, times.length);
  return options.format === 'gif' ? encodeGif(capture, times, pageLength, onFrame) : encodeWebp(capture, times, onFrame);
}
