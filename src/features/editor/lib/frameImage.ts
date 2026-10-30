import type Konva from 'konva';
import type { KonvaFrameElement } from '@/shared/types/konva';
import { frameRect, getMainLayer, withExportState } from '@/features/editor/hooks/useImageDownload';
import { useStageRefStore } from '@/features/editor/store/useStageRefStore';

/**
 * 페이지 한 장 → JPG (다운로드와 같은 상태: 선택·안내 표시 숨김, 흰 배경)
 * @returns 그릴 수 없으면(화면에 아직 없는 페이지) null
 */
export async function renderFrameJpeg(frame: KonvaFrameElement, pixelRatio: number, quality = 0.9, stage?: Konva.Stage | null) {
  const target = stage ?? useStageRefStore.getState().getStage(frame.id);
  const mainLayer = target && getMainLayer(target);
  if (!target || !mainLayer) return null;
  const source = withExportState(target, mainLayer, () => mainLayer.toCanvas({ pixelRatio, ...frameRect(frame) }));
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
