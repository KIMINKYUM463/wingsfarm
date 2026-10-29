import { getProjectDetailForPrefetch } from '@/server/data/project';
import { getImageGenerationStyles, getTemplates, getGraphicElements } from '@/server/data';
import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { queryKeys } from '@/shared/constants/queryKeys';
import { ImageGenerationStylesProvider } from '@/features/editor/context/ImageGenerationStylesContext';
import { TemplatesProvider } from '@/features/editor/context/TemplatesContext';
import { GraphicElementsProvider } from '@/features/editor/context/GraphicElementsContext';
import { EditorPageClient } from '@/features/editor/components/EditorPageClient';

/**
 * 에디터 페이지 (서버 컴포넌트)
 *
 * ## 역할
 * - 이미 완성된 프로젝트 편집
 * - 서버에서 데이터 fetch → 즉시 렌더링
 *
 * ## 흐름
 * 1. URL에서 projectId 추출
 * 3. 서버에서 프로젝트 데이터 fetch (isFirstView 추출)
 * 4. HydrationBoundary로 클라이언트에 캐시 전달
 * 5. isFirstView를 props로 직접 전달 (HydrationBoundary 의존 X)
 *
 * ## Props 전달
 * - `isFirstView`: 서버 최초 조회 여부 → 초기 썸네일 업로드 트리거
 * - `shouldTriggerAiGeneration`: AI 생성 모드 + 최초 조회 → AI 이미지 일괄 생성 트리거
 *
 * @param params - URL 파라미터 (projectId)
 */
interface EditorPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ai?: string; draft?: string }>;
}

export default async function EditorPage({ params, searchParams }: EditorPageProps) {
  // URL 파라미터에서 projectId 추출
  const { id: projectId } = await params;
  const { ai, draft } = await searchParams;

  // AI 생성 모드로 진입했는지 여부
  const isAiGeneration = ai === 'true';

  // 초안 만들기로 진입했는지 여부 (?draft=true)
  const isDraftCreation = draft === 'true';

  // QueryClient 생성 (서버 전용)
  const queryClient = new QueryClient();

  // 프로젝트 데이터, 이미지 생성 스타일, 템플릿, 그래픽 요소 병렬 fetch
  const [projectData, imageGenerationStyles, templates, graphicElements] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: queryKeys.EDITOR.projectDetail(projectId),
      queryFn: () => getProjectDetailForPrefetch(projectId),
    }),
    getImageGenerationStyles().catch(() => null), // 실패 시 null (필수 아님)
    getTemplates().catch(() => null), // 전체 템플릿 ISR 캐싱
    getGraphicElements().catch(() => null), // 그래픽 요소 ISR 캐싱
  ]);

  // 서버 최초 조회 여부 (초안/AI생성 모두 첫 진입 시 썸네일 업로드용)
  const isFirstView = projectData?.data?.isFirstView ?? false;

  // AI 생성 모드(?ai=true) + 서버에서 최초 조회일 때만 AI 이미지 일괄 생성 트리거
  const shouldTriggerAiGeneration = isAiGeneration && isFirstView;
  return (
    <ImageGenerationStylesProvider data={imageGenerationStyles}>
      <TemplatesProvider data={templates}>
        <GraphicElementsProvider data={graphicElements}>
          <HydrationBoundary state={dehydrate(queryClient)}>
            <EditorPageClient
              projectId={projectId}
              productName={projectData.data.productName}
              isFirstView={isFirstView}
              shouldTriggerAiGeneration={shouldTriggerAiGeneration}
              isDraftCreation={isDraftCreation}
            />
          </HydrationBoundary>
        </GraphicElementsProvider>
      </TemplatesProvider>
    </ImageGenerationStylesProvider>
  );
}
