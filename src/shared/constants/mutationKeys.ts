/**
 * React Query Mutation Keys
 *
 * 모든 mutation key를 중앙에서 관리하여 일관성과 타입 안전성을 보장합니다.
 *
 * @see https://tanstack.com/query/v5/docs/framework/react/guides/mutations
 */

export const mutationKeys = {
  PROJECT: {
    /** 프로젝트 관련 모든 mutation 필터링용 prefix */
    all: ['project'] as const,
    /** 프로젝트 정보 수정 */
    update: ['project', 'update'] as const,
  },
  FRAME: {
    /** 프레임 관련 모든 mutation 필터링용 prefix */
    all: ['frame'] as const,
    /** 프레임 추가 (ghost 활성화 포함) */
    add: ['frame', 'add'] as const,
    /** 특정 템플릿 적용 (새 프레임 생성 또는 기존 프레임 덮어쓰기) */
    applyTemplate: ['frame', 'apply-template'] as const,
    /** 프레임 삭제 */
    delete: ['frame', 'delete'] as const,
    /** 프레임 복제 */
    duplicate: ['frame', 'duplicate'] as const,
    /** 전체 프레임 재생성 */
    regenerate: ['frame', 'regenerate'] as const,
    /** 개별 AI 텍스트 생성 */
    aiText: ['frame', 'ai-text'] as const,
    /** 개별 AI 이미지 생성 */
    aiImage: ['frame', 'ai-image'] as const,
    /** 대량 AI 이미지 생성 */
    aiImages: ['frame', 'ai-images'] as const,
  },
  SETTINGS: {
    all: ['settings'] as const,
    apiKey: ['settings', 'api-key'] as const,
    deleteApiKey: ['settings', 'delete-api-key'] as const,
    copyModel: ['settings', 'copy-model'] as const,
  },
} as const;

/** Frame mutation key prefix (useAutoSave에서 필터링용) */
export const FRAME_MUTATION_PREFIX = 'frame' as const;
