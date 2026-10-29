import { ProjectsPage } from '@/features/projects';
import { requireAuth } from '@/server/data/auth';

/**
 * 프로젝트 목록 페이지
 *
 * [LCP 최적화] layout.tsx에서 이미 requireAuth()로 인증 검사
 * - requireAuth()는 내부적으로 fetchUser() cache()를 공유하여 추가 API 호출 없음
 */
export default async function Page() {
  // 캐시된 사용자 정보 조회 (layout과 동일한 cache 공유)
  const user = await requireAuth();
  const userName = user.user_metadata?.name || user.email?.split('@')[0] || '사용자';

  return <ProjectsPage userName={userName} />;
}
