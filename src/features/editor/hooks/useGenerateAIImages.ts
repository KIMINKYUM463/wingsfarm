import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import pLimit from 'p-limit';
import { uploadThumbnailAndInvalidate } from '@/features/editor/lib/thumbnail';
import { generateAIImage } from '@/features/detail-page/api';
import type { GenerateAIImageRequest } from '@/features/detail-page/types';
import type { KonvaElement } from '@/shared/types/konva';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useImageGenerationStore } from '@/features/editor/store/useImageGenerationStore';
import { CustomError } from '@/shared/lib/CustomError';
import { showToast, toast } from '@/utils/toast';
import { mutationKeys } from '@/shared/constants/mutationKeys';

/**
 * AI 이미지 생성 훅 (큐 시스템 + 재시도 + Store 중심 자동 저장)
 *
 * ## 특징
 * - p-limit 큐 시스템으로 동시 실행 수 제한 (서버 부하 방지 + 안정성 향상)
 * - **Store 중심 관리**: useCanvasDataStore가 single source of truth
 * - **자동 저장**: Store 업데이트 → useAutoSave가 자동 감지 → 디바운스 저장
 * - 각 이미지가 완료되는 즉시 화면에 반영 (UX 개선)
 * - 실패 시 최대 5번까지 자동 재시도
 * - 재시도 간격: 1초 → 2초 → 4초 → 8초 (exponential backoff with jitter)
 * - 일부 이미지 생성 실패해도 성공한 이미지는 즉시 표시 + 저장
 *
 * ## 썸네일 전략
 * 1. AI 생성 시작 시: 즉시 썸네일 캡처 (로딩 상태라도 템플릿 구조 보존)
 * 2. 모든 이미지 완료 시: 최종 썸네일 캡처 (완성된 이미지 반영)
 *
 * ## 사용 예시
 * ```tsx
 * const { mutateAsync, isPending } = useGenerateAIImages();
 *
 * // name="_image"인 요소들 필터링
 * const imageElements = Array.from(flatElements.values())
 *   .filter(el => el.name === '_image');
 *
 * // 큐로 제어된 병렬 이미지 생성 + 자동 저장
 * await mutateAsync(imageElements);
 * ```
 */

// 동시 실행 수 제한 (서버 부하 방지 + Rate Limit 회피)
const CONCURRENT_LIMIT = 5;
const MAX_RETRIES = 5;

/** 4xx 클라이언트 에러 체크 */
const isClientError = (status: number) => status >= 400 && status < 500;

/** 재시도 가능한 에러인지 확인 (4xx만 재시도 안함) */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof CustomError)) return true;
  return !isClientError(error.status);
}

/**
 * 재시도 지연 시간 계산 (Exponential backoff with jitter)
 */
function getRetryDelay(attemptIndex: number): number {
  const baseDelay = 1000; // 1초
  const exponentialDelay = baseDelay * Math.pow(2, attemptIndex);
  // jitter 추가 (0.5 ~ 1.5배 사이의 랜덤값) - 여러 요청이 동시에 재시도되는 것 방지
  const jitter = 0.5 + Math.random();
  return Math.min(exponentialDelay * jitter, 10000); // 최대 10초
}

/**
 * 단일 이미지 생성 with 재시도 + Store 중심 저장 로직
 *
 * @param projectId - 프로젝트 ID
 * @param request - 이미지 생성 요청 데이터
 * @param setImageLoading - 로딩 상태 설정 함수
 * @param onProgress - 진행 상황 업데이트 콜백
 */
async function generateImageWithRetry(
  projectId: string,
  request: GenerateAIImageRequest,
  setImageLoading: (id: string, loading: boolean) => void,
  onProgress?: () => void,
): Promise<{ success: boolean; imageId: string; assetId?: string; imageUrl?: string }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await generateAIImage(projectId, request);

      // 1. assetUrls 스토어에 저장 (assetId → imageUrl)
      useCanvasDataStore.getState().setAssetUrl(result.assetId, result.imageUrl);
      // 2. element에 assetId 설정 (렌더링 조회용)
      useCanvasDataStore.getState().updateElement(result.imageId, { assetId: result.assetId });
      setImageLoading(result.imageId, false);

      onProgress?.();
      return { success: true, imageId: result.imageId, assetId: result.assetId, imageUrl: result.imageUrl };
    } catch (error) {
      // 재시도 불가능한 에러면 즉시 종료 (예: 400 Bad Request)
      if (!isRetryableError(error)) {
        break;
      }

      // 마지막 시도가 아니면 재시도 대기
      if (attempt < MAX_RETRIES) {
        const delay = getRetryDelay(attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // 모든 재시도 실패
  setImageLoading(request.imageId, false);
  onProgress?.();
  return { success: false, imageId: request.imageId };
}

export const useGenerateAIImages = () => {
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const setImageLoading = useImageGenerationStore((state) => state.setImageLoading);

  return useMutation({
    mutationKey: mutationKeys.FRAME.aiImages,
    mutationFn: async (imageElements: KonvaElement[]) => {
      if (!projectId) {
        throw new CustomError(400, 'Project ID is not available');
      }

      // AI 생성 시작 시 썸네일 즉시 캡처 (로딩 상태라도 템플릿 구조 보존)
      uploadThumbnailAndInvalidate(projectId, queryClient, 'AIImageStart');

      // 모든 이미지 로딩 시작
      imageElements.forEach((imageEl) => {
        setImageLoading(imageEl.id, true);
      });

      // 각 이미지 요소별로 요청 데이터 생성 (rootId로 Store에서 프레임 찾기)
      const requests: GenerateAIImageRequest[] = imageElements
        .map((imageEl, variantIndex) => {
          // Store에서 getFrameById로 프레임 찾기 (이미지 요소는 항상 rootId 존재)
          // NOTE: mutation 실행 시점의 최신 store 상태를 읽기 위해 getState() 직접 호출
          const rootId = (imageEl as { rootId: string }).rootId;
          const frame = useCanvasDataStore.getState().getFrameById(rootId);
          if (!frame) {
            setImageLoading(imageEl.id, false);
            return null;
          }

          return {
            imageId: imageEl.id,
            frameData: frame,
            autoReady: true,
            variantIndex,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // 생성 가능한 이미지가 없는 경우 early return
      if (!requests.length) {
        showToast.warn('생성할 수 있는 이미지가 없어요.');
        return { successCount: 0, failCount: 0, results: [], loadingToastId: '' };
      }

      const totalCount = requests.length;
      let completedCount = 0;

      // 로딩 토스트 표시
      const loadingToastId = showToast.info(`AI 이미지 생성 중 (0/${totalCount}) - 새로고침 금지!`);

      // 진행 상황 업데이트 함수 (race condition 방지)
      const updateProgress = () => {
        completedCount += 1;
        showToast.updateInfo(
          loadingToastId,
          `AI 이미지 생성 중 (${completedCount}/${totalCount}) - 새로고침 금지!`,
        );
      };

      // p-limit 큐 시스템 초기화 (동시에 CONCURRENT_LIMIT개만 실행)
      const limit = pLimit(CONCURRENT_LIMIT);

      // 큐로 제어된 병렬 실행 (Store 중심 관리)
      const results = await Promise.all(
        requests.map((request) =>
          limit(() => generateImageWithRetry(projectId, request, setImageLoading, updateProgress)),
        ),
      );

      // 통계
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      return { successCount, failCount, results, loadingToastId };
    },
    onSuccess: (result) => {
      // 로딩 토스트 제거
      if (result.loadingToastId) {
        toast.dismiss(result.loadingToastId);
      }

      const { successCount, failCount } = result;

      // 모든 이미지 완료 후 썸네일 업로드 (성공한 이미지가 있을 때만)
      if (successCount > 0 && projectId) {
        uploadThumbnailAndInvalidate(projectId, queryClient, 'AIImageGeneration');
      }

      // 결과 토스트 표시
      if (failCount === 0) {
        showToast.success('모든 이미지가 완성됐어요.');
        return;
      }

      if (successCount > 0) {
        showToast.warn('교체할 이미지를 먼저 선택한 후 다시 시도해주세요.');
        return;
      }

      showToast.error('이미지 생성에 실패했어요. 다시 시도해주세요.');
    },
    onError: (_error, imageElements) => {
      // 예상치 못한 에러 (네트워크 등) 발생 시 모든 이미지 로딩 종료
      imageElements.forEach((imageEl) => {
        setImageLoading(imageEl.id, false);
      });
    },
  });
};
