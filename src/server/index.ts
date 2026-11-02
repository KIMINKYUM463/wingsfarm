/**
 * Server 모듈 Barrel Export
 *
 * ## 구조
 * - `data/`: 'import server-only' - 서버 컴포넌트 전용 데이터 페칭 (READ)
 *
 * ## 서버 액션
 * 서버 액션은 `@/app/actions`에서 관리됩니다.
 * ```typescript
 * import { generateProject } from '@/app/actions/detail-page';
 * ```
 *
 * ## 사용 예시
 * ```typescript
 * // 데이터 페칭 (서버 컴포넌트만)
 * import { getProjectDetailForPrefetch } from '@/server/data';
 * ```
 */

export * as data from './data';
