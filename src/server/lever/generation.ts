import 'server-only';
import pLimit from 'p-limit';
import type { ProjectFrame } from '@/features/editor/types';
import { createDetailPageSchema, type CreateDetailPageRequest, type ProjectGenerationStatus } from '@/shared/types/detail-page';
import { findCategory } from './catalog/categories';
import { rewriteFrame, sameKindFocus } from './copywriter';
import { copyBrief } from './productFacts';
import { asFrame, asNode, cloneWithNewIds } from './frames/tree';
import { loadInlineImages, requireGemini, type GeminiClient } from './gemini';
import { ApiError, badRequest, notFound } from './http';
import { getProject, saveNewProject, sortFrames, updateProject, type ProductContext, type ProjectRecord } from './projects';
import { toStoragePath } from './storage';
import { runInBackground } from './background';
import { newId, nowIso, readJson, updateJson, writeJson } from './store';

/**
 * AI 상세페이지 생성 Job (레버페이지 상태 흐름 그대로)
 * context_pending → context_processing → ai_pending → ai_processing → ai_completed
 * → (사용자 확정) saving_pending → saving_processing → completed
 */
export interface GenerationJob {
  id: string;
  sourceProjectId: string;
  projectId: string | null;
  status: ProjectGenerationStatus;
  errorMessage: string | null;
  request: CreateDetailPageRequest;
  context?: ProductContext;
  frames?: ProjectFrame[];
  createdAt: string;
  updatedAt: string;
}

const jobPath = (id: string) => `jobs/generation/${id}.json`;
const STALE_MS = 10 * 60 * 1000;
const frameLimit = pLimit(3);

const readJob = (id: string) => readJson<GenerationJob | null>(jobPath(id), null);

const patchJob = (id: string, patch: Partial<GenerationJob>) =>
  updateJson<GenerationJob | null, GenerationJob>(
    jobPath(id),
    null,
    (job) => ({ ...job!, ...patch, updatedAt: nowIso() }),
    (job) => job!,
  );

const errorMessageOf = (err: unknown) =>
  err instanceof ApiError ? err.message : '처리 중 오류가 발생했습니다. 다시 시도해주세요.';

/** 단계 실행 + 실패 시 `{단계}_failed` 로 기록 */
async function runStage(jobId: string, stage: 'context' | 'ai' | 'saving', task: () => Promise<void>) {
  try {
    await task();
    return true;
  } catch (err) {
    console.error(`[lever] generation ${stage} failed`, err);
    await patchJob(jobId, { status: `${stage}_failed`, errorMessage: errorMessageOf(err) });
    return false;
  }
}

// ===== 1. 상품 컨텍스트 =====

function describeRequest(project: ProjectRecord, request: CreateDetailPageRequest) {
  const lines = [
    `상품명: ${project.productName}`,
    `카테고리: ${findCategory(project.categoryId)?.name ?? '기타'}`,
    `업체명: ${request.companyName}`,
  ];
  if (request.generationMethod === 'keyword_selection') {
    const { keywordData, customFeatures } = request.generationData.keywordSelection;
    for (const group of keywordData?.groups ?? []) {
      if (group.keywords.length) lines.push(`${group.name}: ${group.keywords.join(', ')}`);
    }
    if (customFeatures?.trim()) lines.push(`판매자가 강조한 특징: ${customFeatures.trim()}`);
  } else {
    lines.push('첨부한 참고 상세페이지 이미지의 톤앤매너·강조 포인트를 참고한다. (문구를 그대로 베끼지 말 것)');
  }
  return lines.join('\n');
}

async function buildContext(gemini: GeminiClient, project: ProjectRecord, request: CreateDetailPageRequest) {
  const productImages = await loadInlineImages(request.productImageUrls, 3);
  const references =
    request.generationMethod === 'image_upload'
      ? await loadInlineImages(request.generationData.imageUpload.detailPageUrls, 4)
      : [];

  const photoGuide = productImages.length
    ? `아래 상품 정보와 첨부 사진(앞쪽 ${productImages.length}장은 상품 사진)을 분석해`
    : '상품 사진은 없다. 아래 상품명·업체명·키워드만으로';
  const context = await gemini.generateJson<ProductContext>(
    `너는 한국 이커머스 상세페이지 기획자다. ${photoGuide} 상세페이지 기획용 정보를 JSON으로 정리하라.

${describeRequest(project, request)}

JSON 형식:
{"summary":"상품 한 줄 요약","target":"핵심 타깃 고객","tone":"문구 톤앤매너","sellingPoints":["핵심 장점 5개"],"keywords":["강조 키워드 8개"]}

규칙: 사진과 입력에서 확인할 수 없는 성분·수치·인증·수상 이력은 지어내지 않는다. 사진이 없으면 키워드에 없는 수치·인증을 만들지 않는다.`,
    [...productImages, ...references],
  );
  return {
    summary: String(context.summary ?? ''),
    target: String(context.target ?? ''),
    tone: String(context.tone ?? ''),
    sellingPoints: Array.isArray(context.sellingPoints) ? context.sellingPoints.map(String) : [],
    keywords: Array.isArray(context.keywords) ? context.keywords.map(String) : [],
  };
}

// ===== 2. Job 실행 (프레임 문구는 copywriter.rewriteFrame) =====

async function runGeneration(jobId: string) {
  const job = (await readJob(jobId))!;
  const project = await getProject(job.sourceProjectId);
  let gemini: GeminiClient;
  let context: ProductContext;

  const contextOk = await runStage(jobId, 'context', async () => {
    await patchJob(jobId, { status: 'context_processing' });
    gemini = await requireGemini();
    context = await buildContext(gemini, project, job.request);
    await patchJob(jobId, { status: 'ai_pending', context });
  });
  if (!contextOk) return;

  await runStage(jobId, 'ai', async () => {
    await patchJob(jobId, { status: 'ai_processing' });
    const brief = await copyBrief(project, context);
    let failures = 0;
    let lastError: unknown;
    const focus = sameKindFocus(sortFrames(project.frames), context.sellingPoints);
    const frames = await Promise.all(
      project.frames.map((frame) =>
        frame.status !== 'active'
          ? frame
          : frameLimit(() =>
              rewriteFrame(gemini, brief, frame, [], focus.get(frame.id)).catch((err) => {
                failures += 1;
                lastError = err;
                return frame;
              }),
            ),
      ),
    );
    if (failures && failures === frames.filter((f) => f.status === 'active').length) throw lastError;
    await patchJob(jobId, { status: 'ai_completed', frames });
  });
}

/** POST /projects/{id}/generate */
export async function startGeneration(projectId: string, body: unknown) {
  const parsed = createDetailPageSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.');
  await getProject(projectId);

  const now = nowIso();
  const job: GenerationJob = {
    id: newId(),
    sourceProjectId: projectId,
    projectId: null,
    status: 'context_pending',
    errorMessage: null,
    request: parsed.data,
    createdAt: now,
    updatedAt: now,
  };
  await writeJson(jobPath(job.id), job);
  await updateProject(projectId, (p) => ({ ...p, generationJobId: job.id }));

  runInBackground('generation', () => runGeneration(job.id));
  return { id: job.id, status: job.status, message: '상세페이지 생성을 시작했습니다.' };
}

/** 진행 중이던 Job이 서버 재시작 등으로 멈췄으면 실패 처리 */
async function settleStale(job: GenerationJob) {
  const running = /_(pending|processing)$/.test(job.status);
  if (!running || Date.now() - Date.parse(job.updatedAt) < STALE_MS) return job;
  const stage = job.status.split('_')[0] as 'context' | 'ai' | 'saving';
  return patchJob(job.id, { status: `${stage}_failed`, errorMessage: '작업이 중단되었습니다. 다시 시도해주세요.' });
}

export async function getGenerationJob(jobId: string) {
  const job = await readJob(jobId);
  if (!job) throw notFound('생성 작업을 찾을 수 없습니다.');
  return settleStale(job);
}

/** GET /projects/generation/{jobId} */
export async function getGenerationJobStatus(jobId: string) {
  const job = await getGenerationJob(jobId);
  return { status: job.status, jobId: job.id, projectId: job.projectId, updatedAt: job.updatedAt };
}

// ===== 3. 확정 저장 =====

async function saveResult(jobId: string, mode: 'create' | 'overwrite') {
  await runStage(jobId, 'saving', async () => {
    await patchJob(jobId, { status: 'saving_processing' });
    const job = (await readJob(jobId))!;
    const source = await getProject(job.sourceProjectId);
    const generated = {
      companyName: job.request.companyName,
      productImagePaths: job.request.productImageUrls.map(toStoragePath),
      context: job.context,
      generationJobId: job.id,
      viewCount: 0,
    };

    let projectId = source.id;
    if (mode === 'overwrite') {
      await updateProject(source.id, (p) => ({ ...p, ...generated, frames: job.frames ?? p.frames }));
    } else {
      projectId = newId();
      const now = nowIso();
      const frames = (job.frames ?? source.frames).map((frame) => {
        const id = newId();
        return {
          ...frame,
          id,
          projectId,
          frameData: frame.status === 'active' ? asFrame(cloneWithNewIds(asNode(frame.frameData), id)) : frame.frameData,
        };
      });
      await saveNewProject({
        ...source,
        ...generated,
        id: projectId,
        title: source.productName,
        thumbnailPath: null,
        createdAt: now,
        updatedAt: now,
        frames,
      });
    }
    await patchJob(jobId, { status: 'completed', projectId });
  });
}

/** POST /projects/generation/{jobId}/confirm */
export async function confirmGeneration(jobId: string, body: { mode?: string }) {
  const mode = body?.mode === 'overwrite' ? 'overwrite' : 'create';
  const job = await getGenerationJob(jobId);
  if (job.status !== 'ai_completed') throw badRequest('확정할 수 있는 상태가 아닙니다.');
  await patchJob(jobId, { status: 'saving_pending' });
  runInBackground('saving', () => saveResult(jobId, mode));
  return { message: '저장을 시작했습니다.', status: 'saving_pending' as const };
}
