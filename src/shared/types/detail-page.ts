/**
 * 상세페이지 생성 요청 타입
 *
 * Validation 스키마는 @/features/detail-page/schemas/productInfoForm.schema.ts 참고
 */

// Re-export from validation schema
export {
  productInfoFormSchema as createDetailPageSchema,
  type ProductInfoFormData as CreateDetailPageRequest,
} from '@/validation/productInfoForm.schema';

// API 응답 타입
export interface CreateDetailPageResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: {
    id: string; // Job ID (Realtime 구독용)
    status: string; // Job 초기 상태 (예: "pending")
    message: string;
  };
  errors: string[] | null;
  requestId: string;
}

/**
 * Project Generation Job 상태 타입 (V2)
 *
 * ## 상태 흐름
 * draft_based_pending → context_pending → context_processing
 * → ai_pending → ai_processing → ai_completed
 * → saving_pending → saving_processing → completed
 */
export type ProjectGenerationStatus =
  | 'draft_based_pending' // Step 1-2: 초안 frames 재사용 대기
  | 'context_pending' // Step 2: AI 컨텍스트 생성 대기
  | 'context_processing' // Step 2: AI 컨텍스트 생성 중
  | 'context_failed' // Step 2 실패
  | 'ai_pending' // Step 3: AI 텍스트 주입 대기
  | 'ai_processing' // Step 3: AI 텍스트 주입 중
  | 'ai_completed' // Step 3 완료 (사용자 확정 대기)
  | 'ai_failed' // Step 3 실패
  | 'saving_pending' // Step 4: 최종 저장 대기
  | 'saving_processing' // Step 4: 최종 저장 중
  | 'saving_failed' // Step 4 실패
  | 'completed'; // 완료

/**
 * Project Generation Job View Row 타입
 */
export interface ProjectGenerationJobViewRow {
  id: string;
  project_id: string | null;
  user_id: string | null;
  category_id: string | null;
  product_name: string | null;
  status: ProjectGenerationStatus | null;
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
}

/**
 * Project Generation Job 초기 상태 조회 API 응답 타입
 *
 * GET /projects/generation/{requestId}
 */
export interface GetProjectGenerationJobResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: {
    status: ProjectGenerationStatus;
    jobId: string;
    projectId: string | null;
    updatedAt: string;
  };
  errors: string[] | null;
  requestId: string;
}

/**
 * Project Generation Confirm Request 타입
 *
 * POST /projects/generation/{jobId}/confirm
 */
export interface ConfirmProjectGenerationRequest {
  mode: 'create' | 'overwrite';
}

/**
 * Project Generation Confirm Response 타입
 */
export interface ConfirmProjectGenerationResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: {
    message: string;
    status: 'saving_pending';
  };
  errors: string[] | null;
  requestId: string;
}

/**
 * Project Generation Job Realtime Update 응답 타입
 *
 * ## Supabase Realtime Broadcast 전체 응답 구조 (참고용)
 * ```json
 * {
 *   "event": "UPDATE",
 *   "meta": { "id": "..." },
 *   "payload": {
 *     "id": "...",
 *     "old_record": { job_id, project_id, status, updated_at },
 *     "operation": "UPDATE",
 *     "record": { job_id, project_id, status, updated_at },
 *     "schema": "public",
 *     "table": "project_generation_jobs_status_realtime"
 *   },
 *   "type": "broadcast"
 * }
 * ```
 *
 * ## 실제 사용 필드만 타입 정의
 * - `payload.record`: 업데이트된 레코드 (필수)
 * - `payload.old_record`: 이전 레코드 (선택, 디버깅용)
 */
export interface ProjectGenerationJobRealtimeUpdate {
  payload: {
    record: {
      job_id: string;
      project_id: string | null;
      status: ProjectGenerationStatus;
      updated_at: string;
    };
    old_record?: {
      job_id: string;
      project_id: string | null;
      status: ProjectGenerationStatus;
      updated_at: string;
    };
  };
}

/**
 * AI 이미지 생성 V2 Job 상태 타입
 *
 * ## 상태 흐름
 * pending → processing → completed | failed
 */
export type ImageGenerationJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * AI 이미지 생성 V2 Job 조회 API 응답 데이터
 *
 * GET /projects/{projectId}/ai/images2/jobs/{jobId}
 */
export interface GetImageGenerationJobData {
  jobId: string;
  assetId: string;
  status: ImageGenerationJobStatus;
  imageUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * AI 이미지 생성 V2 Job 조회 API 응답
 */
export interface GetImageGenerationJobResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: GetImageGenerationJobData;
  errors: string[] | null;
  requestId: string;
}

/**
 * AI 이미지 생성 V2 Job Realtime Update 응답 타입
 *
 * ## Supabase Realtime Broadcast 구조
 * 채널: `image_generation_jobs_status_realtime:${userId}:${jobId}`
 * 이벤트: UPDATE
 */
export interface ImageGenerationJobRealtimeUpdate {
  payload: {
    record: {
      job_id: string;
      asset_id: string;
      status: ImageGenerationJobStatus;
      image_url: string | null;
      error_message: string | null;
      updated_at: string;
    };
  };
}
