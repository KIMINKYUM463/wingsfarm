/**
 * React Query Query Keys
 *
 * 모든 query key를 중앙에서 관리하여 일관성과 타입 안전성을 보장합니다.
 */

export const queryKeys = {
  DETAIL_PAGE: {
    all: ['detailPage'] as const,
    lists: () => [...queryKeys.DETAIL_PAGE.all, 'list'] as const,
    list: (filters: string) => [...queryKeys.DETAIL_PAGE.lists(), { filters }] as const,
    details: () => [...queryKeys.DETAIL_PAGE.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.DETAIL_PAGE.details(), id] as const,
  },
  PROJECT_GENERATION_JOB: {
    all: ['projectGenerationJob'] as const,
    details: () => [...queryKeys.PROJECT_GENERATION_JOB.all, 'detail'] as const,
    detail: (jobId: string) => [...queryKeys.PROJECT_GENERATION_JOB.details(), jobId] as const,
  },
  EDITOR: {
    all: ['editor'] as const,
    projectDetails: () => [...queryKeys.EDITOR.all, 'projectDetail'] as const,
    projectDetail: (projectId: string) =>
      [...queryKeys.EDITOR.projectDetails(), projectId] as const,
  },
  PROJECTS: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.PROJECTS.all, 'list'] as const,
    /** 페이지네이션된 목록 쿼리키 (limit, sortBy, sortOrder, search별로 캐시 분리) */
    list: (params?: { limit?: number; sortBy?: string; sortOrder?: string; search?: string; filter?: string }) =>
      [...queryKeys.PROJECTS.lists(), params] as const,
    details: () => [...queryKeys.PROJECTS.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.PROJECTS.details(), id] as const,
    estimates: () => [...queryKeys.PROJECTS.all, 'estimate'] as const,
    estimate: (projectId: string) => [...queryKeys.PROJECTS.estimates(), projectId] as const,
    keywords: () => [...queryKeys.PROJECTS.all, 'keywords'] as const,
    keyword: (projectId: string) => [...queryKeys.PROJECTS.keywords(), projectId] as const,
  },
  ASSETS: {
    all: ['assets'] as const,
    lists: () => [...queryKeys.ASSETS.all, 'list'] as const,
    /** 페이지네이션된 목록 쿼리키 (status, limit, search별로 캐시 분리) */
    list: (params?: { status?: string; limit?: number; search?: string }) =>
      [...queryKeys.ASSETS.lists(), params] as const,
  },
  IMAGE_GENERATION_STYLES: {
    all: ['imageGenerationStyles'] as const,
    list: () => [...queryKeys.IMAGE_GENERATION_STYLES.all, 'list'] as const,
  },
  CREDITS: {
    all: ['credits'] as const,
    me: () => [...queryKeys.CREDITS.all, 'me'] as const,
  },
  PAYMENTS: {
    all: ['payments'] as const,
    history: () => [...queryKeys.PAYMENTS.all, 'history'] as const,
  },
  SUBSCRIPTION: {
    all: ['subscription'] as const,
    me: () => [...queryKeys.SUBSCRIPTION.all, 'me'] as const,
  },
  SETTINGS: {
    all: ['settings'] as const,
    apiKey: () => [...queryKeys.SETTINGS.all, 'apiKey'] as const,
  },
} as const;
