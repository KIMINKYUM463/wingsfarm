import httpClient from '@/shared/lib/httpClient';
import { CustomError } from '@/shared/lib/CustomError';
import {
  CreateDetailPageRequest,
  CreateDetailPageResponse,
  GetProjectGenerationJobResponse,
  ConfirmProjectGenerationRequest,
  ConfirmProjectGenerationResponse,
  GetImageGenerationJobResponse,
  GetImageGenerationJobData,
} from '@/shared/types/detail-page';
import { ENDPOINTS } from '@/shared/constants/endpoints';
import type {
  ImageType,
  PresignedUrlRequest,
  PresignedUrlResponseData,
  GenerateAIImageRequest,
  GenerateAIImageResponse,
  GenerateAIImageV2Request,
  GenerateAIImageV2Response,
  GenerateAIImageV2ResponseData,
  AssetSignedUrlRequest,
  AssetSignedUrlResponseData,
  MatchCategoryRequest,
  MatchCategoryResponse,
  MatchCategoryResponseData,
  CreateProjectRequest,
  CreateProjectResponse,
  CreateProjectResponseData,
  GenerateKeywordsRequest,
  GenerateKeywordsResponse,
  GenerateKeywordsResponseData,
} from './types';

/**
 * Detail Page 관련 클라이언트 API 요청 함수
 *
 * 이 파일은 상세 페이지 관련 API 함수들을 정의합니다.
 */

/**
 * 상세 페이지 목록 조회
 */
export const getDetailPages = async () => {
  // TODO: 상세 페이지 목록 조회 API 구현
};

/**
 * 특정 상세 페이지 조회
 */
export const getDetailPageById = async (_id: string) => {
  // TODO: 특정 상세 페이지 조회 API 구현
};

/**
 * Project Generation Job 초기 상태 조회 (REST API)
 *
 * GET /projects/generation/{requestId}
 * - 프로젝트 생성 요청의 현재 상태를 조회합니다
 * - 이미 완료된 Job에 접근할 때 초기 상태 로딩용
 * - React Query에서 사용됩니다
 */
export const getProjectGenerationJob = async (
  jobId: string,
): Promise<GetProjectGenerationJobResponse['data']> => {
  if (!jobId) {
    throw new CustomError(400, 'Job ID is required');
  }

  const response = await httpClient.get<GetProjectGenerationJobResponse>(
    ENDPOINTS.DETAIL_PAGE.GET_PROJECT_GENERATION_JOB(jobId),
    { withAuth: true },
  );

  return response.data;
};

/**
 * Project Generation 확정
 *
 * POST /projects/generation/{jobId}/confirm
 *
 * AI가 끝나면 초안 프로젝트(`sourceProjectId`)에 결과를 덮어쓴다.
 * UI에서는 항상 overwrite로 호출한다. (create는 API 호환용으로만 남김)
 *
 * @param jobId - 생성 Job ID
 * @param request - 확정 모드 (create | overwrite)
 */
export const confirmProjectGeneration = async (
  jobId: string,
  request: ConfirmProjectGenerationRequest,
): Promise<ConfirmProjectGenerationResponse['data']> => {
  if (!jobId) {
    throw new CustomError(400, 'Job ID is required');
  }
  if (!request.mode) {
    throw new CustomError(400, 'Confirmation mode is required');
  }
  if (request.mode !== 'create' && request.mode !== 'overwrite') {
    throw new CustomError(400, 'Invalid mode. Must be "create" or "overwrite"');
  }

  const response = await httpClient.post<ConfirmProjectGenerationResponse>(
    ENDPOINTS.DETAIL_PAGE.CONFIRM_PROJECT_GENERATION(jobId),
    request,
    { withAuth: true },
  );

  return response.data;
};

export const createDetailPage = async (
  data: CreateDetailPageRequest,
): Promise<CreateDetailPageResponse> => {
  return httpClient.post<CreateDetailPageResponse>(
    ENDPOINTS.DETAIL_PAGE.CREATE_WITH_FORM,
    data,
    { withAuth: true }, // Supabase 액세스 토큰을 Authorization 헤더에 추가
  );
};

export const updateDetailPage = async (_id: string, _data: any) => {
  // TODO: 상세 페이지 업데이트 API 구현
};

/**
 * 상세 페이지 삭제
 */
export const deleteDetailPage = async (_id: string) => {
  // TODO: 상세 페이지 삭제 API 구현
};

export const getPresignedUrls = async (
  imageType: ImageType,
  request: PresignedUrlRequest,
): Promise<PresignedUrlResponseData> => {
  if (!imageType) {
    throw new CustomError(400, 'Image type is required');
  }
  if (!request || !request.files || request.files.length === 0) {
    throw new CustomError(400, 'Files are required');
  }

  const response = await httpClient.post<{
    isSuccess: boolean;
    code: string;
    message: string;
    data: PresignedUrlResponseData;
  }>(
    ENDPOINTS.UPLOAD.PRESIGNED_URLS(imageType),
    request,
    { withAuth: true }, // Supabase 액세스 토큰을 Authorization 헤더에 추가
  );
  return response.data;
};

/**
 * AI 이미지 생성 V2 (비동기, 스타일 기반)
 *
 * POST /projects/{projectId}/ai/images2
 *
 * - 비동기 처리로 즉시 jobId, assetId만 반환
 * - 실제 이미지는 Realtime/폴링으로 확인
 *
 * @param projectId - 프로젝트 ID
 * @param request - 스타일 ID, 프롬프트(선택), 참조 이미지 ID(선택)
 * @returns jobId와 assetId
 */
export const generateAIImageV2 = async (
  projectId: string,
  request: GenerateAIImageV2Request,
): Promise<GenerateAIImageV2ResponseData> => {
  if (!projectId) {
    throw new CustomError(400, 'Project ID is required');
  }
  if (!request.styleId) {
    throw new CustomError(400, 'Style ID is required');
  }

  const response = await httpClient.post<GenerateAIImageV2Response>(
    ENDPOINTS.DETAIL_PAGE.GENERATE_AI_IMG_V2(projectId),
    request,
    { withAuth: true },
  );

  return response.data;
};

/**
 * AI 이미지 생성 V2 Job 상태 조회 (폴링용)
 *
 * GET /projects/{projectId}/ai/images2/jobs/{jobId}
 *
 * - Realtime 연결 실패 시 폴백으로 사용
 * - 이미 완료된 Job 상태 확인 시 사용
 *
 * @param projectId - 프로젝트 ID
 * @param jobId - 이미지 생성 Job ID
 * @returns Job 상태 정보 (status, imageUrl 등)
 */
export const getImageGenerationJob = async (
  projectId: string,
  jobId: string,
): Promise<GetImageGenerationJobData> => {
  if (!projectId) {
    throw new CustomError(400, 'Project ID is required');
  }
  if (!jobId) {
    throw new CustomError(400, 'Job ID is required');
  }

  const response = await httpClient.get<GetImageGenerationJobResponse>(
    ENDPOINTS.DETAIL_PAGE.GET_IMAGE_GENERATION_JOB(projectId, jobId),
    { withAuth: true },
  );

  return response.data;
};

/**
 * AI 생성 이미지 상태를 READY로 변경
 *
 * POST /projects/{projectId}/ai/images/{assetId}/ready
 *
 * - autoReady: false로 생성된 이미지(AI_GENERATION_COMPLETED 상태)를 READY 상태로 전환
 * - READY 상태가 되면 해당 이미지가 업로드 목록에 표시됨
 * - "이미지 추가" 또는 "이미지 교체" 시 호출
 *
 * @param projectId - 프로젝트 ID
 * @param assetId - AI 생성 시 반환된 이미지 asset ID
 */
export const markAIImageReady = async (projectId: string, assetId: string): Promise<void> => {
  if (!projectId) {
    throw new CustomError(400, 'Project ID is required');
  }
  if (!assetId) {
    throw new CustomError(400, 'Asset ID is required');
  }

  await httpClient.post(ENDPOINTS.DETAIL_PAGE.MARK_AI_IMAGE_READY(projectId, assetId), undefined, {
    withAuth: true,
  });
};

/**
 * AI 이미지 생성 V1 (동기, 일괄 생성용)
 *
 * POST /projects/{projectId}/ai/images
 *
 * - 템플릿의 이미지 자리(`_image`)를 상품 사진 기반 AI 이미지로 채운다 (Gemini)
 *
 * @param projectId - 프로젝트 ID
 * @param request - 이미지 ID, 프레임 데이터, autoReady
 * @returns 생성된 이미지 정보 (imageId, assetId, imageUrl)
 */
export const generateAIImage = async (
  projectId: string,
  request: GenerateAIImageRequest,
): Promise<GenerateAIImageResponse> => {
  if (!projectId || !request.imageId || !request.frameData) {
    throw new CustomError(400, 'Project ID, Image ID, and Frame data are required');
  }

  const response = await httpClient.post<{
    isSuccess: boolean;
    code: string;
    message: string;
    data: GenerateAIImageResponse;
  }>(ENDPOINTS.DETAIL_PAGE.GENERATE_AI_IMG(projectId), request, { withAuth: true });

  return response.data;
};

/**
 * Asset Signed Upload URLs 생성
 *
 * 에디터에서 이미지 업로드 시 사용하는 API
 * 반환된 signedUrl로 직접 파일을 업로드합니다.
 *
 * @param request - 파일 정보 배열과 프로젝트 ID
 * @returns Signed URL 배열 (assetId, signedUrl, path 포함)
 */
export const getAssetSignedUrls = async (
  request: AssetSignedUrlRequest,
): Promise<AssetSignedUrlResponseData> => {
  if (!request.projectId) {
    throw new CustomError(400, 'Project ID is required');
  }
  if (!request.files || request.files.length === 0) {
    throw new CustomError(400, 'Files are required');
  }

  const response = await httpClient.post<{
    isSuccess: boolean;
    code: string;
    message: string;
    errors: string | null;
    requestId: string;
    data: AssetSignedUrlResponseData;
  }>(ENDPOINTS.ASSETS.SIGNED_URLS, request, { withAuth: true });

  return response.data;
};

/**
 * 카테고리 매칭
 * 상품 키워드를 기반으로 적합한 카테고리를 추천받습니다.
 *
 * @param request - 키워드와 언어 정보
 * @returns 추천 카테고리 목록과 매칭 점수
 */
export const matchCategory = async (
  request: MatchCategoryRequest,
): Promise<MatchCategoryResponseData> => {
  if (!request.keyword || !request.keyword.trim()) {
    throw new CustomError(400, 'Keyword is required');
  }

  const response = await httpClient.post<MatchCategoryResponse>(
    ENDPOINTS.DETAIL_PAGE.MATCH_CATEGORY,
    request,
    { withAuth: true },
  );

  return response.data;
};

/**
 * 프로젝트 초안 생성
 * 템플릿 기반으로 빈 프로젝트를 자동 생성합니다.
 *
 * @param request - 상품명과 카테고리 ID
 * @returns 생성된 프로젝트 정보
 */
export const createProject = async (
  request: CreateProjectRequest,
): Promise<CreateProjectResponseData> => {
  if (!request.productName || !request.productName.trim()) {
    throw new CustomError(400, 'Product name is required');
  }
  if (!request.categoryId || !request.categoryId.trim()) {
    throw new CustomError(400, 'Category ID is required');
  }

  const response = await httpClient.post<CreateProjectResponse>(
    ENDPOINTS.PROJECTS.CREATE,
    request,
    { withAuth: true },
  );

  return response.data;
};

/**
 * AI 키워드 생성
 *
 * 프로젝트의 productName과 categoryId를 기반으로 AI가 키워드 그룹을 동적 생성합니다.
 * - 바디 없이 호출: 캐시 우선 (권장)
 * - forceRefresh: true: 캐시 무시하고 새로 생성
 *
 * @param projectId - 프로젝트 ID
 * @param request - 선택사항 (forceRefresh 옵션)
 * @returns 키워드 그룹 배열
 */
export const generateKeywords = async (
  projectId: string,
  request?: GenerateKeywordsRequest,
): Promise<GenerateKeywordsResponseData> => {
  if (!projectId) {
    throw new CustomError(400, 'Project ID is required');
  }

  const response = await httpClient.post<GenerateKeywordsResponse>(
    ENDPOINTS.PROJECTS.GENERATE_KEYWORDS(projectId),
    request ?? {},
    { withAuth: true },
  );

  return response.data;
};
