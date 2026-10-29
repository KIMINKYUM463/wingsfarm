/** Asset 상태 */
export type AssetStatus = 'pending' | 'ready' | 'rejected' | 'archived';

/** Asset origin */
export type AssetOrigin = 'upload' | 'ai_generation';

/** Asset 아이템 */
export interface Asset {
  id: string;
  status: AssetStatus;
  isPrivate: boolean;
  createdAt: string;
  fileName: string;
  /** 출처 */
  origin: AssetOrigin;
  /** AI 생성 이미지 여부 */
  isAiImage: boolean;
  /** 파일 크기 (bytes) */
  fileSizeBytes?: number;
  /** 이미지 너비 (px) */
  width?: number;
  /** 이미지 높이 (px) */
  height?: number;
  /** 원본 이미지 URL */
  signedUrl?: string;
  /** 썸네일 이미지 URL (100x100) */
  thumbnailUrl?: string;
}

/** GET /assets 요청 파라미터 */
export interface GetAssetsParams {
  /** 자산 상태 필터 */
  status?: AssetStatus;
  /** 조회 개수 (기본: 50, 최대: 100) */
  limit?: number;
  /** 페이지네이션 커서 (Base64 인코딩) */
  cursor?: string;
  /** 파일명 검색 키워드 (하이브리드: ILIKE + Trigram 병렬 검색) */
  search?: string;
}

/** GET /assets 응답 데이터 (data 내부) */
export interface GetAssetsData {
  assets: Asset[];
  total?: number;
  nextCursor?: string | null;
}

/** GET /assets API 전체 응답 */
export interface AssetsApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: GetAssetsData;
}

/** POST /assets/bulk-delete 요청 */
export interface BulkDeleteAssetsRequest {
  assetIds: string[];
}

/** POST /assets/bulk-delete 응답 데이터 */
export interface BulkDeleteAssetsData {
  deletedCount: number;
}

/** POST /assets/bulk-delete API 전체 응답 */
export interface BulkDeleteAssetsResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: BulkDeleteAssetsData;
}
