/**
 * Detail Page 관련 서버 액션
 *
 * 이미지 업로드 URL 발급과 AI 상세페이지 생성 요청.
 * 서버에서는 HTTP를 거치지 않고 로컬 백엔드(`@/server/lever`)를 바로 호출한다.
 */

'use server';

import { withServerAction } from '../shared/utils/middleware';
import { CustomError } from '@/shared/lib/CustomError';
import { ApiError, successEnvelope } from '@/server/lever/http';
import { markReady, reserveUploads } from '@/server/lever/assets';
import { startGeneration } from '@/server/lever/generation';
import { createPresignedUrls } from '@/server/lever/uploads';
import type { CreateDetailPageRequest, CreateDetailPageResponse } from '@/shared/types/detail-page';
import type {
  ImageType,
  PresignedUrlRequest,
  PresignedUrlResponseData,
  AssetSignedUrlRequest,
  AssetSignedUrlResponseData,
  AssetCompleteRequest,
  AssetCompleteResponseData,
} from '@/features/detail-page/types';

/** 백엔드 오류(ApiError)를 클라이언트가 아는 CustomError로 변환 */
const run = async <T,>(task: () => Promise<T>): Promise<T> => {
  try {
    return await task();
  } catch (error) {
    if (error instanceof ApiError) throw new CustomError(error.status, error.message);
    throw error;
  }
};

/**
 * Presigned URL 요청 서버 액션
 *
 * @param imageType - 이미지 타입 ('product' | 'reference')
 * @param request - 파일 정보 배열
 * @returns 업로드 URL 배열
 */
export const getPresignedUrls = withServerAction(
  async (imageType: ImageType, request: PresignedUrlRequest): Promise<PresignedUrlResponseData> =>
    run(() => createPresignedUrls(imageType, request)),
  { requireAuth: true },
);

/**
 * 프로젝트 AI 생성 요청 서버 액션
 *
 * POST /projects/{projectId}/generate
 * 초안 프로젝트에 AI 생성을 적용합니다. (상품명·카테고리는 초안에서 가져옴)
 *
 * @returns 생성 작업 정보 (jobId, status)
 */
export const generateProject = withServerAction(
  async (projectId: string, data: CreateDetailPageRequest): Promise<CreateDetailPageResponse> =>
    run(async () => {
      const job = await startGeneration(projectId, data);
      return { ...successEnvelope(job), errors: null };
    }),
  { requireAuth: true },
);

/**
 * Asset Signed URL 요청 서버 액션 (에디터 이미지 업로드)
 *
 * @param request - 파일 정보 배열과 프로젝트 ID
 * @returns 업로드 URL 배열 (assetId, signedUrl, path 포함)
 */
export const getAssetSignedUrls = withServerAction(
  async (request: AssetSignedUrlRequest): Promise<AssetSignedUrlResponseData> =>
    run(() => reserveUploads(request.projectId, request.files)),
  { requireAuth: true },
);

/**
 * Asset 업로드 완료 처리 서버 액션 (pending → ready)
 *
 * @param request - 완료할 asset ID 배열
 * @returns assetId → URL 맵
 */
export const completeAssetUpload = withServerAction(
  async (request: AssetCompleteRequest): Promise<AssetCompleteResponseData> =>
    run(async () => ({ signedUrls: await markReady(request.assetIds) })),
  { requireAuth: true },
);
