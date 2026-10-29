import { useMutation } from '@tanstack/react-query';
import { getPresignedUrls } from '@/app/actions/detail-page';
import { uploadFileToSignedUrl } from '@/shared/lib/upload';
import type { ImageType } from '../types';

/**
 * 업로드된 이미지 정보
 */
export interface UploadedImageInfo {
  fileKey: string; // UUID 식별자
  previewUrl: string; // 로컬 blob URL (화면 표시용)
  uploadedPath: string; // 서버 path (폼 데이터용)
  fileName: string; // 원본 파일명
}

/**
 * 이미지 파일을 Supabase Storage에 업로드하는 커스텀 훅
 *
 * ## 흐름
 * 1. presigned URL 요청하여 signedUrl과 path 받아옴 (fileKey는 UUID로 생성)
 * 2. 각 파일을 signedUrl로 업로드 (PUT 요청)
 * 3. 업로드 완료 후 이미지 정보 객체 배열을 반환
 *
 * ## 에러 처리
 * - 서버 액션 실패 시: CustomError throw → React Query onError → handleAppError
 * - 기타 에러: 토스트 메시지 자동 표시
 */
export const useImageUpload = (imageType: ImageType) => {
  return useMutation({
    retry: 2, // 2회 재시도 (총 3번 시도)
    retryDelay: 1000, // 1초 후 재시도
    mutationFn: async (files: File[]): Promise<UploadedImageInfo[]> => {
      if (files.length === 0) {
        return [];
      }

      // 1. 파일별 정보 생성 (fileKey, previewUrl)
      const fileInfos = files.map((file) => ({
        fileKey: crypto.randomUUID(), // UUID 생성
        fileName: file.name,
        contentType: file.type,
        previewUrl: URL.createObjectURL(file), // 로컬 preview URL 생성
      }));

      // 2. presigned URL 요청 (서버 액션 호출 - 에러 시 throw → 전역 처리)
      const { uploadUrls } = await getPresignedUrls(imageType, {
        files: fileInfos.map(({ fileKey, fileName, contentType }) => ({
          fileKey,
          fileName,
          contentType,
        })),
      });

      // 3. 각 파일을 signedUrl로 업로드 (PUT 요청)
      const uploadPromises = files.map(async (file, index) => {
        const fileInfo = fileInfos[index];
        const uploadInfo = uploadUrls[index];
        const { signedUrl, path } = uploadInfo;

        await uploadFileToSignedUrl(file, signedUrl);

        // 업로드 성공 시 이미지 정보 객체 반환
        return {
          fileKey: fileInfo.fileKey,
          previewUrl: fileInfo.previewUrl,
          uploadedPath: path,
          fileName: fileInfo.fileName,
        } as UploadedImageInfo;
      });

      // 4. 모든 업로드가 완료될 때까지 대기
      try {
        return await Promise.all(uploadPromises);
      } catch (error) {
        // 실패 시 모든 blob URL 정리 (이미 revoke된 것도 안전하게 호출 가능)
        fileInfos.forEach((info) => URL.revokeObjectURL(info.previewUrl));
        throw error;
      }
    },
  });
};
