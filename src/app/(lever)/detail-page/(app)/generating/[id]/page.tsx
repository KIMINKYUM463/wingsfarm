import { EditorHeader } from '@/shared/ui/Header/EditorHeader';
import { GeneratingContent } from '@/features/editor/components/overlay/GeneratingContent';

/**
 * 프로젝트 생성 중 페이지 (서버 컴포넌트)
 *
 * ## 역할
 * - 프로젝트 생성 진행 상태 표시
 * - 빈 프레임 미리보기 제공
 * - 생성 완료 시 자동으로 에디터로 리다이렉트
 *
 * ## 흐름
 * 1. ProductInfoForm에서 성공 시 jobId 반환
 * 2. `/projects/generating/[jobId]?source=[sourceProjectId]`로 이동
 * 3. GeneratingContent가 Job 상태 실시간 추적
 * 4. Job 완료되면:
 *    - 새 프로젝트 추가: 새 탭에서 열고, 현재 탭은 sourceProjectId로 복귀
 *    - 덮어쓰기: 같은 탭에서 이동
 *
 * @param params - URL 파라미터 (jobId 포함)
 * @param searchParams - 쿼리 파라미터 (source: 기존 프로젝트 ID)
 */
interface GeneratingPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; create?: string }>;
}

export default async function GeneratingPage({ params, searchParams }: GeneratingPageProps) {
  // URL 파라미터에서 jobId 추출
  const { id: jobId } = await params;
  // 쿼리 파라미터에서 sourceProjectId, create 플래그 추출
  const { source: sourceProjectId, create } = await searchParams;
  // create=true 쿼리 파라미터면 create 모드 (다이얼로그 스킵)
  const isCreateMode = create === 'true';

  return (
    <>
      <EditorHeader />
      <GeneratingContent jobId={jobId} sourceProjectId={sourceProjectId} isCreateMode={isCreateMode} />
    </>
  );
}
