import 'server-only';
import type { DraftPlan } from '@/shared/types/draft';
import { findCategory } from '../catalog/categories';
import { derivePalette, palettePresets, PALETTE_ROLES, TONE_PRESETS } from '../catalog/palette';
import { badRequest } from '../http';
import { listProjectRecords } from '../projects';
import { publicUrl } from '../storage';
import {
  getDraft,
  listDraftRecords,
  newDraftRecord,
  removeDraft,
  sanitizeInput,
  sanitizePlan,
  saveDraft,
  toDraftDto,
  toDraftSummary,
  updateDraft,
} from './repo';

export { startGenerate } from './generate';
export { addSection, autofillDraft, planGuidePrompt, shufflePalettes, startPlan } from './plan';
export { reshuffleCompositions, selectComposition, startCompositions } from './compositions';

const BUSY = ['composing', 'planning', 'generating'];

/** POST /drafts */
export async function createDraft(body: { input?: unknown }) {
  const draft = newDraftRecord(sanitizeInput(body?.input));
  await saveDraft(draft);
  return toDraftDto(draft);
}

/** GET /drafts — 작성 중인 초안 (완성된 초안 제외) */
export async function listDrafts() {
  const drafts = await listDraftRecords();
  return { drafts: drafts.filter((d) => d.status !== 'completed').map(toDraftSummary) };
}

export const getDraftDto = async (id: string) => toDraftDto(await getDraft(id));

/** PATCH /drafts/{id} — 자동 저장 (입력·기획 카드 수정) */
export async function patchDraft(id: string, body: { input?: unknown; plan?: unknown }) {
  const draft = await updateDraft(id, (d) => {
    if (BUSY.includes(d.status)) throw badRequest('작업이 진행 중이라 지금은 수정할 수 없습니다.');
    const input = body.input !== undefined ? sanitizeInput(body.input, d.input) : d.input;
    const categoryChanged = input.categoryId !== d.input.categoryId;
    let plan: DraftPlan | null = d.plan;
    if (categoryChanged) plan = null;
    else if (body.plan !== undefined && d.plan) plan = sanitizePlan(body.plan, input, d.plan);
    return {
      ...d,
      input,
      plan,
      candidates: categoryChanged ? null : d.candidates,
      selectedCandidateId: categoryChanged ? null : d.selectedCandidateId,
      status: plan ? (d.status === 'completed' ? 'completed' : 'ready') : d.candidates?.length && !categoryChanged ? 'choosing' : 'editing',
      revision: d.revision + 1,
    };
  });
  return toDraftDto(draft);
}

export async function deleteDraft(id: string) {
  await getDraft(id);
  await removeDraft(id);
  return { id };
}

/** GET /drafts/reuse-sources?categoryId= — "기존 페이지 활용하기" 후보 (초안으로 만든 완성 페이지) */
export async function listReuseSources(query: URLSearchParams) {
  const categoryId = query.get('categoryId');
  const projects = await listProjectRecords();
  return {
    projects: projects
      .filter((p) => p.draftLayout && (!categoryId || findCategory(p.categoryId)?.id === findCategory(categoryId)?.id))
      .map((p) => ({
        id: p.id,
        title: p.title,
        categoryId: p.categoryId,
        sectionCount: p.draftLayout!.sectionTypeIds.length,
        palette: p.draftLayout!.palette,
        thumbnailUrl: p.thumbnailPath ? publicUrl(p.thumbnailPath) : null,
        updatedAt: p.updatedAt,
      })),
  };
}

/** GET /palettes?categoryId=&productName= — 색 바꾸기 패널 (역할 설명·상품 프리셋·톤) */
export function paletteCatalog(query: URLSearchParams) {
  return {
    roles: PALETTE_ROLES,
    presets: palettePresets(query.get('categoryId') ?? '', query.get('productName') ?? ''),
    tones: TONE_PRESETS.map((t) => ({ id: t.id, name: t.name, palette: derivePalette(t.main) })),
  };
}
