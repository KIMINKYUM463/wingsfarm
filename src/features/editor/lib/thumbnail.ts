/**
 * 프로젝트 썸네일 캡처 및 업로드 유틸리티
 */
import Konva from 'konva';
import type { QueryClient } from '@tanstack/react-query';
import { useStageRefStore } from '@/features/editor/store/useStageRefStore';
import { getFirstActiveFrame } from '@/features/editor/hooks/frame/utils';
import { uploadProjectThumbnail } from '@/features/projects/api';
import { dataURLtoFile } from '@/shared/lib/file';
import { withHiddenUI } from '@/features/editor/lib/stage-capture';
import { queryKeys } from '@/shared/constants/queryKeys';

/** 썸네일 캡처 설정 */
interface ThumbnailCaptureConfig {
  x?: number;
  y?: number;
  width: number;
  height: number;
  pixelRatio: number;
  mimeType: string;
  quality: number;
}

/**
 * 첫 번째 프레임 캡처 후 썸네일 업로드
 *
 * @param projectId - 프로젝트 ID
 * @throws 캡처할 Stage가 없거나 업로드 실패 시
 */
export const captureAndUploadThumbnail = async (projectId: string): Promise<void> => {
  const firstActiveFrame = getFirstActiveFrame();
  if (!firstActiveFrame) return;

  // 첫 번째 active 프레임의 Stage를 ID로 정확히 가져오기
  const stage = useStageRefStore.getState().getStage(firstActiveFrame.id);

  if (!stage) return;

  // 기본 캡처 설정 (프레임 크기 사용)
  const captureConfig: ThumbnailCaptureConfig = {
    width: firstActiveFrame.width || 860,
    height: firstActiveFrame.height || 1080,
    pixelRatio: 1,
    mimeType: 'image/webp',
    quality: 0.8,
  };

  // FrameBackground가 있으면 해당 영역으로 캡처
  // 메인 Layer (scale 적용된)를 찾기 위해 모든 Layer 검색
  const layers = stage.find('Layer') as Konva.Layer[];
  let frameBackground: Konva.Node | null = null;
  let targetLayer: Konva.Layer | null = null;

  for (const layer of layers) {
    const bg = layer.findOne('.frame-background') || layer.findOne('Rect[name="frame-background"]');
    if (bg) {
      frameBackground = bg;
      targetLayer = layer;
      break;
    }
  }

  if (frameBackground && targetLayer) {
    // Layer의 scale을 포함한 절대 위치 계산
    const pos = frameBackground.getAbsolutePosition();
    const layerScaleX = targetLayer.scaleX();
    const layerScaleY = targetLayer.scaleY();

    captureConfig.x = pos.x;
    captureConfig.y = pos.y;
    // Layer scale을 포함하여 실제 렌더링된 크기로 캡처
    captureConfig.width = frameBackground.width() * frameBackground.scaleX() * layerScaleX;
    captureConfig.height = frameBackground.height() * frameBackground.scaleY() * layerScaleY;
  }

  // UI 요소 숨기고 캡처 (캡처만, 업로드는 밖에서)
  let dataURL: string;
  try {
    dataURL = await withHiddenUI(stage, async () => {
      return stage.toDataURL(captureConfig);
    });
  } catch (error) {
    // Tainted canvas 에러 등 캡처 실패 시 조용히 종료
    console.warn('[Thumbnail] 캡처 실패 (CORS 또는 캔버스 상태 문제):', error);
    return;
  }

  // dataURL 유효성 검사 (빈 캡처 방지)
  if (!dataURL || !dataURL.startsWith('data:image')) {
    console.warn('[Thumbnail] 캡처 실패: 유효하지 않은 dataURL');
    return;
  }

  // 파일 변환 및 업로드 (UI 복원 후 진행)
  const file = dataURLtoFile(dataURL, `thumbnail_${projectId}.webp`);

  // 파일 크기 검사 (빈 파일 방지)
  if (file.size === 0) {
    console.warn('[Thumbnail] 캡처 실패: 빈 파일');
    return;
  }

  await uploadProjectThumbnail(projectId, file);
};

/** 마지막 썸네일 업로드 타이머 (전역 debounce용) */
let thumbnailUploadTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 썸네일 업로드 + 프로젝트 목록 캐시 무효화 (fire-and-forget)
 *
 * - 중복 코드 방지용 wrapper 함수
 * - 300ms debounce로 연속 호출 방지
 * - 실패해도 무시하고 로그만 남김
 *
 * @param projectId - 프로젝트 ID
 * @param queryClient - React Query 클라이언트
 * @param logPrefix - 로그 prefix (디버깅용)
 */
export const uploadThumbnailAndInvalidate = (
  projectId: string,
  queryClient: QueryClient,
  logPrefix: string = 'Thumbnail',
): void => {
  // 기존 타이머 취소 (debounce)
  if (thumbnailUploadTimer) {
    clearTimeout(thumbnailUploadTimer);
  }

  thumbnailUploadTimer = setTimeout(() => {
    thumbnailUploadTimer = null;
    void captureAndUploadThumbnail(projectId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.PROJECTS.lists() });
      })
      .catch((error) => {
        console.warn(`[${logPrefix}] 썸네일 업로드 실패 (무시됨):`, error);
      });
  }, 300);
};
