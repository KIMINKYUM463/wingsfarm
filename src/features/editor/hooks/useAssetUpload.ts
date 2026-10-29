import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { getAssetSignedUrls, completeAssetUpload } from '@/app/actions/detail-page';
import { uploadFileToSignedUrl } from '@/shared/lib/upload';
import { queryKeys } from '@/shared/constants/queryKeys';
import type { AssetSignedUrlItem } from '@/features/detail-page/types';

/**
 * 업로드된 Asset 정보
 */
export interface UploadedAssetInfo {
  assetId: string;
  signedUrl: string;
}

interface UseAssetUploadOptions {
  /** 단일 파일만 업로드 (기본: false) */
  single?: boolean;
}

interface UploadOptions {
  /** 업로드 성공 시 콜백 (input reset 후 실행) */
  onSuccess?: (assets: UploadedAssetInfo[]) => void;
  /**
   * true로 설정하면 onSuccess 콜백에서 done() 호출 전까지 isPending이 true로 유지됨
   * 업로드 후 추가 상태 업데이트가 필요한 경우 깜빡임 방지에 유용
   */
  waitForCallback?: boolean;
}

/**
 * Asset 파일을 Supabase Storage에 업로드하는 커스텀 훅
 *
 * ## 흐름
 * 1. Signed URL 요청 (업로드용)
 * 2. 각 파일을 signedUrl로 업로드 (PUT 요청)
 * 3. 업로드 완료 처리 (pending → ready)
 * 4. 접근 가능한 signedUrl 반환
 *
 * ## 사용 예시
 * ```tsx
 * // 다중 파일
 * const { inputRef, openFilePicker, handleFileChange } = useAssetUpload();
 *
 * // 단일 파일
 * const { inputRef, openFilePicker, handleFileChange } = useAssetUpload({ single: true });
 *
 * // 업로드 후 추가 작업 완료까지 로딩 유지 (깜빡임 방지)
 * const { handleFileChange, markComplete } = useAssetUpload({ single: true });
 * handleFileChange(e, {
 *   waitForCallback: true,
 *   onSuccess: (assets) => {
 *     doSomethingWith(assets);
 *     markComplete(); // 이 호출 전까지 isPending === true 유지
 *   },
 * });
 * ```
 */
export const useAssetUpload = (options?: UseAssetUploadOptions) => {
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  // waitForCallback 옵션 사용 시 콜백 완료 대기 상태
  const [isWaitingCallback, setIsWaitingCallback] = useState(false);

  const mutation = useMutation({
    retry: 2,
    retryDelay: 1000,
    mutationFn: async (files: File[]): Promise<UploadedAssetInfo[]> => {
      if (files.length === 0) {
        return [];
      }

      // 1. 파일별 정보 생성
      const fileInfos = await Promise.all(
        files.map(async (file) => {
          const fileKey = crypto.randomUUID();

          // 이미지 크기 가져오기
          const dimensions = await getImageDimensions(file);

          return {
            fileKey,
            fileName: file.name,
            contentType: file.type,
            fileSizeBytes: file.size,
            width: dimensions?.width,
            height: dimensions?.height,
          };
        }),
      );

      // 2. Signed URL 요청 (서버 액션 호출 - 에러 시 throw → 전역 처리)
      const { urls } = await getAssetSignedUrls({
        projectId,
        files: fileInfos.map(
          ({ fileKey, fileName, contentType, fileSizeBytes, width, height }) => ({
            fileKey,
            fileName,
            contentType,
            fileSizeBytes,
            width,
            height,
          }),
        ),
      });

      // 3. 각 파일을 signedUrl로 업로드 (PUT 요청)
      await Promise.all(
        files.map(async (file, index) => {
          const uploadInfo = urls[index];
          await uploadFileToSignedUrl(file, uploadInfo.signedUrl);
        }),
      );

      // assetIds는 urls 순서대로 추출 (파일 순서 보장)
      const assetIds = urls.map((uploadInfo: AssetSignedUrlItem) => uploadInfo.assetId);

      // 4. 업로드 완료 처리 (pending → ready) + signed URL 받기 (에러 시 throw → 전역 처리)
      const { signedUrls } = await completeAssetUpload({ assetIds });

      // 5. signedUrls를 UploadedAssetInfo 배열로 변환
      return assetIds.map((assetId: string) => ({
        assetId,
        signedUrl: signedUrls[assetId],
      }));
    },
  });

  const uploadAssets = useCallback(
    (files: File[], uploadOptions?: UploadOptions) => {
      // waitForCallback 옵션 사용 시 대기 상태 시작
      if (uploadOptions?.waitForCallback) {
        setIsWaitingCallback(true);
      }

      mutation.mutate(files, {
        onSuccess: (assets) => {
          // 1. 캐시 무효화 (새 이미지 표시를 위해 refetch 필요)
          queryClient.invalidateQueries({ queryKey: queryKeys.ASSETS.lists() });
          // 2. input reset
          if (inputRef.current) {
            inputRef.current.value = '';
          }
          // 3. 컴포넌트별 콜백
          uploadOptions?.onSuccess?.(assets);
          // 4. waitForCallback 아닌 경우 즉시 대기 상태 해제
          if (!uploadOptions?.waitForCallback) {
            setIsWaitingCallback(false);
          }
        },
        onError: () => {
          // 에러 시 대기 상태 해제
          setIsWaitingCallback(false);
        },
      });
    },
    [mutation, queryClient],
  );

  /** 파일 선택창 열기 */
  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  /** input onChange 핸들러 */
  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>, uploadOptions?: UploadOptions) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // 연속 업로드 방지
      if (mutation.isPending) return;

      const filesToUpload = options?.single ? [files[0]] : Array.from(files);
      uploadAssets(filesToUpload, uploadOptions);
    },
    [uploadAssets, options?.single, mutation.isPending],
  );

  /** waitForCallback 옵션 사용 시 콜백 처리 완료를 알리는 함수 */
  const markComplete = useCallback(() => {
    setIsWaitingCallback(false);
  }, []);

  // 업로드 중이거나 콜백 완료 대기 중이면 로딩 상태
  const isPending = mutation.isPending || isWaitingCallback;

  return {
    inputRef,
    openFilePicker,
    handleFileChange,
    isPending,
    /** waitForCallback 옵션 사용 시 콜백 처리 완료를 알리는 함수 */
    markComplete,
    /** 현재 업로드 중인 파일 개수 (isPending일 때만 유효한 값 반환) */
    uploadingCount: isPending ? (mutation.variables?.length ?? 0) : 0,
  };
};

/**
 * 이미지 파일의 크기(width, height)를 가져오는 유틸리티
 */
const getImageDimensions = (file: File): Promise<{ width: number; height: number } | null> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(null);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
};
