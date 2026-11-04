import 'server-only';
import type { GenerateAIImageRequest, GenerateAIImageV2Request } from '@/features/detail-page/types';
import type { GetImageGenerationJobData, ImageGenerationJobStatus } from '@/shared/types/detail-page';
import { createAssetFromBuffer, findAssetRecord, markReady, resolveAssetUrls } from './assets';
import { CATEGORIES, categoryImageUrl, findCategory } from './catalog/categories';
import { findImageStyle } from './catalog/styles';
import { sceneIdeas } from '@/shared/lib/draftMedia';
import { asNode, collectEditableTexts, collectPromptGuides, findNode, isImageSlot, walk } from './frames/tree';
import { DETAIL_COPY_RULES } from './copyStyle';
import { PLACEHOLDER_RULES } from './copywriter';
import { copyBrief } from './productFacts';
import { distinctFrom, photoPromptFor, sceneForIndex } from './photoPrompt';
import { closestAspectRatio, loadInlineImage, loadInlineImages, requireGemini, type InlineImage } from './gemini';
import { badRequest, notFound } from './http';
import { getProject, updateProject } from './projects';
import { extFromMime } from './storage';
import { runInBackground } from './background';
import { newId, nowIso, readJson, updateJson, writeJson } from './store';

const saveGeneratedImage = async (
  projectId: string,
  image: { mimeType: string; data: Buffer },
  options: { id?: string; ready: boolean; width?: number; height?: number },
) =>
  createAssetFromBuffer({
    id: options.id,
    projectId,
    data: image.data,
    contentType: image.mimeType,
    fileName: `ai-${Date.now()}.${extFromMime(image.mimeType)}`,
    origin: 'ai_generation',
    ready: options.ready,
    width: options.width,
    height: options.height,
  });

// ===== V1: 템플릿 이미지 자리 채우기 (동기) =====

/** POST /projects/{id}/ai/images */
export async function generateSlotImage(projectId: string, body: GenerateAIImageRequest) {
  if (!body?.imageId || !body.frameData) throw badRequest('imageId와 frameData가 필요합니다.');
  const project = await getProject(projectId);
  const frame = asNode(body.frameData);
  const slot = findNode(frame, body.imageId);
  if (!slot) throw notFound('이미지 요소를 찾을 수 없습니다.');

  const width = Number(slot.width) || 860;
  const height = Number(slot.height) || 860;
  const slots = [...walk(frame)].filter(isImageSlot).map((n) => n.id);
  const slotIndex = slots.findIndex((id) => id === body.imageId);
  const variant = Number.isInteger(body.variantIndex) ? Number(body.variantIndex) : slotIndex;
  const scene = sceneForIndex(project.categoryId, variant);

  const gemini = await requireGemini();
  const references = await loadInlineImages(project.productImagePaths, 3);
  // 섹션 문구·작성 가이드는 넣지 않는다 (글씨를 그려 넣는 원인)
  const prompt = photoPromptFor(
    references.length > 0,
    `Product name (Korean): ${project.productName}`,
    project.context?.summary && `About the product (Korean): ${project.context.summary}`,
    project.context?.keywords?.length && `Keywords (Korean): ${project.context.keywords.join(', ')}`,
    project.context?.sellingPoints?.length && `Selling points (Korean): ${project.context.sellingPoints.join(', ')}`,
    `Scene (Korean): ${scene}`,
    distinctFrom(sceneIdeas(project.categoryId).filter((s) => s !== scene)),
    `Compose for a ${width}x${height} area.`,
  );

  const image = await gemini.generateImage(prompt, references, closestAspectRatio(width, height));
  const asset = await saveGeneratedImage(projectId, image, { ready: body.autoReady, width, height });
  return { imageId: body.imageId, assetId: asset.id, imageUrl: asset.url };
}

/** POST /projects/{id}/ai/images/{assetId}/ready */
export async function markAIImageReady(projectId: string, assetId: string) {
  const record = await findAssetRecord(assetId);
  if (!record || record.projectId !== projectId) throw notFound('이미지를 찾을 수 없습니다.');
  const urls = await markReady([assetId]);
  return { assetId, imageUrl: urls[assetId] };
}

// ===== V2: 연출 스타일 이미지 (비동기 Job) =====

interface ImageJob {
  id: string;
  projectId: string;
  assetId: string;
  status: ImageGenerationJobStatus;
  imageUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

const imageJobPath = (id: string) => `jobs/images/${id}.json`;
const patchImageJob = (id: string, patch: Partial<ImageJob>) =>
  updateJson<ImageJob | null, ImageJob>(imageJobPath(id), null, (job) => ({ ...job!, ...patch, updatedAt: nowIso() }), (job) => job!);

async function runImageJob(job: ImageJob, body: GenerateAIImageV2Request, scene: string, styleName: string) {
  try {
    await patchImageJob(job.id, { status: 'processing', startedAt: nowIso() });
    const project = await getProject(job.projectId);
    let references: InlineImage[];
    if (body.assetId) {
      const urls = await resolveAssetUrls([body.assetId]);
      const reference = urls[body.assetId] ? await loadInlineImage(urls[body.assetId]) : null;
      references = reference ? [reference] : [];
    } else {
      references = await loadInlineImages(project.productImagePaths, 3);
    }

    const prompt = photoPromptFor(
      references.length > 0,
      `Product name (Korean): ${project.productName} (${findCategory(project.categoryId)?.name ?? ''})`,
      project.context?.keywords?.length && `Keywords (Korean): ${project.context.keywords.join(', ')}`,
      `Scene style "${styleName}": ${scene}`,
      body.prompt?.trim() && `Additional request from the seller (may be Korean): ${body.prompt.trim()}`,
    );

    const gemini = await requireGemini();
    const image = await gemini.generateImage(prompt, references, '1:1');
    const asset = await saveGeneratedImage(job.projectId, image, { id: job.assetId, ready: false });
    await patchImageJob(job.id, { status: 'completed', imageUrl: asset.url, completedAt: nowIso() });
  } catch (err) {
    console.error('[lever] image job failed', err);
    await patchImageJob(job.id, {
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : '이미지 생성에 실패했습니다.',
      completedAt: nowIso(),
    });
  }
}

/** POST /projects/{id}/ai/images2 */
export async function startStyledImage(projectId: string, body: GenerateAIImageV2Request) {
  const style = findImageStyle(body?.styleId);
  if (!style) throw badRequest('연출 스타일을 선택해주세요.');
  await getProject(projectId);

  const now = nowIso();
  const job: ImageJob = {
    id: newId(),
    projectId,
    assetId: newId(),
    status: 'pending',
    imageUrl: null,
    errorMessage: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  };
  await writeJson(imageJobPath(job.id), job);
  runInBackground('image job', () => runImageJob(job, body, style.scene, style.name));
  return { jobId: job.id, assetId: job.assetId };
}

export async function getImageJob(jobId: string) {
  const job = await readJson<ImageJob | null>(imageJobPath(jobId), null);
  if (!job) throw notFound('이미지 생성 작업을 찾을 수 없습니다.');
  return job;
}

/** GET /projects/{id}/ai/images2/jobs/{jobId} */
export async function getImageJobStatus(projectId: string, jobId: string): Promise<GetImageGenerationJobData> {
  const job = await getImageJob(jobId);
  if (job.projectId !== projectId) throw notFound('이미지 생성 작업을 찾을 수 없습니다.');
  const { id, assetId, status, imageUrl, errorMessage, createdAt, startedAt, completedAt } = job;
  return { jobId: id, assetId, status, imageUrl, errorMessage, createdAt, startedAt, completedAt };
}

// ===== AI 문구 (요소 1개) =====

/** POST /projects/{id}/ai/texts */
export async function generateElementText(
  projectId: string,
  body: { elementId?: string; frameData?: unknown; prompt?: string },
) {
  if (!body?.elementId || !body.frameData) throw badRequest('elementId와 frameData가 필요합니다.');
  const project = await getProject(projectId);
  const frame = asNode(body.frameData);
  const target = findNode(frame, body.elementId);
  if (!target || target.type !== 'text') throw notFound('텍스트 요소를 찾을 수 없습니다.');

  const current = String(target.text ?? '');
  const others = collectEditableTexts(frame)
    .filter((t) => t.id !== body.elementId)
    .map((t) => t.text.replace(/\n/g, ' '));
  const guides = collectPromptGuides(frame);

  const gemini = await requireGemini();
  const brief = await copyBrief(project);
  const result = await gemini.generateJson<{ text?: string }>(
    `너는 한국 이커머스 상세페이지 카피라이터다. 아래 문구 1개를 상품에 맞게 다시 써라.

[상품]
${brief}
${guides.length ? `[섹션 작성 가이드]\n${guides.join('\n')}\n` : ''}
[같은 섹션의 다른 문구] ${others.join(' / ') || '없음'}
[현재 문구] ${JSON.stringify(current)}
${body.prompt?.trim() ? `[사용자 요청] ${body.prompt.trim()}` : ''}

규칙: 현재 문구와 비슷한 길이(공백 제외 ${Math.ceil(current.replace(/\s/g, '').length * 1.2) + 2}자 이내)와 같은 줄 수(${current.split('\n').length}줄)를 유지하고, 줄바꿈은 \\n 으로 쓴다.
${PLACEHOLDER_RULES}

${DETAIL_COPY_RULES}

JSON 형식: {"text":"..."}`,
    [],
    'copy',
  );
  if (!result.text?.trim()) throw badRequest('문구를 생성하지 못했습니다. 다시 시도해주세요.');
  return { elementId: body.elementId, text: result.text };
}

// ===== AI 키워드 =====

/** POST /projects/{id}/generate/keywords */
export async function generateKeywords(projectId: string, body: { forceRefresh?: boolean }) {
  const project = await getProject(projectId);
  if (project.keywords?.length && !body?.forceRefresh) return { groups: project.keywords };

  const gemini = await requireGemini();
  const result = await gemini.generateJson<{ groups?: { name: string; keywords: string[] }[] }>(
    `너는 한국 이커머스 상세페이지 기획자다. 아래 상품의 상세페이지에 강조할 만한 키워드를 그룹별로 추천하라.
상품명: ${project.productName}
카테고리: ${findCategory(project.categoryId)?.name ?? '기타'}

규칙:
- 4~5개 그룹 (예: 핵심 기능, 사용 상황, 타깃 고객, 품질·소재, 감성 포인트 — 상품에 맞게 이름을 정한다)
- 그룹마다 2~8자 한국어 키워드 6개, 중복 없이
- 확인할 수 없는 인증·수치는 넣지 않는다
JSON 형식: {"groups":[{"name":"...","keywords":["..."]}]}`,
  );
  const groups = (result.groups ?? [])
    .filter((g) => g?.name && Array.isArray(g.keywords))
    .map((g) => ({ name: String(g.name), keywords: g.keywords.map(String).filter(Boolean) }));
  if (!groups.length) throw badRequest('키워드를 생성하지 못했습니다. 다시 시도해주세요.');

  await updateProject(projectId, (p) => ({ ...p, keywords: groups }));
  return { groups };
}

/**
 * POST /projects/{id}/generate/keyword-picks
 * 후보 키워드 중 이 상품에 실제로 맞는 것만 골라 자동 체크용으로 반환한다.
 */
export async function pickKeywords(projectId: string) {
  const project = await getProject(projectId);
  const { groups: candidates } =
    project.keywords?.length
      ? { groups: project.keywords }
      : await generateKeywords(projectId, {});

  if (!candidates.length) throw badRequest('선택할 키워드 후보가 없습니다. 잠시 후 다시 시도해주세요.');

  const gemini = await requireGemini();
  const result = await gemini.generateJson<{ groups?: { name: string; keywords: string[] }[] }>(
    `너는 한국 이커머스 상세페이지 기획자다. 아래 상품에 실제로 맞는 키워드만 골라라.
상품명: ${project.productName}
카테고리: ${findCategory(project.categoryId)?.name ?? '기타'}

후보(그룹별):
${JSON.stringify(candidates)}

규칙:
- 각 그룹에서 후보에 있는 키워드만 고른다. 새 키워드를 만들지 않는다.
- 그룹당 2~4개 (후보가 적으면 그에 맞게)
- 확인할 수 없는 인증·수치·과장 표현은 고르지 않는다.
- 이 상품과 무관한 후보는 비운다.
JSON 형식: {"groups":[{"name":"그룹명","keywords":["고른키워드"]}]}`,
  );

  const byName = new Map(candidates.map((g) => [g.name, new Set(g.keywords)]));
  const groups = (result.groups ?? [])
    .filter((g) => g?.name && Array.isArray(g.keywords))
    .map((g) => {
      const name = String(g.name);
      const allowed = byName.get(name);
      if (!allowed) return null;
      const keywords = g.keywords.map(String).filter((k) => allowed.has(k));
      return keywords.length ? { name, keywords } : null;
    })
    .filter((g): g is { name: string; keywords: string[] } => Boolean(g));

  // 모델이 그룹명을 살짝 바꿔도 후보 순서로 최소 1개씩 보완
  if (!groups.length) {
    const fallback = candidates
      .map((g) => ({ name: g.name, keywords: g.keywords.slice(0, Math.min(3, g.keywords.length)) }))
      .filter((g) => g.keywords.length > 0);
    if (!fallback.length) throw badRequest('키워드를 고르지 못했습니다. 다시 시도해주세요.');
    return { groups: fallback };
  }

  return { groups };
}

// ===== 카테고리 추천 =====

/** POST /categories/match */
export async function matchCategory(body: { keyword?: string; language?: string }) {
  const keyword = body?.keyword?.trim();
  if (!keyword) throw badRequest('상품명을 입력해주세요.');

  const gemini = await requireGemini();
  const result = await gemini.generateJson<{ scores?: { id: string; score: number }[] }>(
    `상품명 "${keyword}" 이(가) 아래 쇼핑 카테고리에 얼마나 맞는지 0~100 점수를 매겨라.
카테고리: ${JSON.stringify(CATEGORIES.map((c) => ({ id: c.id, name: c.name, hints: c.keywordHints })))}
JSON 형식: {"scores":[{"id":"카테고리 id","score":0}]} (모든 카테고리 포함)`,
  );

  const scores = new Map((result.scores ?? []).map((s) => [s.id, Math.max(0, Math.min(100, Number(s.score) || 0))]));
  const categories = CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    matchScore: scores.get(c.id) ?? 0,
    imageUrl: categoryImageUrl(c.id),
  }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);

  return { keyword, language: body.language ?? 'ko', recommended: categories[0].id, categories };
}
