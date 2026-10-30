import 'server-only';
import type { AssetSignedUrlRequest } from '@/features/detail-page/types';
import { archiveAssets, getAsset, listAssets, markReady, reserveUploads } from './assets';
import {
  generateElementText,
  generateKeywords,
  generateSlotImage,
  getImageJob,
  getImageJobStatus,
  markAIImageReady,
  matchCategory,
  startStyledImage,
} from './ai';
import { toCategoryList } from './catalog/categories';
import { findGraphicSvg, listGraphicElements } from './catalog/graphics';
import {
  addSection,
  autofillDraft,
  createDraft,
  deleteDraft,
  getDraftDto,
  listDrafts,
  listReuseSources,
  paletteCatalog,
  patchDraft,
  planGuidePrompt,
  shufflePalettes,
  startGenerate,
  startPlan,
} from './drafts';
import { toDraftDto } from './drafts/repo';
import { IMAGE_STYLE_MAJORS } from './catalog/styles';
import {
  addFrame,
  addTemplateFrame,
  applyTemplate,
  deleteFrame,
  duplicateFrame,
  estimateProject,
  regenerateFrames,
  updateFrame,
} from './frames';
import { isValidGeminiKey } from './gemini';
import { buildHeroGif, getHeroMotion, searchHeroStock, startHeroMotion } from './media/heroMotion';
import { confirmGeneration, getGenerationJob, getGenerationJobStatus, startGeneration } from './generation';
import { ApiError, badRequest, createContext, fail, noContent, notFound, ok, toResponse, type RouteHandler } from './http';
import { MY_SUBSCRIPTION, PAYMENT_LISTS, creditBalance, paymentNotSupported } from './payments';
import {
  createProject,
  deleteProject,
  duplicateProject,
  getProjectDetail,
  listProjects,
  patchProject,
  restoreProject,
  saveThumbnail,
} from './projects';
import { chatEdit } from './chat';
import { createVersion, deleteVersion, listVersions, restoreVersion } from './versions';
import { getApiKeyInfo, updateSettings } from './settings';
import { loadFile, mimeFromPath, saveFile, toStoragePath, verifyUploadToken } from './storage';
import { getFigmaStatus, syncFigmaTemplates } from './templates/figmaSync';
import { adminCategories, adminListTemplates, listTemplateGroups, updateExcludedCategories } from './templates/repo';
import { createPresignedUrls } from './uploads';

/**
 * `/api/lever/*` 라우터
 *
 * 레버페이지 프론트가 호출하는 Supabase Edge Function 경로(`/functions/v1/...`)를 그대로 받아
 * 로컬 백엔드 함수로 연결한다. 패턴의 `:name` 은 경로 한 칸과 매칭된다.
 */
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const created = async (task: Promise<unknown>) => ok(await task, 201);

const ROUTES: [Method, string, RouteHandler][] = [
  // ===== 프로젝트 =====
  ['GET', 'projects', ({ query }) => listProjects(query)],
  ['POST', 'projects', async ({ body }) => created(createProject(await body())) ],
  ['POST', 'projects/upload/:type/presigned-urls', async ({ params, body }) => createPresignedUrls(params.type, await body())],
  ['GET', 'projects/generation/:jobId', ({ params }) => getGenerationJobStatus(params.jobId)],
  ['POST', 'projects/generation/:jobId/confirm', async ({ params, body }) => confirmGeneration(params.jobId, await body())],
  ['GET', 'projects/:id', ({ params }) => getProjectDetail(params.id)],
  ['PATCH', 'projects/:id', async ({ params, body }) => patchProject(params.id, await body())],
  ['DELETE', 'projects/:id', ({ params, query }) => deleteProject(params.id, query.get('permanent') === 'true')],
  ['POST', 'projects/:id/restore', ({ params }) => restoreProject(params.id)],
  ['POST', 'projects/:id/duplicate', async ({ params }) => created(duplicateProject(params.id))],
  ['GET', 'projects/:id/versions', ({ params }) => listVersions(params.id)],
  ['POST', 'projects/:id/versions', async ({ params, body }) => created(createVersion(params.id, await body()))],
  ['POST', 'projects/:id/versions/:versionId/restore', ({ params }) => restoreVersion(params.id, params.versionId)],
  ['DELETE', 'projects/:id/versions/:versionId', ({ params }) => deleteVersion(params.id, params.versionId)],
  ['PUT', 'projects/:id/thumbnail', ({ params, req }) => saveThumbnail(params.id, req)],
  ['GET', 'projects/:id/estimate', ({ params }) => estimateProject(params.id)],
  ['POST', 'projects/:id/generate', async ({ params, body }) => created(startGeneration(params.id, await body()))],
  ['POST', 'projects/:id/generate/keywords', async ({ params, body }) => generateKeywords(params.id, await body())],
  ['GET', 'projects/:id/hero-motion', ({ params }) => getHeroMotion(params.id)],
  ['POST', 'projects/:id/hero-motion', async ({ params, body }) => {
    const { kind, videoId } = await body<{ kind?: string; videoId?: number }>();
    return startHeroMotion(params.id, kind === 'video' || kind === 'stock' ? kind : 'pan', { videoId });
  }],
  ['GET', 'projects/:id/hero-motion/stock', ({ params, query }) => searchHeroStock(params.id, query.get('q'))],
  ['POST', 'projects/:id/hero-motion/gif', async ({ params, body }) => buildHeroGif(params.id, await body())],

  // ===== 초안 (입력 → 무료 기획 초안 → 생성) =====
  ['GET', 'drafts', () => listDrafts()],
  ['POST', 'drafts', async ({ body }) => created(createDraft(await body()))],
  ['GET', 'drafts/reuse-sources', ({ query }) => listReuseSources(query)],
  ['GET', 'drafts/:id', ({ params }) => getDraftDto(params.id)],
  ['PATCH', 'drafts/:id', async ({ params, body }) => patchDraft(params.id, await body())],
  ['DELETE', 'drafts/:id', ({ params }) => deleteDraft(params.id)],
  ['POST', 'drafts/:id/autofill', async ({ params }) => toDraftDto(await autofillDraft(params.id))],
  ['GET', 'drafts/:id/plan-guide', ({ params }) => planGuidePrompt(params.id)],
  ['POST', 'drafts/:id/plan', async ({ params }) => toDraftDto(await startPlan(params.id))],
  ['POST', 'drafts/:id/sections', async ({ params, body }) => toDraftDto(await addSection(params.id, await body()))],
  ['POST', 'drafts/:id/palette/shuffle', async ({ params }) => ({ presets: await shufflePalettes(params.id) })],
  ['POST', 'drafts/:id/generate', async ({ params }) => toDraftDto(await startGenerate(params.id))],
  ['GET', 'palettes', async ({ query }) => paletteCatalog(query)],

  // ===== 프레임 =====
  ['POST', 'projects/:id/frames', async ({ params, body }) => addFrame(params.id, await body())],
  ['POST', 'projects/:id/frames/template', async ({ params, body }) => addTemplateFrame(params.id, await body())],
  ['POST', 'projects/:id/frames/regenerate', ({ params }) => regenerateFrames(params.id)],
  ['POST', 'projects/:id/frames/template/:templateId', async ({ params, body }) =>
    applyTemplate(params.id, params.templateId, await body())],
  ['PATCH', 'projects/:id/frames/:frameId', async ({ params, body }) => updateFrame(params.id, params.frameId, await body())],
  ['DELETE', 'projects/:id/frames/:frameId', ({ params }) => deleteFrame(params.id, params.frameId)],
  ['POST', 'projects/:id/frames/:frameId/duplicate', async ({ params, body }) =>
    duplicateFrame(params.id, params.frameId, await body())],

  // ===== AI =====
  ['POST', 'projects/:id/ai/images', async ({ params, body }) => generateSlotImage(params.id, await body())],
  ['POST', 'projects/:id/ai/images/:assetId/ready', ({ params }) => markAIImageReady(params.id, params.assetId)],
  ['POST', 'projects/:id/ai/images2', async ({ params, body }) => created(startStyledImage(params.id, await body()))],
  ['GET', 'projects/:id/ai/images2/jobs/:jobId', ({ params }) => getImageJobStatus(params.id, params.jobId)],
  ['POST', 'projects/:id/ai/texts', async ({ params, body }) => generateElementText(params.id, await body())],
  ['POST', 'projects/:id/ai/chat', async ({ params, body }) => chatEdit(params.id, await body())],

  // ===== 에셋 (내 이미지) =====
  ['GET', 'assets', ({ query }) => listAssets(query)],
  ['POST', 'assets/signed-urls', async ({ body }) => {
    const { projectId, files } = await body<AssetSignedUrlRequest>();
    return reserveUploads(projectId, files);
  }],
  ['POST', 'assets/complete', async ({ body }) => ({ signedUrls: await markReady((await body<{ assetIds?: string[] }>()).assetIds ?? []) })],
  ['POST', 'assets/bulk-delete', async ({ body }) => archiveAssets((await body<{ assetIds: string[] }>()).assetIds)],
  ['GET', 'assets/:id', ({ params }) => getAsset(params.id)],

  // ===== 카탈로그 =====
  ['GET', 'categories', async () => toCategoryList()],
  ['POST', 'categories/match', async ({ body }) => matchCategory(await body())],
  ['GET', 'templates', ({ query }) => listTemplateGroups(query)],
  ['GET', 'public/image-generation-styles', async () => ({ majors: IMAGE_STYLE_MAJORS })],
  ['GET', 'elements', async ({ query }) => ({ elements: listGraphicElements(Number(query.get('limit')) || undefined) })],

  // ===== 설정 (Gemini API 키) =====
  ['GET', 'settings/api-keys', () => getApiKeyInfo()],
  ['POST', 'settings/api-keys', async ({ body }) => {
    const apiKey = String((await body<{ apiKey?: string }>()).apiKey ?? '').trim();
    if (!apiKey || !(await isValidGeminiKey(apiKey))) throw badRequest('유효하지 않은 API 키입니다.');
    await updateSettings((s) => ({ ...s, geminiApiKey: apiKey }));
    return getApiKeyInfo();
  }],
  ['DELETE', 'settings/api-keys', async () => {
    await updateSettings(({ geminiApiKey: _removed, ...rest }) => rest);
    return noContent();
  }],

  // ===== 결제 (로컬 버전: 제한 없음) =====
  ['GET', 'payments/credits/me', async () => creditBalance()],
  ['GET', 'payments/subscriptions/me', async () => MY_SUBSCRIPTION],
  ...Object.entries(PAYMENT_LISTS).map(
    ([path, data]): [Method, string, RouteHandler] => ['GET', `payments/${path}`, async () => data],
  ),

  // ===== 템플릿 관리 (관리 화면 + Figma 동기화) =====
  ['GET', 'template-admin/categories', async () => adminCategories()],
  ['GET', 'template-admin/templates', ({ query }) => adminListTemplates(query)],
  ['PATCH', 'template-admin/templates/:id/categories', async ({ params, body }) => {
    const ids = (await body<{ excludedCategoryIds?: unknown }>()).excludedCategoryIds;
    if (!Array.isArray(ids)) throw badRequest('excludedCategoryIds 배열이 필요합니다.');
    return updateExcludedCategories(params.id, ids.map(String));
  }],
  ['GET', 'template-admin/figma', () => getFigmaStatus()],
  ['POST', 'template-admin/sync-figma', async ({ body }) => syncFigmaTemplates(await body())],
];

function matchRoute(method: string, path: string) {
  const segments = path.split('/');
  for (const [routeMethod, pattern, handler] of ROUTES) {
    if (routeMethod !== method) continue;
    const parts = pattern.split('/');
    if (parts.length !== segments.length) continue;
    const params: Record<string, string> = {};
    const matched = parts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = segments[i];
        return true;
      }
      return part === segments[i];
    });
    if (matched) return { handler, params };
  }
  return null;
}

// ===== 파일 저장소 =====

const IMMUTABLE_PREFIXES = ['assets/', 'uploads/', 'templates/images/'];

/** `bytes=a-b` → [시작, 끝] (영상 탐색용, 잘못된 범위면 null) */
function parseRange(header: string | null, size: number): [number, number] | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end && start < size ? [start, end] : null;
}

async function serveStorage(storagePath: string, rangeHeader: string | null) {
  const graphic = findGraphicSvg(storagePath);
  if (graphic) {
    return new Response(graphic, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' },
    });
  }
  const data = await loadFile(storagePath);
  if (!data) return fail(404, '파일을 찾을 수 없습니다.');
  const immutable = IMMUTABLE_PREFIXES.some((prefix) => storagePath.startsWith(prefix));
  const headers = {
    'Content-Type': mimeFromPath(storagePath),
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'Accept-Ranges': 'bytes',
  };
  const range = parseRange(rangeHeader, data.length);
  if (range) {
    const [start, end] = range;
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${data.length}` },
    });
  }
  return new Response(new Uint8Array(data), { headers });
}

async function uploadStorage(req: Request, storagePath: string, token: string | null) {
  if (!(await verifyUploadToken(storagePath, token))) return fail(403, '업로드 권한이 없습니다.');
  await saveFile(storagePath, Buffer.from(await req.arrayBuffer()));
  return ok({ path: storagePath });
}

// ===== Realtime 대체 (폴링용 최신 상태) =====

async function realtimeRecord(channel: string) {
  const [table, , jobId] = channel.split(':');
  if (table === 'project_generation_jobs_status_realtime') {
    const job = await getGenerationJob(jobId);
    return { job_id: job.id, project_id: job.projectId, status: job.status, updated_at: job.updatedAt };
  }
  if (table === 'image_generation_jobs_status_realtime') {
    const job = await getImageJob(jobId);
    return {
      job_id: job.id,
      asset_id: job.assetId,
      status: job.status,
      image_url: job.imageUrl,
      error_message: job.errorMessage,
      updated_at: job.updatedAt,
    };
  }
  throw notFound('알 수 없는 채널입니다.');
}

const FUNCTIONS_PREFIX = 'functions/v1/';

export async function handleLeverRequest(req: Request, segments: string[]) {
  const method = req.method.toUpperCase();
  const url = new URL(req.url);
  const path = segments.join('/');

  try {
    if (path.startsWith('storage/upload/') && method === 'PUT') {
      return await uploadStorage(req, toStoragePath(path.slice('storage/upload/'.length)), url.searchParams.get('token'));
    }
    if (path.startsWith('storage/') && method === 'GET') {
      return await serveStorage(toStoragePath(path.slice('storage/'.length)), req.headers.get('range'));
    }
    if (path.startsWith('realtime/') && method === 'GET') {
      return ok({ record: await realtimeRecord(decodeURIComponent(path.slice('realtime/'.length))) });
    }
    if (path.startsWith(`${FUNCTIONS_PREFIX}payments/`) && method !== 'GET') return paymentNotSupported();

    const route = path.startsWith(FUNCTIONS_PREFIX) ? matchRoute(method, path.slice(FUNCTIONS_PREFIX.length)) : null;
    if (!route) return fail(404, `지원하지 않는 API입니다: ${method} /${path}`);
    return toResponse(await route.handler(createContext(req, route.params, url.searchParams)));
  } catch (error) {
    if (error instanceof ApiError) return fail(error.status, error.message, error.code);
    console.error(`[lever] ${method} /${path}`, error);
    return fail(500, '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
}
