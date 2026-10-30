import 'server-only';
import pLimit from 'p-limit';
import type {
  AddFrameRequest,
  AddTemplateFrameRequest,
  ApplyTemplateRequest,
  DuplicateFrameRequest,
  ProjectFrame,
  TemplateCopyStatus,
  UpdateFrameRequest,
} from '@/features/editor/types';
import { pageCopyOf, rewriteFrame } from './copywriter';
import { copyBrief } from './productFacts';
import { asFrame, asNode, cloneWithNewIds, countImageSlots } from './frames/tree';
import { requireGemini } from './gemini';
import { badRequest, notFound, noContent, ok } from './http';
import { buildTemplateFrame, frameAssetUrls, getProject, sortFrames, updateProject, type ProjectRecord } from './projects';
import { getGeminiApiKey } from './settings';
import { newId, nowIso } from './store';
import { getTemplate, pickTemplate } from './templates/repo';
import { autoBackup } from './versions';

/**
 * 프레임 규칙 (레버페이지와 동일)
 * - ghost: 구성(part2)의 마지막 프레임을 지우면 빈 자리(ghost)로 남아 "템플릿 추가" 자리가 된다
 * - 같은 구성에 active 프레임이 생기면 그 구성의 ghost는 사라진다
 */
const findFrame = (frames: ProjectFrame[], frameId: string) => {
  const frame = frames.find((f) => f.id === frameId);
  if (!frame) throw notFound('프레임을 찾을 수 없습니다.');
  return frame;
};

const withoutGhostsOf = (frames: ProjectFrame[], part2: string) =>
  frames.filter((f) => !(f.status === 'ghost' && f.part2 === part2));

const withAssetUrls = async (frame: ProjectFrame) => ({ ...frame, assetUrls: await frameAssetUrls([frame]) });

const copyLimit = pLimit(3);

/**
 * 템플릿 예시 문구 → 이 프로젝트 상품에 맞는 문구
 * 키가 없거나 AI가 실패한 프레임은 템플릿 문구 그대로 둔다 (템플릿 적용 자체는 막지 않는다)
 */
async function writeTemplateCopy(
  project: ProjectRecord,
  frames: ProjectFrame[],
): Promise<{ frames: ProjectFrame[]; copyStatus: TemplateCopyStatus }> {
  if (!frames.length) return { frames, copyStatus: 'written' };
  if (!(await getGeminiApiKey())) return { frames, copyStatus: 'no_key' };

  const gemini = await requireGemini();
  const brief = await copyBrief(project);
  const pageCopy = pageCopyOf(sortFrames(project.frames));
  let failures = 0;
  const written = await Promise.all(
    frames.map((frame) =>
      copyLimit(() =>
        rewriteFrame(gemini, brief, frame, pageCopy).catch((err) => {
          console.error('[lever] template copy failed', frame.id, err);
          failures += 1;
          return frame;
        }),
      ),
    ),
  );
  return { frames: written, copyStatus: failures ? 'failed' : 'written' };
}

const withProductCopy = async (project: ProjectRecord, frame: ProjectFrame) => {
  const { frames, copyStatus } = await writeTemplateCopy(project, [frame]);
  return { frame: frames[0], copyStatus };
};

/** POST /projects/{id}/frames — 빈 프레임/직접 만든 프레임 추가 */
export async function addFrame(projectId: string, body: AddFrameRequest) {
  if (!body?.frame_data || !body.frame_order) throw badRequest('frame_data와 frame_order는 필수입니다.');
  const id = newId();
  const now = nowIso();
  const frame: ProjectFrame = {
    id,
    projectId,
    figmaId: body.figma_id ?? null,
    templateId: '',
    part1: '',
    part2: '',
    hasTemplatePart: false,
    status: 'active',
    frameOrder: body.frame_order,
    frameName: body.frame_name ?? null,
    frameData: { ...body.frame_data, id },
    width: body.width ?? body.frame_data.width ?? null,
    height: body.height ?? body.frame_data.height ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await updateProject(projectId, (p) => ({ ...p, frames: [...p.frames, frame] }));
  return ok(frame, 201);
}

/** POST /projects/{id}/frames/template — 구성(part2)에서 무작위 템플릿으로 프레임 추가 (ghost 우선 활성화) */
export async function addTemplateFrame(projectId: string, body: AddTemplateFrameRequest) {
  if (!body?.part2) throw badRequest('part2는 필수입니다.');
  const project = await getProject(projectId);
  const ghost = project.frames.find((f) => f.status === 'ghost' && f.part2 === body.part2);
  const template = await pickTemplate(body.part2, project.categoryId);
  const { frame, copyStatus } = await withProductCopy(
    project,
    await buildTemplateFrame(projectId, template, ghost?.frameOrder ?? body.frame_order, ghost?.id, project.draftLayout?.palette),
  );
  await updateProject(projectId, (p) => ({
    ...p,
    frames: [...withoutGhostsOf(p.frames, body.part2), frame],
  }));
  return ok({ ...(await withAssetUrls(frame)), copyStatus }, 201);
}

/** POST /projects/{id}/frames/template/{templateId} — 특정 템플릿 적용 (새로 만들기 / 덮어쓰기) */
export async function applyTemplate(projectId: string, templateId: string, body: ApplyTemplateRequest) {
  const template = await getTemplate(templateId);
  const project = await getProject(projectId);
  const palette = project.draftLayout?.palette;

  let built: ProjectFrame;
  if (body?.mode === 'overwrite') {
    if (!body.frame_id) throw badRequest('덮어쓸 frame_id가 필요합니다.');
    const target = findFrame(project.frames, body.frame_id);
    built = await buildTemplateFrame(projectId, template, target.frameOrder, target.id, palette);
    built.createdAt = target.createdAt;
  } else {
    if (!body?.frame_order) throw badRequest('frame_order가 필요합니다.');
    built = await buildTemplateFrame(projectId, template, body.frame_order, undefined, palette);
  }
  const { frame, copyStatus } = await withProductCopy(project, built);

  await updateProject(projectId, (p) => ({
    ...p,
    frames: [...withoutGhostsOf(p.frames, template.part2).filter((f) => f.id !== frame.id), frame],
  }));
  return ok({ ...(await withAssetUrls(frame)), copyStatus }, body?.mode === 'overwrite' ? 200 : 201);
}

/** PATCH /projects/{id}/frames/{frameId} — 부분 수정 (저장·순서·이름·크기) */
export async function updateFrame(projectId: string, frameId: string, body: UpdateFrameRequest) {
  if (body.frame_data) await autoBackup(projectId);
  let updated: ProjectFrame | undefined;
  await updateProject(projectId, (p) => {
    const frame = findFrame(p.frames, frameId);
    updated = {
      ...frame,
      ...(body.frame_data && { frameData: { ...body.frame_data, id: frameId } }),
      ...(body.frame_name !== undefined && { frameName: body.frame_name }),
      ...(body.frame_order && { frameOrder: body.frame_order }),
      ...(body.width && { width: body.width }),
      ...(body.height && { height: body.height }),
      updatedAt: nowIso(),
    };
    return { ...p, frames: p.frames.map((f) => (f.id === frameId ? updated! : f)) };
  });
  return updated!;
}

/** DELETE /projects/{id}/frames/{frameId} — 구성의 마지막 프레임이면 ghost로 전환(200), 아니면 삭제(204) */
export async function deleteFrame(projectId: string, frameId: string) {
  let ghost: ProjectFrame | null = null;
  await updateProject(projectId, (p) => {
    const frame = findFrame(p.frames, frameId);
    const isLastOfPart =
      frame.hasTemplatePart &&
      Boolean(frame.part2) &&
      !p.frames.some((f) => f.id !== frameId && f.status === 'active' && f.part2 === frame.part2);
    if (!isLastOfPart) return { ...p, frames: p.frames.filter((f) => f.id !== frameId) };

    ghost = { ...frame, status: 'ghost', frameData: {}, updatedAt: nowIso() };
    return { ...p, frames: p.frames.map((f) => (f.id === frameId ? ghost! : f)) };
  });
  return ghost ? ok(ghost) : noContent();
}

/** POST /projects/{id}/frames/{frameId}/duplicate */
export async function duplicateFrame(projectId: string, frameId: string, body: DuplicateFrameRequest) {
  if (!body?.frameOrder) throw badRequest('frameOrder는 필수입니다.');
  const source = findFrame((await getProject(projectId)).frames, frameId);
  if (source.status !== 'active') throw badRequest('빈 프레임은 복제할 수 없습니다.');

  const id = newId();
  const now = nowIso();
  const frame: ProjectFrame = {
    ...source,
    id,
    frameOrder: body.frameOrder,
    frameData: asFrame(cloneWithNewIds(asNode(source.frameData), id)),
    createdAt: now,
    updatedAt: now,
  };
  await updateProject(projectId, (p) => ({ ...p, frames: [...p.frames, frame] }));
  return ok(await withAssetUrls(frame), 201);
}

/** POST /projects/{id}/frames/regenerate — 템플릿 프레임을 같은 구성의 다른 템플릿으로 교체 */
export async function regenerateFrames(projectId: string) {
  const project = await getProject(projectId);
  const frames = await Promise.all(
    project.frames.map(async (frame) => {
      if (frame.status !== 'active' || !frame.hasTemplatePart || !frame.part2) return frame;
      const template = await pickTemplate(frame.part2, project.categoryId, [frame.templateId]);
      const next = await buildTemplateFrame(projectId, template, frame.frameOrder, frame.id, project.draftLayout?.palette);
      return { ...next, frameName: frame.frameName, createdAt: frame.createdAt };
    }),
  );
  const { frames: regenerated, copyStatus } = await writeTemplateCopy(
    project,
    frames.filter((f, i) => f !== project.frames[i]),
  );
  await updateProject(projectId, (p) => ({
    ...p,
    frames: p.frames.map((f) => regenerated.find((r) => r.id === f.id) ?? f),
  }));
  return {
    projectId,
    regeneratedFrameCount: regenerated.length,
    frames: sortFrames(regenerated),
    assetUrls: await frameAssetUrls(regenerated),
    copyStatus,
  };
}

const CREDIT_PER_IMAGE = 1;

/** GET /projects/{id}/estimate — 프레임별 AI 이미지 자리 수 */
export async function estimateProject(projectId: string) {
  const items = sortFrames((await getProject(projectId)).frames)
    .filter((f) => f.status === 'active')
    .map((f) => {
      const imageCount = countImageSlots(asNode(f.frameData));
      return {
        frameName: f.frameName ?? f.part2,
        part2: f.part2,
        imageCount,
        creditPerImage: CREDIT_PER_IMAGE,
        totalCredit: imageCount * CREDIT_PER_IMAGE,
      };
    });
  return {
    items,
    totalImageCount: items.reduce((sum, i) => sum + i.imageCount, 0),
    totalCredit: items.reduce((sum, i) => sum + i.totalCredit, 0),
  };
}
