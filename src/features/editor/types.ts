import type { KonvaFrameElement, FrameStatus } from '@/shared/types/konva';
import type { DraftPalette } from '@/shared/types/draft';
import type { HeroMotionInfo } from '@/shared/types/heroMotion';

export type { FrameStatus };

/**
 * 에디터 관련 API 응답 타입
 */

/**
 * DB의 Frame 테이블 Row 타입
 */
export interface ProjectFrame {
  /** UUID */
  id: string;
  /** 프로젝트 ID */
  projectId: string;
  /** Figma 레이어 ID */
  figmaId: string | null;
  /** 템플릿 ID */
  templateId: string;
  /** 템플릿 파트 1 (예: "설득/전환") */
  part1: string;
  /** 템플릿 파트 2 (예: "문제 제기") */
  part2: string;
  /** 템플릿 파트 여부 */
  hasTemplatePart: boolean;
  /** 프레임 상태 (active: 활성, ghost: 비활성 플레이스홀더) */
  status: FrameStatus;
  /** 프레임 정렬 순서 (lexorank) */
  frameOrder: string;
  /** 프레임 이름 */
  frameName: string | null;
  /** Konva 프레임 데이터 (JSON) - ghost는 빈 객체 */
  frameData: KonvaFrameElement | Record<string, never>;
  /** 프레임 너비 */
  width: number | null;
  /** 프레임 높이 */
  height: number | null;
  /** 생성일 */
  createdAt: string;
  /** 수정일 */
  updatedAt: string;
}

/**
 * 프로젝트 상세 조회 응답의 data 부분
 */
export interface ProjectDetailData {
  /** DB Frame 테이블 배열 (신규, 실제 사용) */
  frames: ProjectFrame[];
  /** 조회수 */
  viewCount: number;
  /** 최초 조회 여부 */
  isFirstView: boolean;
  /** 에셋 ID → URL 매핑 */
  assetUrls: Record<string, string>;
  /** 상품명 */
  productName: string;
  /** 카테고리명 (예: "식품/건강") */
  categoryName: string;
  /** 색상 탭 팔레트 (AI 초안으로 만든 페이지만, 아니면 null) */
  palette: DraftPalette | null;
  /** 생성 당시 팔레트 (색상 탭 "초기화") */
  originalPalette: DraftPalette | null;
  /** 맨 위 움직이는 컷 (없으면 null) */
  heroMotion: HeroMotionInfo | null;
}

export interface ExternalApiResponse<T> {
  isSuccess: boolean;
  code: string;
  message: string;
  errors: string | null;
  requestId: string;
  data: T;
}

/**
 * 완성된 프로젝트 상세 데이터 응답
 * Realtime으로 job 상태가 'completed'가 되면 호출하는 API의 응답 타입
 */
export type ProjectDetailResponse = ExternalApiResponse<ProjectDetailData>;

/**
 * 프레임 추가 요청 타입 (POST)
 */
export interface AddFrameRequest {
  /** Konva 프레임 데이터 (JSON) - 필수 */
  frame_data: KonvaFrameElement;
  /** 프레임 정렬 순서 (Fractional Index) - 필수 */
  frame_order: string;
  /** 프레임 이름 */
  frame_name?: string;
  /** Figma 프레임 ID */
  figma_id?: string;
  /** 썸네일 이미지 URL */
  thumbnail_url?: string;
  /** 프레임 너비 */
  width?: number;
  /** 프레임 높이 */
  height?: number;
}

/**
 * 프레임 추가 응답 타입
 */
export type AddFrameResponse = ExternalApiResponse<ProjectFrame>;

/**
 * 프레임 복제 요청 타입 (POST)
 */
export interface DuplicateFrameRequest {
  /** 복제된 프레임의 정렬 순서 (Fractional Index) - 필수 */
  frameOrder: string;
}

/**
 * 프레임 복제 응답 데이터
 */
export interface DuplicateFrameData extends ProjectFrame {
  /** 프레임 내 에셋 ID → URL 매핑 */
  assetUrls: Record<string, string>;
}

/**
 * 프레임 복제 응답 타입
 */
export type DuplicateFrameResponse = ExternalApiResponse<DuplicateFrameData>;

/**
 * 템플릿 기반 프레임 추가 요청 타입 (POST)
 *
 * Ghost 프레임 활성화 또는 새 템플릿 프레임 생성:
 * - Ghost 존재 시: ghost → active 전환 (기존 frameOrder 유지, frame_order 무시)
 * - Ghost 미존재 시: 새 프레임 생성 (frame_order 사용)
 */
export interface AddTemplateFrameRequest {
  /** 템플릿 파트 2 (예: "2-3 핵심 포인트") - 필수 */
  part2: string;
  /** 프레임 정렬 순서 (Fractional Index) - ghost 없을 때만 사용 */
  frame_order: string;
}

/**
 * 템플릿 문구를 상품에 맞게 썼는지
 * - written: AI가 상품 정보로 다시 씀
 * - no_key: Gemini 키가 없어 템플릿 예시 문구 그대로
 * - failed: AI 실패로 (일부) 템플릿 예시 문구 그대로
 */
export type TemplateCopyStatus = 'written' | 'no_key' | 'failed';

/**
 * 템플릿 기반 프레임 추가 응답 데이터
 */
export interface AddTemplateFrameData extends ProjectFrame {
  /** 템플릿 내 에셋 ID → URL 매핑 */
  assetUrls: Record<string, string>;
  copyStatus?: TemplateCopyStatus;
}

/**
 * 템플릿 기반 프레임 추가 응답 타입
 */
export type AddTemplateFrameResponse = ExternalApiResponse<AddTemplateFrameData>;

/**
 * 특정 템플릿 적용 모드
 */
export type ApplyTemplateMode = 'create' | 'overwrite';

/**
 * 특정 템플릿 적용 요청 타입 (POST)
 *
 * 선택한 템플릿을 프로젝트에 적용:
 * - create 모드: 새 프레임 생성 (frame_order 필수)
 * - overwrite 모드: 기존 프레임 덮어쓰기 (frame_id 필수)
 */
export interface ApplyTemplateRequest {
  /** 적용 모드: 새 프레임 생성 또는 기존 프레임 덮어쓰기 */
  mode: ApplyTemplateMode;
  /** 프레임 정렬 순서 (create 모드에서 필수) */
  frame_order?: string;
  /** 덮어쓸 프레임 ID (overwrite 모드에서 필수) */
  frame_id?: string;
}

/**
 * 특정 템플릿 적용 응답 데이터
 */
export interface ApplyTemplateData extends ProjectFrame {
  /** 템플릿 내 에셋 ID → URL 매핑 */
  assetUrls: Record<string, string>;
  copyStatus?: TemplateCopyStatus;
}

/**
 * 특정 템플릿 적용 응답 타입
 */
export type ApplyTemplateResponse = ExternalApiResponse<ApplyTemplateData>;

/**
 * 프레임 재생성 응답 데이터
 */
export interface RegenerateFramesData {
  /** 프로젝트 ID */
  projectId: string;
  /** 재생성된 프레임 개수 */
  regeneratedFrameCount: number;
  /** 재생성된 프레임 배열 */
  frames: ProjectFrame[];
  /** 템플릿 내 에셋 ID → URL 매핑 */
  assetUrls: Record<string, string>;
  copyStatus?: TemplateCopyStatus;
}

/**
 * 프레임 재생성 응답 타입
 */
export type RegenerateFramesResponse = ExternalApiResponse<RegenerateFramesData>;

/**
 * 프레임 업데이트 요청 타입 (PATCH - 부분 업데이트)
 */
export interface UpdateFrameRequest {
  /** Konva 프레임 데이터 (JSON) */
  frame_data?: KonvaFrameElement;
  /** 썸네일 URL */
  thumbnail_url?: string;
  /** 프레임 이름 */
  frame_name?: string;
  /** 프레임 순서 (Fractional Index) */
  frame_order?: string;
  /** 프레임 너비 */
  width?: number;
  /** 프레임 높이 */
  height?: number;
}

/**
 * 프레임 업데이트 응답 타입
 */
export type UpdateFrameResponse = ExternalApiResponse<ProjectFrame>;

/**
 * 프레임 삭제 응답 타입
 * - 204: null (일반 삭제)
 * - 200: ghost 프레임 반환 (해당 part2의 마지막 프레임)
 */
export type DeleteFrameResponse = ExternalApiResponse<ProjectFrame> | null;

// ===== 프로젝트 견적 API =====

/**
 * 프레임별 견적 항목
 */
export interface ProjectEstimateItem {
  /** 프레임 이름 (예: "설득/전환 - 문제 제기") */
  frameName: string;
  /** 템플릿 파트 2 (예: "문제 제기") */
  part2: string;
  /** 이미지 개수 */
  imageCount: number;
}

/**
 * 프로젝트 견적 조회 응답 데이터
 */
export interface ProjectEstimateData {
  /** 프레임별 견적 항목 배열 */
  items: ProjectEstimateItem[];
  /** 전체 이미지 개수 합계 */
  totalImageCount: number;
}

/**
 * 프로젝트 견적 조회 응답
 */
export type ProjectEstimateResponse = ExternalApiResponse<ProjectEstimateData>;

// ===== 이미지 생성 스타일 API =====

/**
 * 이미지 생성 스타일 (최하위)
 */
export interface ImageGenerationStyle {
  /** 스타일 ID */
  id: string;
  /** 스타일명 (예: "배경지(누끼용)", "단색 배경") */
  name: string;
  /** 썸네일 URL */
  thumbnailUrl: string;
  /** 샘플 이미지 URL 배열 */
  sampleImageUrls: string[];
  /** 프롬프트 예시 배열 */
  promptExamples: string[];
  /** 가격 (크레딧) */
  price: number;
  /** 정렬 순서 */
  displayOrder: number;
}

/**
 * 이미지 생성 중분류
 */
export interface ImageGenerationMiddle {
  /** 중분류 ID */
  id: string;
  /** 중분류명 (예: "스튜디오", "오브제/전시대") */
  name: string;
  /** 정렬 순서 */
  displayOrder: number;
  /** 하위 스타일 목록 */
  styles: ImageGenerationStyle[];
}

/**
 * 이미지 생성 대분류
 */
export interface ImageGenerationMajor {
  /** 대분류 ID */
  id: string;
  /** 대분류명 (예: "[기본] 스튜디오 & 연출") */
  name: string;
  /** 설명 */
  description: string;
  /** 썸네일 URL */
  thumbnailUrl: string;
  /** 정렬 순서 */
  displayOrder: number;
  /** 하위 중분류 목록 */
  middles: ImageGenerationMiddle[];
}

/**
 * 이미지 생성 스타일 목록 응답 데이터
 */
export interface ImageGenerationStylesData {
  /** 대분류 목록 */
  majors: ImageGenerationMajor[];
}

/**
 * 이미지 생성 스타일 목록 API 응답
 */
export type ImageGenerationStylesResponse = ExternalApiResponse<ImageGenerationStylesData>;

// ===== 템플릿 목록 API =====

/**
 * 템플릿 아이템
 */
export interface TemplateItem {
  /** 템플릿 UUID */
  id: string;
  /** 썸네일 URL */
  thumbnailUrl: string;
  /** 미리보기 URL */
  previewUrl: string;
}

/**
 * 템플릿 그룹 (part2별)
 */
export interface TemplateGroup {
  /** 세부분류 (part2) */
  part2: string;
  /** 해당 part2의 템플릿 목록 */
  templates: TemplateItem[];
}

/**
 * 템플릿 목록 응답 데이터
 */
export interface TemplateListData {
  /** part2별 그룹화된 템플릿 목록 */
  groups: TemplateGroup[];
}

/**
 * 템플릿 목록 조회 파라미터
 */
export interface GetTemplatesParams {
  /** 상품 카테고리 ID (추후 카테고리별 필터링용) */
  categoryId?: string;
  /** 세부분류 필터 (생략 시 전체 조회) */
  part2?: string;
  /** part2별 최대 템플릿 개수 (part2 생략 시에만 적용, 기본값: 2) */
  limitPerPart2?: number;
}

/**
 * 템플릿 목록 API 응답
 */
export type TemplateListResponse = ExternalApiResponse<TemplateListData>;
