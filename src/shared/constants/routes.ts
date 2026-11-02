import type { Route } from 'next';

/**
 * 윙스팜AI 안에서는 레버페이지 화면을 /detail-page 아래에 둔다.
 * (원본: /projects, /projects/[id], /settings/api-key ...)
 */
const BASE = '/detail-page';

export const ROUTES = {
  // 공통 — 윙스팜AI 대시보드
  HOME: '/' as Route,
  // 로그인·접근 제한 화면은 없으므로 프로젝트 목록으로 보낸다 (윙스팜AI 비밀번호 잠금이 대신함)
  ACCESS: BASE as Route,
  LOGIN: BASE as Route,

  // 설정
  SETTINGS_API_KEY: `${BASE}/settings/api-key` as Route,

  // 템플릿 관리 (피그마 동기화)
  ADMIN_TEMPLATES: `${BASE}/admin/templates` as Route,

  // 프로젝트
  PROJECTS: BASE as Route,

  PROJECT: (id: string) => `${BASE}/${id}` as Route,
  // 후커블식 생성 흐름: 입력 폼 → 기획 초안(섹션 카드) → 생성
  DRAFT_CREATE: `${BASE}/create` as Route,
  DRAFT_CREATE_FROM: (params: { draft?: string; reuse?: string }) =>
    `${BASE}/create?${new URLSearchParams(params as Record<string, string>).toString()}` as Route,
  DRAFT: (id: string) => `${BASE}/drafts/${id}` as Route,
  PROJECT_GENERATING: (jobId: string, options?: { source?: string; create?: boolean }) => {
    const base = `${BASE}/generating/${jobId}`;
    const params = new URLSearchParams();
    if (options?.source) params.set('source', options.source);
    if (options?.create) params.set('create', 'true');
    const queryString = params.toString();
    return `${base}${queryString ? `?${queryString}` : ''}` as Route;
  },

  // 가이드
  GUIDE_EXTENSION: BASE as Route,

  // 법적
  PRIVACY: BASE as Route,
  TERMS: BASE as Route,
  REFUND: BASE as Route,
};
