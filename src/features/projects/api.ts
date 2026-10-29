/**
 * Projects 관련 클라이언트 API 요청 함수
 */

import httpClient from '@/shared/lib/httpClient';
import { ENDPOINTS } from '@/shared/constants/endpoints';
import type {
  Project,
  ProjectsApiResponse,
  ProjectListParams,
  ProjectSearchParams,
  UpdateProjectRequest,
  UpdateProjectResponse,
} from './types';

/**
 * 프로젝트 목록 조회 (단순 버전)
 *
 * @param params - 검색/정렬 파라미터
 * @returns 프로젝트 배열
 * @deprecated getProjectsWithPagination 사용 권장
 */
export const getProjects = async (params?: ProjectSearchParams): Promise<Project[]> => {
  const response = await httpClient.get<ProjectsApiResponse>(ENDPOINTS.PROJECTS.LIST, {
    withAuth: true,
    queryParams: {
      limit: 20,
      status: 'active',
    },
  });

  let projects = response.data.projects;

  // 클라이언트 사이드 검색 필터링 (API가 검색을 지원하지 않는 경우)
  if (params?.query) {
    const query = params.query.toLowerCase();
    projects = projects.filter(
      (project) =>
        project.title.toLowerCase().includes(query) ||
        project.productName.toLowerCase().includes(query),
    );
  }

  return projects;
};

/**
 * 프로젝트 목록 조회 (페이지네이션 지원)
 *
 * @param params - 페이지네이션 및 정렬 파라미터
 * @returns API 응답 전체 (nextCursor 포함)
 */
export const getProjectsWithPagination = async (
  params?: ProjectListParams,
): Promise<ProjectsApiResponse['data']> => {
  const response = await httpClient.get<ProjectsApiResponse>(ENDPOINTS.PROJECTS.LIST, {
    withAuth: true,
    queryParams: {
      limit: params?.limit ?? 20,
      status: params?.status ?? 'active',
      cursor: params?.cursor,
      sortBy: params?.sortBy,
      sortOrder: params?.sortOrder,
      search: params?.search,
    },
  });

  return response.data;
};

/**
 * 특정 프로젝트 조회
 *
 * @param id - 프로젝트 ID
 */
export const getProjectById = async (id: string): Promise<Project | null> => {
  const response = await httpClient.get<{ data: Project }>(ENDPOINTS.PROJECTS.DETAIL(id), {
    withAuth: true,
  });

  return response.data ?? null;
};

/**
 * 프로젝트 삭제
 *
 * @param id - 프로젝트 ID
 */
export const deleteProject = async (id: string): Promise<void> => {
  await httpClient.delete(ENDPOINTS.PROJECTS.DETAIL(id), {
    withAuth: true,
  });
};

/**
 * 프로젝트 썸네일 업로드 응답
 */
interface UploadThumbnailResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: {
    thumbnailUrl: string;
  };
}

/**
 * 프로젝트 썸네일 업로드
 *
 * @param projectId - 프로젝트 ID
 * @param file - 썸네일 이미지 파일 (webp)
 */
export const uploadProjectThumbnail = async (
  projectId: string,
  file: File,
): Promise<UploadThumbnailResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  return httpClient.put<UploadThumbnailResponse>(ENDPOINTS.PROJECTS.THUMBNAIL(projectId), formData, {
    withAuth: true,
  });
};

/**
 * 프로젝트 정보 수정 (부분 업데이트)
 *
 * @param projectId - 프로젝트 ID
 * @param data - 수정할 필드 (title, productName, categoryId, description)
 */
export const updateProject = async (
  projectId: string,
  data: UpdateProjectRequest,
): Promise<UpdateProjectResponse> => {
  return httpClient.patch<UpdateProjectResponse>(ENDPOINTS.PROJECTS.DETAIL(projectId), data, {
    withAuth: true,
  });
};
