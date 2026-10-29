import { useQuery } from '@tanstack/react-query';
import { getProjectDetail } from '@/features/editor/api';
import { queryKeys } from '@/shared/constants/queryKeys';

/**
 * 에디터 프로젝트 상세 (서버 prefetch 캐시 사용)
 * - KonvaEditor·색상 탭·AI 채팅·버전 기록이 같은 캐시를 함께 본다
 */
export const useProjectDetail = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.EDITOR.projectDetail(projectId),
    queryFn: () => getProjectDetail(projectId),
    select: (response) => response.data,
    refetchOnMount: false, // 서버 prefetch 데이터 사용
    refetchOnWindowFocus: false, // 탭 전환 시 재요청 불필요
  });
