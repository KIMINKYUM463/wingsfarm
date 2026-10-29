/**
 * 템플릿 API 서비스 (서버 전용)
 */

import 'server-only';
import { listTemplateGroups } from '@/server/lever/templates/repo';
import type { TemplateListData, GetTemplatesParams } from '@/features/editor/types';

/**
 * 템플릿 목록 조회 (part2별 그룹)
 *
 * @param params - 조회 파라미터
 * @returns 템플릿 목록 (part2별 그룹화)
 */
export async function getTemplates(params?: GetTemplatesParams): Promise<TemplateListData> {
  const query = new URLSearchParams();
  if (params?.categoryId) query.set('categoryId', params.categoryId);
  if (params?.part2) query.set('part2', params.part2);
  if (params?.limitPerPart2 !== undefined) query.set('limitPerPart2', String(params.limitPerPart2));
  return listTemplateGroups(query);
}
