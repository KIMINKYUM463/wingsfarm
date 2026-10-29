import { useState } from 'react';
import Konva from 'konva';
import JSZip from 'jszip';
import { KonvaFrameElement } from '@/shared/types/konva';
import { useActiveFrames, useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useStageRefStore } from '@/features/editor/store/useStageRefStore';
import { combineImagesClient } from '@/features/editor/utils/combineImagesClient';
import { showToast } from '@/utils/toast';

type ImageFormat = 'png' | 'jpg';

interface ExportConfig {
  format: ImageFormat;
  mimeType: 'image/png' | 'image/jpeg';
  quality: number;
  extension: string;
  pixelRatio: number;
}

interface ExportedFrame {
  dataUrl: string;
  fileName: string;
}

/**
 * 이미지 다운로드 훅
 *
 * - 한 장 이미지: 클라이언트 Canvas API로 합성 (Vercel 4.5MB 제한 우회)
 * - 개별 이미지: ZIP으로 묶어서 다운로드
 */
export const useImageDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const frames = useActiveFrames();
  const productName = useCanvasDataStore((state) => state.productName);
  const getStage = useStageRefStore((state) => state.getStage);

  // ===== 유틸리티 함수 =====

  // 파일명에 사용 불가능한 문자만 제거 (띄어쓰기 유지)
  const sanitizeFileName = (name: string): string => name.replace(/[<>:"/\\|?*]/g, '').trim();

  const getExportConfig = (format: ImageFormat): ExportConfig => ({
    format,
    mimeType: format === 'jpg' ? 'image/jpeg' : 'image/png',
    quality: format === 'jpg' ? 0.92 : 1,
    extension: format === 'jpg' ? 'jpg' : 'png',
    pixelRatio: 2,
  });

  const getMainLayer = (stage: Konva.Stage): Konva.Layer | null => {
    for (const layer of stage.getLayers()) {
      if (layer.findOne('.clip-group') || layer.findOne('[name="clip-group"]')) {
        return layer;
      }
    }
    const layers = stage.getLayers();
    return layers.length > 1 ? layers[1] : layers[0] || null;
  };

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const generateFrameFileName = (
    index: number,
    part2: string | undefined,
    frameName: string | undefined,
    extension: string,
  ): string => {
    const paddedIndex = String(index + 1).padStart(3, '0');
    const parts = [paddedIndex];

    if (part2) parts.push(sanitizeFileName(part2));
    if (frameName) parts.push(sanitizeFileName(frameName));

    return `${parts.join('_')}.${extension}`;
  };

  const applyWhiteBackground = async (
    dataUrl: string,
    mimeType: string,
    quality: number,
  ): Promise<string> => {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL(mimeType, quality);
  };

  // ===== 프레임 Export 핵심 로직 =====

  const exportFrame = async (
    frame: KonvaFrameElement,
    config: ExportConfig,
  ): Promise<string | null> => {
    const stage = getStage(frame.id);
    if (!stage) return null;

    const mainLayer = getMainLayer(stage);
    if (!mainLayer) return null;

    const frameWidth = frame.width || 860;
    const frameHeight = frame.height || 1080;

    // UI 요소 숨기기
    const uiElements = [
      ...stage.find('._hover-overlay'),
      ...stage.find('._hover-outline'),
      ...stage.find('._selection-ui'),
      ...stage.find('._group-overlay'),
      ...stage.find('._frame-overlay'),
    ];
    const originalVisibility = uiElements.map((node) => node.visible());
    uiElements.forEach((node) => node.visible(false));

    // 프레임 테두리 숨기기
    const frameBackground = mainLayer.findOne('.frame-background') as Konva.Rect | null;
    const originalStroke = frameBackground?.strokeWidth() ?? 1;
    frameBackground?.strokeWidth(0);

    // 다른 레이어 숨기기
    const allLayers = stage.getLayers();
    const layerVisibility = allLayers.map((l) => l.visible());
    allLayers.forEach((l) => l !== mainLayer && l.visible(false));

    // Layer offset/scale 임시 제거
    const originalTransform = {
      offsetX: mainLayer.offsetX(),
      offsetY: mainLayer.offsetY(),
      scaleX: mainLayer.scaleX(),
      scaleY: mainLayer.scaleY(),
    };

    mainLayer.offsetX(0);
    mainLayer.offsetY(0);
    mainLayer.scaleX(1);
    mainLayer.scaleY(1);
    stage.draw();

    // Export
    let dataUrl: string | null = null;
    try {
      dataUrl = mainLayer.toDataURL({
        mimeType: config.mimeType,
        pixelRatio: config.pixelRatio,
        x: 0,
        y: 0,
        width: frameWidth,
        height: frameHeight,
        ...(config.format === 'jpg' && { quality: config.quality }),
      });

      // Safari 메모리 부족 시 빈 문자열 반환 체크
      if (!dataUrl || !dataUrl.startsWith('data:')) {
        console.error('[Download] Frame export returned invalid data:', frame.id);
        dataUrl = null;
      }

      // JPG는 흰색 배경 합성
      if (config.format === 'jpg' && dataUrl) {
        dataUrl = await applyWhiteBackground(dataUrl, config.mimeType, config.quality);
      }
    } catch (err) {
      console.error('[Download] Frame export failed:', frame.id, err);
    }

    // 복원
    mainLayer.offsetX(originalTransform.offsetX);
    mainLayer.offsetY(originalTransform.offsetY);
    mainLayer.scaleX(originalTransform.scaleX);
    mainLayer.scaleY(originalTransform.scaleY);
    allLayers.forEach((l, i) => l.visible(layerVisibility[i]));
    uiElements.forEach((node, i) => node.visible(originalVisibility[i]));
    frameBackground?.strokeWidth(originalStroke);
    stage.draw();

    return dataUrl;
  };

  // ===== 다운로드 함수 =====

  const downloadFile = (dataUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllPagesAsImage = async (format: ImageFormat) => {
    if (!frames.length) return;
    setIsDownloading(true);

    try {
      const config = getExportConfig(format);
      const stageImages: string[] = [];

      for (const frame of frames) {
        const dataUrl = await exportFrame(frame, config);
        if (dataUrl) stageImages.push(dataUrl);
      }

      // 모든 프레임 export 실패
      if (!stageImages.length) {
        showToast.error('이미지를 내보낼 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
        return;
      }

      // 일부 프레임만 성공한 경우 알림
      if (stageImages.length < frames.length) {
        showToast.warn(
          `${frames.length}개 중 ${stageImages.length}개만 다운로드됩니다. 일부 이미지를 불러오지 못했습니다.`,
        );
      }

      // 클라이언트에서 이미지 합성 (Vercel 4.5MB 제한 우회)
      const result = await combineImagesClient({
        images: stageImages,
        format,
        quality: format === 'jpg' ? 0.92 : undefined,
      });

      // 분할된 경우 알림
      if (result.splitCount > 1) {
        const browserNotes: Record<string, string> = {
          safari: ' (Safari 브라우저 제한)',
          firefox: ' (Firefox 브라우저 제한)',
          chrome: '',
        };
        const browserNote = browserNotes[result.splitBrowser] ?? '';
        showToast.warn(`이미지 크기가 커서 ${result.splitCount}개로 나누어 다운로드됩니다.${browserNote}`);
      }

      // 다운로드
      const fileName = productName ? sanitizeFileName(productName) : `lever-page-${Date.now()}`;

      for (let i = 0; i < result.dataUrls.length; i++) {
        const suffix = result.splitCount > 1 ? `-${i + 1}` : '';
        downloadFile(result.dataUrls[i], `${fileName}${suffix}.${config.extension}`);

        if (i < result.dataUrls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    } catch (error) {
      console.error('[Download] 이미지 다운로드 실패:', error);
      showToast.error('이미지 다운로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadIndividualImages = async (format: ImageFormat) => {
    if (!frames.length) return;
    setIsDownloading(true);

    try {
      const config = getExportConfig(format);
      const exportedFrames: ExportedFrame[] = [];

      // 모든 프레임 Export
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const dataUrl = await exportFrame(frame, config);
        if (!dataUrl) continue;

        exportedFrames.push({
          dataUrl,
          fileName: generateFrameFileName(i, frame.part2, frame.name, config.extension),
        });
      }

      // 모든 프레임 export 실패
      if (!exportedFrames.length) {
        showToast.error('이미지를 내보낼 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
        return;
      }

      // 일부 프레임만 성공한 경우 알림
      if (exportedFrames.length < frames.length) {
        showToast.warn(
          `${frames.length}개 중 ${exportedFrames.length}개만 다운로드됩니다. 일부 이미지를 불러오지 못했습니다.`,
        );
      }

      // ZIP 파일로 묶어서 다운로드
      await downloadAsZip(exportedFrames);
    } catch (error) {
      console.error('[Download] 개별 이미지 다운로드 실패:', error);
      showToast.error('이미지 다운로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadAsZip = async (exportedFrames: ExportedFrame[]) => {
    const zip = new JSZip();
    const folderName = productName ? sanitizeFileName(productName) : `lever-page-${Date.now()}`;
    const folder = zip.folder(folderName)!;

    // 이미지 파일들을 폴더에 추가
    for (const { dataUrl, fileName } of exportedFrames) {
      const base64Data = dataUrl.split(',')[1];
      folder.file(fileName, base64Data, { base64: true });
    }

    // ZIP 생성 및 다운로드
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    downloadFile(url, `${folderName}.zip`);
    URL.revokeObjectURL(url);
  };

  return {
    downloadAllPagesAsPng: () => downloadAllPagesAsImage('png'),
    downloadAllPagesAsJpg: () => downloadAllPagesAsImage('jpg'),
    downloadIndividualAsPng: () => downloadIndividualImages('png'),
    downloadIndividualAsJpg: () => downloadIndividualImages('jpg'),
    isDownloading,
  };
};
