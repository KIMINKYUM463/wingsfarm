import { useState } from 'react';
import Konva from 'konva';
import JSZip from 'jszip';
import { KonvaFrameElement } from '@/shared/types/konva';
import { useActiveFrames, useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useStageRefStore } from '@/features/editor/store/useStageRefStore';
import { combineImagesClient, MIME_TYPES, type CombineFormat } from '@/features/editor/utils/combineImagesClient';
import { CANVAS_WIDTH, qualityValue, type DownloadOptions } from '@/features/editor/lib/download-options';
import { showToast } from '@/utils/toast';

interface ExportConfig {
  format: CombineFormat;
  quality: number;
  /** 캔버스 폭 대비 배율 (780px → 0.907) */
  pixelRatio: number;
}

interface ExportedFrame {
  dataUrl: string;
  fileName: string;
}

const EXTENSIONS: Record<CombineFormat, string> = { jpg: 'jpg', png: 'png', webp: 'webp' };

// 파일명에 사용 불가능한 문자만 제거 (띄어쓰기 유지)
const sanitizeFileName = (name: string): string => name.replace(/[<>:"/\\|?*]/g, '').trim();

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const generateFrameFileName = (index: number, part2: string | undefined, frameName: string | undefined, extension: string) => {
  const parts = [String(index + 1).padStart(3, '0')];
  if (part2) parts.push(sanitizeFileName(part2));
  if (frameName && frameName !== part2) parts.push(sanitizeFileName(frameName));
  return `${parts.join('_')}.${extension}`;
};

const downloadFile = (href: string, fileName: string) => {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = href;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  downloadFile(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** JPG는 투명 영역을 흰 배경으로 */
const applyWhiteBackground = async (dataUrl: string, quality: number) => {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL(MIME_TYPES.jpg, quality);
};

const getMainLayer = (stage: Konva.Stage): Konva.Layer | null => {
  for (const layer of stage.getLayers()) {
    if (layer.findOne('.clip-group') || layer.findOne('[name="clip-group"]')) return layer;
  }
  const layers = stage.getLayers();
  return layers.length > 1 ? layers[1] : layers[0] || null;
};

/** 자사몰용 상세 HTML (images 폴더와 함께 올려 쓰는 정적 페이지) */
const buildDetailHtml = (title: string, width: number, fileNames: string[]) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; }
  .detail-page { max-width: ${width}px; margin: 0 auto; }
  .detail-page img { display: block; width: 100%; height: auto; }
</style>
</head>
<body>
<!-- 자사몰 상세 편집기에는 .detail-page 블록만 붙여 넣고, images 폴더를 쇼핑몰 서버에 올린 주소로 바꿔 주세요 -->
<div class="detail-page">
${fileNames.map((name, i) => `  <img src="images/${name}" alt="${escapeHtml(title)} ${i + 1}" loading="${i < 2 ? 'eager' : 'lazy'}">`).join('\n')}
</div>
</body>
</html>
`;

/**
 * 상세페이지 다운로드 훅
 *
 * - 판매처 폭(860·780·1080·직접 지정)에 맞춰 렌더링 배율을 정한다
 * - 한 장 이미지: 클라이언트 Canvas API로 합성 (형식별 최대 높이를 넘으면 자동 분할)
 * - 페이지별 이미지: ZIP으로 묶어서 다운로드
 * - HTML: index.html + images/ 를 ZIP으로
 */
export const useImageDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const frames = useActiveFrames();
  const productName = useCanvasDataStore((state) => state.productName);
  const getStage = useStageRefStore((state) => state.getStage);

  const exportFrame = async (frame: KonvaFrameElement, config: ExportConfig): Promise<string | null> => {
    const stage = getStage(frame.id);
    const mainLayer = stage && getMainLayer(stage);
    if (!stage || !mainLayer) return null;

    const frameWidth = frame.width || CANVAS_WIDTH;
    const frameHeight = frame.height || 1080;

    // UI 요소·프레임 테두리·다른 레이어 숨기기
    const uiElements = [
      ...stage.find('._hover-overlay'),
      ...stage.find('._hover-outline'),
      ...stage.find('._selection-ui'),
      ...stage.find('._group-overlay'),
      ...stage.find('._frame-overlay'),
    ];
    const originalVisibility = uiElements.map((node) => node.visible());
    uiElements.forEach((node) => node.visible(false));
    const frameBackground = mainLayer.findOne('.frame-background') as Konva.Rect | null;
    const originalStroke = frameBackground?.strokeWidth() ?? 1;
    frameBackground?.strokeWidth(0);
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

    let dataUrl: string | null = null;
    try {
      dataUrl = mainLayer.toDataURL({
        mimeType: MIME_TYPES[config.format],
        pixelRatio: config.pixelRatio,
        x: 0,
        y: 0,
        width: frameWidth,
        height: frameHeight,
        ...(config.format !== 'png' && { quality: config.quality }),
      });

      // Safari 메모리 부족 시 빈 문자열 반환 체크
      if (!dataUrl || !dataUrl.startsWith('data:')) {
        console.error('[Download] Frame export returned invalid data:', frame.id);
        dataUrl = null;
      }
      if (config.format === 'jpg' && dataUrl) dataUrl = await applyWhiteBackground(dataUrl, config.quality);
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

  const exportFrames = async (targets: KonvaFrameElement[], config: ExportConfig) => {
    const exported: ExportedFrame[] = [];
    for (const frame of targets) {
      const dataUrl = await exportFrame(frame, config);
      if (!dataUrl) continue;
      exported.push({
        dataUrl,
        fileName: generateFrameFileName(frames.indexOf(frame), frame.part2, frame.name, EXTENSIONS[config.format]),
      });
    }
    return exported;
  };

  const download = async (options: DownloadOptions) => {
    const targets = options.pageIndexes.map((i) => frames[i]).filter(Boolean);
    if (!targets.length) return;
    setIsDownloading(true);

    try {
      const format: CombineFormat = options.format === 'html' ? 'jpg' : options.format;
      const config: ExportConfig = {
        format,
        quality: qualityValue(options.quality),
        pixelRatio: options.width / (targets[0].width || CANVAS_WIDTH),
      };
      const exported = await exportFrames(targets, config);

      if (!exported.length) {
        showToast.error('이미지를 내보낼 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
        return;
      }
      if (format === 'webp' && !exported[0].dataUrl.startsWith('data:image/webp')) {
        showToast.error('이 브라우저는 WEBP 저장을 지원하지 않아요. JPG나 PNG로 받아주세요.');
        return;
      }
      if (exported.length < targets.length) {
        showToast.warn(`${targets.length}개 중 ${exported.length}개만 다운로드됩니다. 일부 이미지를 불러오지 못했습니다.`);
      }

      const baseName = productName ? sanitizeFileName(productName) : `detail-page-${Date.now()}`;

      if (options.format === 'html' || options.bundle === 'zip') {
        const zip = new JSZip();
        const folder = zip.folder(baseName)!;
        const imageFolder = options.format === 'html' ? folder.folder('images')! : folder;
        exported.forEach(({ dataUrl, fileName }) => imageFolder.file(fileName, dataUrl.split(',')[1], { base64: true }));
        if (options.format === 'html') {
          folder.file('index.html', buildDetailHtml(productName || baseName, options.width, exported.map((e) => e.fileName)));
        }
        downloadBlob(await zip.generateAsync({ type: 'blob' }), `${baseName}.zip`);
        return;
      }

      // 한 장 이미지: 클라이언트에서 합성 (Vercel 4.5MB 제한 우회)
      const result = await combineImagesClient({
        images: exported.map((e) => e.dataUrl),
        format,
        quality: config.quality,
      });
      if (result.splitCount > 1) {
        const browserNotes: Record<string, string> = { safari: ' (Safari 브라우저 제한)', firefox: ' (Firefox 브라우저 제한)', chrome: '' };
        const formatNote = format === 'webp' ? ' (WEBP 최대 높이 16,383px)' : '';
        showToast.warn(`이미지 크기가 커서 ${result.splitCount}개로 나누어 다운로드됩니다.${formatNote || (browserNotes[result.splitBrowser] ?? '')}`);
      }
      for (let i = 0; i < result.dataUrls.length; i++) {
        const suffix = result.splitCount > 1 ? `-${i + 1}` : '';
        downloadFile(result.dataUrls[i], `${baseName}${suffix}.${EXTENSIONS[format]}`);
        if (i < result.dataUrls.length - 1) await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error('[Download] 다운로드 실패:', error);
      showToast.error('다운로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsDownloading(false);
    }
  };

  return { download, isDownloading, frames };
};
