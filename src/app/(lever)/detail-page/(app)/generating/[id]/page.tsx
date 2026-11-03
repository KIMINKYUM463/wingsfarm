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
 * 2. `/projects/generating/[jobId]`로 이동
 * 3. GeneratingContent가 Job 상태 추적 → AI 끝나면 초안 프로젝트에 덮어쓰기 → 에디터로 이동
 */
interface GeneratingPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; create?: string }>;
}

export default async function GeneratingPage({ params, searchParams }: GeneratingPageProps) {
  const { id: jobId } = await params;
  const { source: sourceProjectId, create } = await searchParams;
  const isCreateMode = create === 'true';

  return (
    <>
      <EditorHeader />
      <GeneratingContent jobId={jobId} sourceProjectId={sourceProjectId} isCreateMode={isCreateMode} />
    </>
  );
}
