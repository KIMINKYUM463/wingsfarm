import 'server-only';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_STOCK_PICKS, type HeroMotionKind, type StockPick } from '@/shared/types/heroMotion';
import { findAssetRecord } from '../assets';
import { asNode, isImageSlot, walk } from '../frames/tree';
import { requireGemini } from '../gemini';
import { ApiError, badRequest } from '../http';
import { getProject, isMotionRunning, sortFrames, toHeroMotionInfo, updateProject, type HeroMotionRecord, type ProjectRecord } from '../projects';
import { loadFile, mimeFromPath, saveFile } from '../storage';
import { runInBackground } from '../background';
import { nowIso } from '../store';
import { ffmpeg, withTempDir } from './ffmpeg';
import {
  fallbackPlan,
  frameGrabArgs,
  GIF_MAX_BYTES,
  GIF_STEPS,
  heroGifArgs,
  montageArgs,
  montagePrompt,
  normalizePlan,
  panClipArgs,
  sampleTimes,
  stockOrientation,
  totalSeconds,
  VIDEO_PROMPT_RULES,
  videoAspect,
  videoClipArgs,
  type MontageClip,
} from './motion';
import { downloadStockFile, getStockClipSource, searchStockVideos } from './stock';
import { parseStockPicks, pickVideoFile, type StockClipSource } from './stockSources';

type Target = Pick<HeroMotionRecord, 'frameId' | 'elementId' | 'assetId' | 'width' | 'height'>;

/** 페이지 맨 위 사진 자리 — 사진으로 만드는 컷은 사진이 있어야 하고, 무료 영상은 빈 자리도 된다 */
function findHeroTarget(project: ProjectRecord, allowEmpty = false): Target | null {
  for (const frame of sortFrames(project.frames)) {
    if (frame.status !== 'active') continue;
    const slot = [...walk(asNode(frame.frameData))].find(isImageSlot);
    if (!slot) continue;
    if (!slot.assetId && !allowEmpty) return null;
    return { frameId: frame.id, elementId: slot.id, assetId: slot.assetId ?? '', width: Number(slot.width), height: Number(slot.height) };
  }
  return null;
}

const NO_HERO_SLOT = '맨 위 섹션에 사진 자리가 없어요.';

const setMotion = (projectId: string, motion: HeroMotionRecord) => updateProject(projectId, (p) => ({ ...p, heroMotion: motion }));

type PhotoMotionKind = Exclude<HeroMotionKind, 'stock'>;

async function makeClip(kind: PhotoMotionKind, source: { data: Buffer; mimeType: string }, target: Target, productName: string) {
  return withTempDir(async (dir) => {
    const input = path.join(dir, `source${path.extname(`x.${source.mimeType.split('/')[1] ?? 'png'}`)}`);
    const clip = path.join(dir, 'clip.mp4');
    await writeFile(input, source.data);
    if (kind === 'video') {
      const gemini = await requireGemini();
      const prompt = `${VIDEO_PROMPT_RULES} Product: ${productName}.`;
      const video = await gemini.generateVideo({ data: source.data.toString('base64'), mimeType: source.mimeType }, prompt, videoAspect(target.width, target.height));
      const raw = path.join(dir, 'raw.mp4');
      await writeFile(raw, video);
      await ffmpeg(videoClipArgs(raw, clip, target.width, target.height));
    } else {
      await ffmpeg(panClipArgs(input, clip, target.width, target.height));
    }
    return readFile(clip);
  });
}

interface StockInput {
  pick: StockPick;
  video: StockClipSource;
}

/** 고른 영상을 사진 자리를 덮는 크기로 내려받아 임시 폴더에 저장 */
async function downloadStockInputs(inputs: StockInput[], target: Target, dir: string) {
  return Promise.all(
    inputs.map(async ({ pick, video }, i) => {
      const file = pickVideoFile(video.files, target.width, target.height);
      if (!file) throw new ApiError(502, `${i + 1}번 영상은 내려받을 수 있는 파일이 없어요. 다른 영상을 골라 주세요.`);
      const filePath = path.join(dir, `stock-${i}.mp4`);
      await writeFile(filePath, await downloadStockFile(pick.source, file.link));
      return filePath;
    }),
  );
}

/** AI(Gemini)가 장면을 보고 컷을 고른다 — 키가 없거나 답이 규칙에 안 맞으면 기본 편집 + 안내 */
async function planMontage(files: string[], clips: MontageClip[], productName: string, dir: string) {
  const gemini = await requireGemini().catch(() => null);
  if (!gemini) return { cuts: fallbackPlan(clips), summary: null, notice: 'Gemini 키가 없어 AI 대신 기본 컷 편집으로 만들었어요.' };
  try {
    const times = clips.map((clip) => sampleTimes(clip.duration));
    const frames = await Promise.all(
      files.map(async (file, clip) => {
        const outputs = times[clip].map((_, i) => path.join(dir, `frame-${clip}-${i}.jpg`));
        await ffmpeg(frameGrabArgs(file, times[clip], outputs), 60_000);
        return Promise.all(outputs.map(async (output) => ({ mimeType: 'image/jpeg', data: (await readFile(output)).toString('base64') })));
      }),
    );
    const answer = await gemini.generateJson<{ cuts?: unknown; summary?: unknown }>(montagePrompt(productName, clips, times), frames.flat());
    const cuts = normalizePlan(answer, clips);
    if (!cuts) throw new Error('AI 편집안이 규칙에 맞지 않음');
    return { cuts, summary: typeof answer.summary === 'string' ? answer.summary.trim().slice(0, 120) || null : null, notice: null };
  } catch (err) {
    console.error('[lever] montage plan failed, using fallback', err);
    return { cuts: fallbackPlan(clips), summary: null, notice: 'AI 편집이 잘 안 돼서 기본 컷 편집으로 만들었어요.' };
  }
}

/** 무료 영상 1~3개 → AI가 고른 장면으로 컷 편집한 클립 (사진 자리 크기) */
async function makeStockMontage(inputs: StockInput[], target: Target, productName: string) {
  return withTempDir(async (dir) => {
    const files = await downloadStockInputs(inputs, target, dir);
    const clips = inputs.map(({ video }) => ({ duration: video.duration }));
    const plan = await planMontage(files, clips, productName, dir);
    if (!plan.cuts.length) throw new ApiError(400, '고른 영상이 너무 짧아요. 2초 넘는 영상을 골라 주세요.');
    const output = path.join(dir, 'clip.mp4');
    await ffmpeg(montageArgs(plan.cuts.map((cut) => ({ ...cut, path: files[cut.clip] })), output, target.width, target.height));
    const edit = `컷 ${plan.cuts.length}개 · ${totalSeconds(plan.cuts)}초`;
    return { clip: await readFile(output), summary: plan.summary ? `${plan.summary} (${edit})` : edit, notice: plan.notice };
  });
}

async function runStockMotion(projectId: string, inputs: StockInput[], target: Target, productName: string, applied: boolean) {
  const base = { ...target, kind: 'stock' as const, credits: inputs.map(({ video }) => video.credit), applied };
  try {
    const { clip, summary, notice } = await makeStockMontage(inputs, target, productName);
    const clipPath = `assets/motion-${projectId}-${Date.now()}.mp4`;
    await saveFile(clipPath, clip);
    await setMotion(projectId, { ...base, status: 'ready', clipPath, summary, notice, updatedAt: nowIso() });
  } catch (err) {
    console.error('[lever] stock motion failed', err);
    const notice = err instanceof ApiError ? err.message : '무료 영상으로 컷을 만들지 못했어요. 다른 영상을 골라 주세요.';
    await setMotion(projectId, { ...base, status: 'failed', clipPath: null, notice, updatedAt: nowIso() }).catch(() => null);
  }
}

async function runHeroMotion(projectId: string, kind: PhotoMotionKind, target: Target, productName: string, applied: boolean) {
  const base = { ...target, kind, clipPath: null, notice: null, applied };
  try {
    const asset = await findAssetRecord(target.assetId);
    const data = asset && (await loadFile(asset.path));
    if (!asset || !data) throw new ApiError(404, '맨 위 사진을 찾을 수 없어요.');
    const source = { data, mimeType: asset.contentType || mimeFromPath(asset.path) };

    let usedKind: PhotoMotionKind = kind;
    let notice: string | null = null;
    let clip: Buffer;
    try {
      clip = await makeClip(kind, source, target, productName);
    } catch (err) {
      if (kind !== 'video') throw err;
      // AI 영상이 막히거나 늦으면 무료 줌·이동으로 대신 (비용이 들었어도 결과는 남긴다)
      console.error('[lever] hero video failed, falling back to pan', err);
      notice = `AI 영상을 만들지 못해 줌·이동 컷으로 대신했어요. (${err instanceof ApiError ? err.message : '일시 오류'})`;
      usedKind = 'pan';
      clip = await makeClip('pan', source, target, productName);
    }
    const clipPath = `assets/motion-${projectId}-${Date.now()}.mp4`;
    await saveFile(clipPath, clip);
    await setMotion(projectId, { ...base, kind: usedKind, status: 'ready', clipPath, notice, updatedAt: nowIso() });
  } catch (err) {
    console.error('[lever] hero motion failed', err);
    const notice = err instanceof ApiError ? err.message : '움직이는 컷을 만들지 못했어요. 다시 시도해 주세요.';
    await setMotion(projectId, { ...base, status: 'failed', notice, updatedAt: nowIso() }).catch(() => null);
  }
}

/** GET /projects/{id}/hero-motion — 에디터가 진행 상태를 가볍게 확인 */
export async function getHeroMotion(projectId: string) {
  return { heroMotion: toHeroMotionInfo((await getProject(projectId)).heroMotion) };
}

interface StartOptions {
  /** 무료 영상: [{ source, videoId }] 1~3개 (예전 형식 source·videoId도 받음) */
  videos?: unknown;
  source?: unknown;
  videoId?: unknown;
  /** 초안 생성처럼 사용자가 미리 고른 경우 — 미리 보기 없이 바로 맨 위에 넣는다 */
  autoApply?: boolean;
}

/** 작업을 걸어 두고 바로 돌아온다 (AI 영상은 1~3분) — 화면은 프로젝트 조회로 상태를 확인. 다 되면 미리 보고 '적용'해야 들어간다 */
export async function startHeroMotion(projectId: string, kind: HeroMotionKind, options: StartOptions = {}) {
  const project = await getProject(projectId);
  if (isMotionRunning(project.heroMotion)) throw badRequest('움직이는 컷을 만들고 있어요. 잠시만 기다려 주세요.');
  const applied = options.autoApply === true;

  if (kind === 'stock') {
    const target = findHeroTarget(project, true);
    if (!target) throw badRequest(NO_HERO_SLOT);
    const picks = parseStockPicks(options);
    if (!picks) throw badRequest(`가져올 영상을 1~${MAX_STOCK_PICKS}개 골라 주세요.`);
    const inputs = await Promise.all(picks.map(async (pick) => ({ pick, video: await getStockClipSource(pick.source, pick.videoId) })));
    const credits = inputs.map(({ video }) => video.credit);
    const pending = await setMotion(projectId, { ...target, kind, credits, applied, status: 'pending', clipPath: null, notice: null, updatedAt: nowIso() });
    runInBackground('stock motion', () => runStockMotion(projectId, inputs, target, project.productName, applied));
    return { heroMotion: toHeroMotionInfo(pending.heroMotion) };
  }

  const target = findHeroTarget(project);
  if (!target) throw badRequest('맨 위 사진 자리에 사진을 먼저 넣어 주세요.');
  if (kind === 'video') await requireGemini();
  const pending = await setMotion(projectId, { ...target, kind, applied, status: 'pending', clipPath: null, notice: null, updatedAt: nowIso() });
  runInBackground('hero motion', () => runHeroMotion(projectId, kind, target, project.productName, applied));
  return { heroMotion: toHeroMotionInfo(pending.heroMotion) };
}

/** POST /projects/{id}/hero-motion/apply — 미리 본 컷을 상세페이지 맨 위 사진 자리에 넣는다 */
export async function applyHeroMotion(projectId: string) {
  const project = await updateProject(projectId, (p) => {
    if (p.heroMotion?.status !== 'ready' || !p.heroMotion.clipPath) throw badRequest('적용할 움직이는 컷이 아직 없어요.');
    return { ...p, heroMotion: { ...p.heroMotion, applied: true } };
  });
  return { heroMotion: toHeroMotionInfo(project.heroMotion) };
}

/** GET /projects/{id}/hero-motion/stock?q= — 사진 자리 모양에 맞는 무료 영상 검색 (검색어가 없으면 상품명) */
export async function searchHeroStock(projectId: string, query: string | null) {
  const project = await getProject(projectId);
  const target = findHeroTarget(project, true);
  if (!target) throw badRequest(NO_HERO_SLOT);
  const q = (query ?? '').trim().slice(0, 80) || project.productName.trim();
  if (!q) throw badRequest('검색어를 입력해 주세요.');
  return { query: q, ...(await searchStockVideos(q, stockOrientation(target.width, target.height))) };
}

// ===== 다운로드: 섹션 문구와 합성한 GIF =====

const MAX_LAYER_BYTES = 20 * 1024 * 1024;

const decodePng = (dataUrl: unknown) => {
  const match = typeof dataUrl === 'string' ? dataUrl.match(/^data:image\/png;base64,(.+)$/) : null;
  const data = match ? Buffer.from(match[1], 'base64') : null;
  if (!data || data.length > MAX_LAYER_BYTES) throw badRequest('섹션 이미지를 읽지 못했어요.');
  return data;
};

const finite = (value: unknown, min: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw badRequest('사진 자리 위치가 올바르지 않아요.');
  return n;
};

interface GifBody {
  below?: unknown;
  above?: unknown;
  rect?: { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  outWidth?: unknown;
}

/** POST /projects/{id}/hero-motion/gif — 화면이 그린 아래·위 레이어 + 클립 → GIF (용량 맞춰 단계적으로 줄임) */
export async function buildHeroGif(projectId: string, body: GifBody) {
  const { heroMotion } = await getProject(projectId);
  if (heroMotion?.status !== 'ready' || !heroMotion.clipPath) throw badRequest('움직이는 컷이 아직 준비되지 않았어요.');
  const clip = await loadFile(heroMotion.clipPath);
  if (!clip) throw badRequest('움직이는 컷 파일이 없어요. 다시 만들어 주세요.');
  const rect = {
    x: finite(body.rect?.x, -4000, 4000),
    y: finite(body.rect?.y, -4000, 8000),
    width: finite(body.rect?.width, 2, 4000),
    height: finite(body.rect?.height, 2, 8000),
  };
  const outWidth = finite(body.outWidth, 200, 1600);
  const below = decodePng(body.below);
  const above = decodePng(body.above);

  const gif = await withTempDir(async (dir) => {
    const files = { below: path.join(dir, 'below.png'), above: path.join(dir, 'above.png'), clip: path.join(dir, 'clip.mp4'), output: path.join(dir, 'hero.gif') };
    await Promise.all([writeFile(files.below, below), writeFile(files.above, above), writeFile(files.clip, clip)]);
    for (const step of GIF_STEPS) {
      await ffmpeg(heroGifArgs({ ...files, rect, outWidth }, step));
      if ((await stat(files.output)).size <= GIF_MAX_BYTES || step === GIF_STEPS.at(-1)) break;
    }
    return readFile(files.output);
  });
  return new Response(new Uint8Array(gif), {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', 'Content-Length': String(gif.length) },
  });
}
