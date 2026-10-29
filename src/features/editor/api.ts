import httpClient from '@/shared/lib/httpClient';
import { ENDPOINTS } from '@/shared/constants/endpoints';
import { CustomError } from '@/shared/lib/CustomError';
import type { CreatePageFromFigmaOutput } from '@/shared/types/actions';
import type { KonvaFrameElement } from '@/shared/types/konva';
import type { ChatEditRequest, ChatEditResult } from '@/shared/types/chatEdit';
import type {
  ExternalApiResponse,
  ProjectDetailResponse,
  AddFrameRequest,
  AddFrameResponse,
  AddTemplateFrameRequest,
  AddTemplateFrameResponse,
  ApplyTemplateRequest,
  ApplyTemplateResponse,
  DuplicateFrameRequest,
  DuplicateFrameResponse,
  UpdateFrameRequest,
  UpdateFrameResponse,
  DeleteFrameResponse,
  ProjectEstimateResponse,
  RegenerateFramesResponse,
  ProjectFrame,
  ImageGenerationStylesResponse,
  ImageGenerationStylesData,
  GetTemplatesParams,
  TemplateListResponse,
  TemplateListData,
} from './types';

export const getDetailPage = (): Promise<CreatePageFromFigmaOutput> =>
  httpClient.get(ENDPOINTS.DETAIL_PAGE.GET);

/**
 * 완성된 프로젝트 상세 데이터 조회
 * Realtime으로 job 상태가 'completed'가 되면 호출
 */
export const getProjectDetail = async (projectId: string): Promise<ProjectDetailResponse> => {
  if (!projectId) {
    throw new CustomError(400, 'Project ID is required');
  }

  const response = await httpClient.get<ProjectDetailResponse>(
    ENDPOINTS.PROJECTS.DETAIL(projectId),
    {
      withAuth: true,
    },
  );

  return response;
};

/**
 * 프로젝트에 새로운 프레임 추가
 *
 * @param projectId - 프로젝트 ID
 * @param request - 프레임 추가 요청 데이터
 * @returns 생성된 프레임 데이터
 */
export const addProjectFrame = async (
  projectId: string,
  request: AddFrameRequest,
): Promise<AddFrameResponse> => {
  if (!projectId) {
    throw new CustomError(400, 'Project ID is required');
  }

  const response = await httpClient.post<AddFrameResponse>(
    ENDPOINTS.EDITOR.ADD_FRAME(projectId),
    request,
    {
      withAuth: true,
    },
  );

  return response;
};

/**
 * 프레임 메타데이터 업데이트 요청 옵션
 */
export interface UpdateFrameOptions {
  /** Konva 프레임 데이터 (JSON) */
  frameData?: KonvaFrameElement;
  /** 프레임 이름 */
  frameName?: string;
  /** 프레임 순서 (Fractional Index) */
  frameOrder?: string;
  /** 프레임 너비 */
  width?: number;
  /** 프레임 높이 */
  height?: number;
}

/**
 * 프레임 데이터 업데이트 (범용)
 *
 * 모든 필드가 옵셔널이므로 필요한 것만 업데이트 가능:
 * - 순서 변경: `{ frameOrder: "a0V" }`
 * - 이름 변경: `{ frameName: "새 이름" }`
 * - 전체 저장: `{ frameData: {...} }`
 *
 * @param projectId - 프로젝트 ID
 * @param frameId - 프레임 ID (DB UUID)
 * @param options - 업데이트할 필드들
 * @returns 업데이트된 프레임 데이터
 */
export const updateProjectFrame = async (
  projectId: string,
  frameId: string,
  options: UpdateFrameOptions,
): Promise<UpdateFrameResponse> => {
  if (!projectId || !frameId) {
    throw new CustomError(400, 'Project ID and Frame ID are required');
  }

  const requestData: UpdateFrameRequest = {
    ...(options.frameData && { frame_data: options.frameData }),
    ...(options.frameName && { frame_name: options.frameName }),
    ...(options.frameOrder && { frame_order: options.frameOrder }),
    ...(options.width && { width: options.width }),
    ...(options.height && { height: options.height }),
  };

  const response = await httpClient.patch<UpdateFrameResponse>(
    ENDPOINTS.EDITOR.UPDATE_FRAME(projectId, frameId),
    requestData,
    {
      withAuth: true,
    },
  );

  return response;
};

/**
 * 프레임 삭제
 *
 * @param projectId - 프로젝트 ID
 * @param frameId - 프레임 ID (DB UUID)
 * @returns 204: null (일반 삭제), 200: ghost 프레임 (해당 part2의 마지막 프레임)
 */
export const deleteProjectFrame = async (
  projectId: string,
  frameId: string,
): Promise<ProjectFrame | null> => {
  if (!projectId || !frameId) {
    throw new CustomError(400, 'Project ID and Frame ID are required');
  }

  const response = await httpClient.delete<DeleteFrameResponse>(
    ENDPOINTS.EDITOR.UPDATE_FRAME(projectId, frameId),
    { withAuth: true },
  );

  // 204: null, 200: ProjectFrame
  return response?.data ?? null;
};

/**
 * 프레임 복제
 *
 * 기존 프레임을 복제하여 새로운 프레임을 생성합니다.
 * 복제되는 정보: frame_data, frame_name, template_id, figma_id, width, height
 *
 * @param projectId - 프로젝트 ID
 * @param frameId - 복제할 프레임 ID (DB UUID)
 * @param request - 복제 요청 데이터 (frameOrder 필수)
 * @returns 복제된 프레임 데이터
 */
export const duplicateProjectFrame = async (
  projectId: string,
  frameId: string,
  request: DuplicateFrameRequest,
): Promise<DuplicateFrameResponse> => {
  if (!projectId || !frameId) {
    throw new CustomError(400, 'Project ID and Frame ID are required');
  }

  const response = await httpClient.post<DuplicateFrameResponse>(
    ENDPOINTS.EDITOR.DUPLICATE_FRAME(projectId, frameId),
    request,
    {
      withAuth: true,
    },
  );

  return response;
};

/**
 * 템플릿 기반 프레임 추가 (Ghost 활성화 또는 새 프레임 생성)
 *
 * part2 카테고리를 지정하여 해당 카테고리 내 템플릿 중 무작위로 1개를 선택합니다.
 * - Ghost 프레임 존재 시: ghost → active 전환 (기존 frameOrder 유지)
 * - Ghost 프레임 미존재 시: 새 프레임 생성 (제공된 frame_order 사용)
 *
 * @param projectId - 프로젝트 ID
 * @param request - part2와 frame_order
 * @returns 생성/활성화된 프레임 데이터
 */
export const addTemplateFrame = async (
  projectId: string,
  request: AddTemplateFrameRequest,
): Promise<AddTemplateFrameResponse> => {
  if (!projectId) {
    throw new CustomError(400, 'Project ID is required');
  }

  const response = await httpClient.post<AddTemplateFrameResponse>(
    ENDPOINTS.EDITOR.ADD_TEMPLATE_FRAME(projectId),
    request,
    {
      withAuth: true,
    },
  );

  return response;
};

/**
 * 특정 템플릿을 프레임에 적용
 *
 * 선택한 템플릿을 프로젝트에 적용합니다.
 * - create 모드: 지정된 위치에 새 프레임 생성 (frame_order 필수)
 * - overwrite 모드: 기존 프레임을 템플릿으로 교체 (frame_id 필수)
 *
 * @param projectId - 프로젝트 ID
 * @param templateId - 적용할 템플릿 ID
 * @param request - 적용 모드 및 관련 파라미터
 * @returns 생성/교체된 프레임 데이터
 */
export const applyTemplateToFrame = async (
  projectId: string,
  templateId: string,
  request: ApplyTemplateRequest,
): Promise<ApplyTemplateResponse> => {
  if (!projectId || !templateId) {
    throw new CustomError(400, 'Project ID and Template ID are required');
  }

  const response = await httpClient.post<ApplyTemplateResponse>(
    ENDPOINTS.EDITOR.APPLY_TEMPLATE(projectId, templateId),
    request,
    {
      withAuth: true,
    },
  );

  return response;
};

/**
 * 프로젝트 견적 조회
 *
 * 프로젝트의 프레임별 이미지 개수와 크레딧 견적을 조회합니다.
 *
 * @param projectId - 프로젝트 ID
 * @returns 프레임별 견적 항목, 전체 이미지 개수, 전체 크레딧 합계
 */
export const getProjectEstimate = async (projectId: string): Promise<ProjectEstimateResponse> => {
  if (!projectId) {
    throw new CustomError(400, 'Project ID is required');
  }

  const response = await httpClient.get<ProjectEstimateResponse>(
    ENDPOINTS.PROJECTS.ESTIMATE(projectId),
    {
      withAuth: true,
    },
  );

  return response;
};

/**
 * 프로젝트 프레임 전체 재생성
 *
 * 프로젝트의 모든 프레임을 새로운 템플릿으로 재생성합니다.
 * - 현재 프레임 ID는 유지하고 내용만 업데이트
 * - 각 프레임의 part2 내에서 새로운 템플릿 랜덤 선택
 * - 현재 사용 중인 템플릿은 재선택에서 제외 (중복 방지)
 * - frameOrder, frameName 등 기존 속성은 유지
 *
 * @param projectId - 프로젝트 ID
 * @returns 재생성된 프레임 배열과 재생성 개수
 */
export const regenerateProjectFrames = async (
  projectId: string,
): Promise<RegenerateFramesResponse> => {
  if (!projectId) {
    throw new CustomError(400, 'Project ID is required');
  }

  const response = await httpClient.post<RegenerateFramesResponse>(
    ENDPOINTS.PROJECTS.REGENERATE_FRAMES(projectId),
    {},
    {
      withAuth: true,
    },
  );

  return response;
};

// ===== AI 채팅 수정 =====

export const chatEditProject = async (projectId: string, request: ChatEditRequest) =>
  (await httpClient.post<ExternalApiResponse<ChatEditResult>>(ENDPOINTS.DETAIL_PAGE.AI_CHAT(projectId), request, { withAuth: true })).data;

// ===== 버전 기록 =====

export interface ProjectVersion {
  id: string;
  kind: 'manual' | 'auto';
  label: string;
  createdAt: string;
  frameCount: number;
  totalHeight: number;
}

export const getProjectVersions = async (projectId: string) =>
  (await httpClient.get<ExternalApiResponse<{ versions: ProjectVersion[] }>>(ENDPOINTS.PROJECTS.VERSIONS(projectId), { withAuth: true })).data.versions;

export const createProjectVersion = async (projectId: string, label: string) =>
  (await httpClient.post<ExternalApiResponse<ProjectVersion>>(ENDPOINTS.PROJECTS.VERSIONS(projectId), { label }, { withAuth: true })).data;

export const restoreProjectVersion = async (projectId: string, versionId: string) =>
  httpClient.post<ProjectDetailResponse>(ENDPOINTS.PROJECTS.VERSION_RESTORE(projectId, versionId), {}, { withAuth: true });

export const deleteProjectVersion = (projectId: string, versionId: string) =>
  httpClient.delete(ENDPOINTS.PROJECTS.VERSION(projectId, versionId), { withAuth: true });

/**
 * AI 이미지 생성 스타일 목록 조회 (공개 API)
 *
 * AI 이미지 생성 시 사용할 수 있는 스타일 옵션을 계층 구조로 조회합니다.
 * - 대분류 (majors): [기본], [공간], [스페셜], [테마], [AI 모델 연출] 등
 * - 중분류 (middles): 스튜디오, 오브제/전시대, 실내, 야외 등
 * - 스타일 (styles): 배경지, 단색 배경, 침실, 거실 등
 *
 * @returns 스타일 목록 (계층 구조)
 */
export const getImageGenerationStyles = async (): Promise<ImageGenerationStylesData> => {
  const response = await httpClient.get<ImageGenerationStylesResponse>(
    ENDPOINTS.PUBLIC.IMAGE_GENERATION_STYLES,
  );

  return response.data;
};

/**
 * 템플릿 목록 조회 (ISR 캐싱 적용)
 *
 * 상세페이지 템플릿 목록을 조회합니다. part2(세부분류)별로 그룹화되어 반환됩니다.
 *
 * @param params - 조회 파라미터
 * @param params.categoryId - 상품 카테고리 ID (추후 카테고리별 필터링용)
 * @param params.part2 - 세부분류 필터 (생략 시 전체 조회)
 * @param params.limitPerPart2 - part2별 최대 템플릿 개수 (기본값: 2)
 * @returns 템플릿 목록 (part2별 그룹화)
 */
export const getTemplates = async (params?: GetTemplatesParams): Promise<TemplateListData> => {
  const searchParams = new URLSearchParams();

  if (params?.categoryId) {
    searchParams.set('categoryId', params.categoryId);
  }
  if (params?.part2) {
    searchParams.set('part2', params.part2);
  }
  if (params?.limitPerPart2 !== undefined) {
    searchParams.set('limitPerPart2', String(params.limitPerPart2));
  }

  const queryString = searchParams.toString();
  const url = queryString
    ? `${ENDPOINTS.TEMPLATES.LIST}?${queryString}`
    : ENDPOINTS.TEMPLATES.LIST;

  const response = await httpClient.get<TemplateListResponse>(url);

  return response.data;
};
