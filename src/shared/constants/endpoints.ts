export const ENDPOINTS = {
  AUTH: {
    SIGNIN: '/auth/callback',
  },
  DETAIL_PAGE: {
    CREATE_WITH_FORM: '/functions/v1/projects/generation',
    GET_PROJECT_GENERATION_JOB: (jobId: string) => `/functions/v1/projects/generation/${jobId}`,
    CONFIRM_PROJECT_GENERATION: (jobId: string) =>
      `/functions/v1/projects/generation/${jobId}/confirm`,
    GENERATE_AI_IMG: (projectId: string) => `/functions/v1/projects/${projectId}/ai/images`,
    GENERATE_AI_IMG_V2: (projectId: string) => `/functions/v1/projects/${projectId}/ai/images2`,
    GET_IMAGE_GENERATION_JOB: (projectId: string, jobId: string) =>
      `/functions/v1/projects/${projectId}/ai/images2/jobs/${jobId}`,
    MARK_AI_IMAGE_READY: (projectId: string, assetId: string) =>
      `/functions/v1/projects/${projectId}/ai/images/${assetId}/ready`,
    GENERATE_AI_TEXT: (projectId: string) => `/functions/v1/projects/${projectId}/ai/texts`,
    GET_START_FORM: '/functions/v1/categories',
    MATCH_CATEGORY: '/functions/v1/categories/match',
    GET: '/detail-page/create',
  },
  EDITOR: {
    GET_TEMPLATE_DATA: '/functions/v1/public/detail-page-test',
    ADD_FRAME: (projectId: string) => `/functions/v1/projects/${projectId}/frames`,
    ADD_TEMPLATE_FRAME: (projectId: string) =>
      `/functions/v1/projects/${projectId}/frames/template`,
    APPLY_TEMPLATE: (projectId: string, templateId: string) =>
      `/functions/v1/projects/${projectId}/frames/template/${templateId}`,
    UPDATE_FRAME: (projectId: string, frameId: string) =>
      `/functions/v1/projects/${projectId}/frames/${frameId}`,
    DUPLICATE_FRAME: (projectId: string, frameId: string) =>
      `/functions/v1/projects/${projectId}/frames/${frameId}/duplicate`,
  },
  UPLOAD: {
    PRESIGNED_URLS: (imageType: 'product' | 'reference') =>
      `/functions/v1/projects/upload/${imageType}/presigned-urls`,
  },
  ASSETS: {
    LIST: '/functions/v1/assets',
    DETAIL: (assetId: string) => `/functions/v1/assets/${assetId}`,
    SIGNED_URLS: '/functions/v1/assets/signed-urls',
    COMPLETE: '/functions/v1/assets/complete',
    BULK_DELETE: '/functions/v1/assets/bulk-delete',
  },
  WAITLIST: {
    REGISTER: '/functions/v1/public/waitlist',
  },
  PUBLIC: {
    IMAGE_GENERATION_STYLES: '/functions/v1/public/image-generation-styles',
  },
  ELEMENTS: {
    LIST: '/functions/v1/elements',
  },
  PROJECTS: {
    CREATE: '/functions/v1/projects',
    LIST: '/functions/v1/projects',
    DETAIL: (projectId: string) => `/functions/v1/projects/${projectId}`,
    THUMBNAIL: (projectId: string) => `/functions/v1/projects/${projectId}/thumbnail`,
    ESTIMATE: (projectId: string) => `/functions/v1/projects/${projectId}/estimate`,
    GENERATE: (projectId: string) => `/functions/v1/projects/${projectId}/generate`,
    GENERATE_KEYWORDS: (projectId: string) =>
      `/functions/v1/projects/${projectId}/generate/keywords`,
    REGENERATE_FRAMES: (projectId: string) =>
      `/functions/v1/projects/${projectId}/frames/regenerate`,
  },
  TEMPLATES: {
    LIST: '/functions/v1/templates',
  },
  POLICIES: {
    GET: (type: 'privacy' | 'refund' | 'terms') => `/functions/v1/public/policies/${type}`,
  },
  PAYMENTS: {
    SUBSCRIPTIONS_ME: '/functions/v1/payments/subscriptions/me',
    SUBSCRIPTIONS_REACTIVATE: '/functions/v1/payments/subscriptions/me/reactivate',
    SUBSCRIPTIONS_PLANS: '/functions/v1/payments/subscriptions/plans',
    SUBSCRIPTIONS_CREATE: '/functions/v1/payments/subscriptions',
    CREDITS_ME: '/functions/v1/payments/credits/me',
    CREDITS_HISTORY: '/functions/v1/payments/credits/me/history',
    CREDITS_PRODUCTS: '/functions/v1/payments/credits/products',
    CREDITS_PURCHASE_PREPARE: '/functions/v1/payments/credits/purchase/prepare',
    CREDITS_PURCHASE_COMPLETE: '/functions/v1/payments/credits/purchase/complete',
    BILLING_KEYS: '/functions/v1/payments/billing-keys',
    BILLING_KEY_DELETE: (billingKeyId: string) =>
      `/functions/v1/payments/billing-keys/${billingKeyId}`,
    HISTORY: '/functions/v1/payments/history',
  },
  SETTINGS: {
    API_KEY: '/functions/v1/settings/api-keys',
  },
} as const;
