import 'server-only';
import { contextBrief } from './copywriter';
import { evidenceText, getDraft } from './drafts/repo';
import type { ProductContext, ProjectRecord } from './projects';

/** 사용자가 입력한 상품 사실 (초안에서 만든 페이지면 초안 입력 전체: 후기·연락처·배송·인증 등) */
export async function projectEvidence(project: ProjectRecord) {
  const draft = project.draftLayout && (await getDraft(project.draftLayout.draftId).catch(() => null));
  if (draft) return evidenceText(draft.input, draft.plan?.analysis?.reviewQuotes);
  return [project.productName, project.description, ...(project.context?.sellingPoints ?? [])].filter(Boolean).join('\n');
}

/** 문구를 쓰는 AI에 주는 상품 정보 = 요약 + 입력한 사실 */
export const copyBrief = async (project: ProjectRecord, context: ProductContext | undefined = project.context) =>
  `${contextBrief(project, context)}\n\n[입력한 상품 사실]\n${(await projectEvidence(project)) || '없음'}`;
