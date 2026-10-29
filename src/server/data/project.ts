/**
 * 프로젝트 데이터 API 서비스 (서버 전용)
 * SSR에서만 사용
 */

import 'server-only';
import { notFound } from 'next/navigation';
import { ApiError, successEnvelope } from '@/server/lever/http';
import { getProjectDetail } from '@/server/lever/projects';
import type { ProjectDetailResponse } from '@/features/editor/types';

/**
 * 프로젝트 상세 데이터 조회 (서버 전용)
 *
 * - 서버 컴포넌트에서는 HTTP를 거치지 않고 저장소를 바로 읽는다
 * - 조회수를 올리므로 isFirstView(최초 진입 여부)가 여기서 결정된다
 *
 * @param projectId - 프로젝트 ID
 * @returns 프로젝트 상세 데이터 (API와 같은 응답 형식). 없는(삭제·휴지통) 프로젝트면 404 페이지
 */
export async function getProjectDetailForPrefetch(
  projectId: string,
): Promise<ProjectDetailResponse> {
  try {
    return successEnvelope(await getProjectDetail(projectId)) as ProjectDetailResponse;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
