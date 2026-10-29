/**
 * Detail Page 관련 타입 정의
 */

import type { KonvaFrameElement } from '@/shared/types/konva';

/**
 * 이미지 타입
 */
export type ImageType = 'product' | 'reference';

/**
 * 파일 정보
 */
export interface FileInfo {
  fileKey: string; // UUID로 생성된 고유 식별자
  fileName: string;
  contentType: string;
}

/**
 * Presigned URL 요청
 */
export interface PresignedUrlRequest {
  files: FileInfo[];
}

/**
 * Presigned URL 응답 아이템
 */
export interface PresignedUrlUploadItem {
  fileKey: string; // 요청 시 보낸 fileKey와 동일
  path: string; // 스토리지 경로
  signedUrl: string; // 업로드용 URL (token 쿼리 파라미터 포함)
  token: string; // 인증 토큰
}

/**
 * Presigned URL 응답 데이터
 */
export interface PresignedUrlResponseData {
  uploadUrls: PresignedUrlUploadItem[];
}

/**
 * AI 이미지 생성 요청 (기본 - 일괄 생성용)
 */
export interface GenerateAIImageRequest {
  imageId: string;
  frameData: KonvaFrameElement;
  autoReady: boolean;
}

/**
 * AI 이미지 생성 응답 (V1 - 동기)
 */
export interface GenerateAIImageResponse {
  imageId: string;
  assetId: string;
  imageUrl: string;
}

// ===== AI 이미지 생성 V2 API (비동기, 스타일 기반) =====

/**
 * AI 이미지 생성 V2 요청
 *
 * POST /projects/{projectId}/ai/images2
 */
export interface GenerateAIImageV2Request {
  /** 연출 스타일 ID (필수) */
  styleId: string;
  /** 추가 프롬프트 (선택) */
  prompt?: string;
  /** 참조 이미지 ID (선택) */
  assetId?: string;
}

/**
 * AI 이미지 생성 V2 응답 데이터
 *
 * 비동기 처리로 즉시 jobId, assetId만 반환
 * 실제 이미지는 Realtime/폴링으로 확인
 */
export interface GenerateAIImageV2ResponseData {
  jobId: string;
  assetId: string;
}

/**
 * AI 이미지 생성 V2 응답
 */
export interface GenerateAIImageV2Response {
  isSuccess: boolean;
  code: string;
  message: string;
  data: GenerateAIImageV2ResponseData;
  errors: string | null;
  requestId: string;
}

/**
 * AI 텍스트 생성 요청
 */
export interface GenerateAITextRequest {
  projectId: string;
  elementId: string;
  frameData: KonvaFrameElement;
}

/**
 * AI 텍스트 생성 응답
 */
export interface GenerateAITextResponse {
  elementId: string;
  text: string; // 서버 응답 필드명: "text"
}

// ===== Asset Signed URLs API =====

/**
 * Asset 파일 정보 (업로드 요청용)
 */
export interface AssetFileInfo {
  fileKey: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  width?: number;
  height?: number;
}

/**
 * Asset Signed URL 요청
 */
export interface AssetSignedUrlRequest {
  files: AssetFileInfo[];
  projectId: string;
}

/**
 * Asset Signed URL 응답 아이템
 */
export interface AssetSignedUrlItem {
  assetId: string;
  fileKey: string;
  signedUrl: string;
  token: string;
  path: string;
}

/**
 * Asset Signed URL 응답 데이터
 */
export interface AssetSignedUrlResponseData {
  urls: AssetSignedUrlItem[];
}

/**
 * Asset 업로드 완료 요청
 */
export interface AssetCompleteRequest {
  assetIds: string[];
}

/**
 * 완료된 Asset 정보 (signed URL 포함)
 */
export interface CompletedAssetInfo {
  assetId: string;
  path: string; // 접근 가능한 signed URL path
}

/**
 * Asset 업로드 완료 응답 데이터
 */
export interface AssetCompleteResponseData {
  signedUrls: Record<string, string>;
}

// ===== Category Match API =====

/**
 * 카테고리 매칭 요청
 */
export interface MatchCategoryRequest {
  keyword: string;
  language?: string;
}

/**
 * 매칭된 카테고리 정보
 */
export interface MatchedCategory {
  id: string;
  name: string;
  matchScore: number;
  imageUrl: string;
}

/**
 * 카테고리 매칭 응답 데이터
 */
export interface MatchCategoryResponseData {
  keyword: string;
  language: string;
  recommended: string;
  categories: MatchedCategory[];
}

/**
 * 카테고리 매칭 응답
 */
export interface MatchCategoryResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  errors: string | null;
  requestId: string;
  data: MatchCategoryResponseData;
}

// ===== Create Project API =====

/**
 * 프로젝트 생성 요청
 */
export interface CreateProjectRequest {
  productName: string;
  categoryId: string;
}

/**
 * 프로젝트 생성 응답 데이터
 */
export interface CreateProjectResponseData {
  id: string;
  status: string;
  message: string;
}

/**
 * 프로젝트 생성 응답
 */
export interface CreateProjectResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: CreateProjectResponseData;
  errors: string | null;
  requestId: string;
}

// ===== Generate Keywords API =====

/**
 * AI 키워드 생성 요청
 *
 * 선택사항 - 바디 없이 호출하면 캐시 사용 (권장)
 */
export interface GenerateKeywordsRequest {
  forceRefresh?: boolean;
}

/**
 * 키워드 그룹
 */
export interface KeywordGroup {
  name: string;
  keywords: string[];
}

/**
 * AI 키워드 생성 응답 데이터
 */
export interface GenerateKeywordsResponseData {
  groups: KeywordGroup[];
}

/**
 * AI 키워드 생성 응답
 */
export interface GenerateKeywordsResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: GenerateKeywordsResponseData;
  errors: string[] | null;
  requestId: string;
}

// ===== Image Generation Styles API (Public, SSG) =====

/**
 * 이미지 생성 스타일
 */
export interface ImageGenerationStyle {
  id: string;
  name: string;
  thumbnailUrl: string;
  sampleImageUrls: string[];
  promptExamples: string[];
  price: number;
  displayOrder: number;
}

/**
 * 이미지 생성 중분류
 */
export interface ImageGenerationMiddle {
  id: string;
  name: string;
  displayOrder: number;
  styles: ImageGenerationStyle[];
}

/**
 * 이미지 생성 대분류
 */
export interface ImageGenerationMajor {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  displayOrder: number;
  middles: ImageGenerationMiddle[];
}

/**
 * 이미지 생성 스타일 응답 데이터
 */
export interface ImageGenerationStylesResponseData {
  majors: ImageGenerationMajor[];
}

/**
 * 이미지 생성 스타일 응답
 */
export interface ImageGenerationStylesResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: ImageGenerationStylesResponseData;
  errors: string | null;
  requestId: string;
}
