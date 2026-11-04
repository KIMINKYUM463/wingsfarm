import 'server-only';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HERO_CLIP_SIZE, MAX_STOCK_PICKS, type HeroMotionKind, type StockPick } from '@/shared/types/heroMotion';
import { findAssetRecord } from '../assets';
import { asNode, isImageSlot, walk } from '../frames/tree';
import { requireGemini } from '../gemini';
import { ApiError, badRequest } from '../http';
import { getProject, isMotionRunning, sortFrames, toHeroMotionInfo, updateProject, type HeroMotionRecord, type ProjectRecord } from '../projects';
import { loadFile, mimeFromPath, publicUrl, saveFile } from '../storage';
import { runInBackground } from '../background';
import { nowIso } from '../store';
import { renderCaptionPng, renderTagPng } from './captionPng';
import { ffmpeg, probeVideo, withTempDir } from './ffmpeg';
import {
  cleanCaption,
  fallbackPlan,
  frameGrabArgs,
  GIF_MAX_BYTES,
  GIF_STEPS,
  heroGifArgs,
  joinRenderedCutsArgs,
  MONTAGE,
  montagePrompt,
  normalizePlan,
  panClipArgs,
  sampleTimes,
  singleCutRenderArgs,
  stockOrientation,
  VIDEO_PROMPT_RULES,
  videoAspect,
  videoClipArgs,
  type MontageClip,
} from './motion';
import { downloadStockFile, getStockClipSource, searchStockPhotos, searchStockVideos, uploadMetaToStock } from './stock';
import {
  parseStockPicks,
  pickVideoFile,
  uploadMetaPath,
  uploadThumbPath,
  uploadVideoPath,
  type StockClipSource,
} from './stockSources';
  for (const frame of sortFrames(project.frames)) {
    if (frame.status !== 'active') continue;
    const slot = [...walk(asNode(frame.frameData))].find(isImageSlot);
    if (!slot) continue;
    return slot.assetId ? { frameId: frame.id, elementId: slot.id, assetId: slot.assetId, ...HERO_CLIP_SIZE } : null;
  }
  return null;
}

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
/** 고른 영상을 사진 자리를 덮는 크기로 내려받아 임시 폴더에 저장 (내 영상은 저장소에서 복사) */
async function downloadStockInputs(inputs: StockInput[], target: Target, dir: string, projectId: string) {
  return Promise.all(
    inputs.map(async ({ pick, video }, i) => {
      const filePath = path.join(dir, `stock-${i}.mp4`);
      if (pick.source === 'upload') {
        const data = await loadFile(uploadVideoPath(projectId, pick.videoId));
        if (!data) throw new ApiError(404, `${i + 1}번 내 영상을 찾지 못했어요. 다시 첨부해 주세요.`);
        await writeFile(filePath, data);
        return filePath;
      }
      const file = pickVideoFile(video.files, target.width, target.height);
      if (!file) throw new ApiError(502, `${i + 1}번 영상은 내려받을 수 있는 파일이 없어요. 다른 영상을 골라 주세요.`);
  const times = clips.map((clip) => sampleTimes(clip.duration, Math.min(4, MONTAGE.framesPerClip)));
  const frames: { mimeType: string; data: string }[] = [];
  const labels: string[] = [];
  for (let clip = 0; clip < files.length; clip++) {
    const outputs = times[clip]!.map((_, i) => path.join(dir, `frame-${clip}-${i}.jpg`));
    try {
      await ffmpeg(frameGrabArgs(files[clip]!, times[clip]!, outputs), 45_000);
      for (let i = 0; i < outputs.length; i++) {
        frames.push({ mimeType: 'image/jpeg', data: (await readFile(outputs[i]!)).toString('base64') });
        labels.push(`clip ${clip + 1} @ ${times[clip]![i]}s`);
      }
    } catch (err) {
      console.error('[lever] frame grab skip', clip, err);
    }
  }
  return { frames, times, labels };
}

/** AI(Gemini)가 장면을 보고 컷을 고른다 — 키가 없거나 답이 규칙에 안 맞으면 기본 편집 + 안내 */
async function planMontage(files: string[], clips: MontageClip[], productName: string, dir: string) {
  const gemini = await requireGemini().catch(() => null);
  if (!gemini) {
    return {
      cuts: fallbackPlan(clips, productName),
      summary: null,
      notice: 'Gemini 키가 없어 AI 대신 기본 컷 편집으로 만들었어요(자막은 상품명만).',
    };
  }

  const { frames, times, labels } = await grabPlanFrames(files, clips, dir);
  const prompt = frames.length
    ? montagePrompt(productName, clips, times)
    : `${montagePrompt(productName, clips, times)}\n(장면 이미지는 없다. 길이만 보고 컷을 짜라.)`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const answer = await gemini.generateJson<{ cuts?: unknown; summary?: unknown }>(prompt, frames);
      const cuts = normalizePlan(answer, clips);
      if (!cuts?.length) throw new Error(`AI 편집안이 규칙에 맞지 않음 (attempt ${attempt + 1}, frames=${frames.length}, labels=${labels.length})`);
      return {
        cuts,
        summary: typeof answer.summary === 'string' ? answer.summary.trim().slice(0, 120) || null : null,
        notice: null,
      };
    } catch (err) {
      console.error('[lever] montage plan attempt failed', attempt + 1, err);
    }
  }

  return {
    cuts: fallbackPlan(clips, productName),
    summary: null,
    notice: 'AI 편집이 잘 안 돼서 기본 컷 편집으로 만들었어요(자막은 상품명만).',
  };
}

/**
 * 무료 영상 1~3개 → AI가 고른 장면·자막으로 컷 편집 + 모션그래픽
 * 배포에서는 컷을 하나씩 렌더한 뒤 전환으로 이어, 로컬과 같은 고급 편집 결과를 만든다.
 */
async function makeStockMontage(inputs: StockInput[], target: Target, productName: string) {
  return withTempDir(async (dir) => {
    const files = await downloadStockInputs(inputs, target, dir);
    const clips = inputs.map(({ video }) => ({ duration: video.duration }));
    const plan = await planMontage(files, clips, productName, dir);
    if (!plan.cuts.length) throw new ApiError(400, '고른 영상이 너무 짧아요. 2초 넘는 영상을 골라 주세요.');

    // 배포 ffmpeg에 drawtext가 없어 자막·태그는 PNG로 그려 overlay 한다
async function makeStockMontage(inputs: StockInput[], target: Target, productName: string, projectId: string) {
  return withTempDir(async (dir) => {
    const files = await downloadStockInputs(inputs, target, dir, projectId);
    const clips = inputs.map(({ video }) => ({ duration: video.duration }));
    const plan = await planMontage(files, clips, productName, dir);
    if (!plan.cuts.length) throw new ApiError(400, '고른 영상이 너무 짧아요. 2초 넘는 영상을 골라 주세요.');

    // 배포 ffmpeg에 drawtext가 없어 자막·태그는 PNG로 그려 overlay 한다
    const tag = cleanCaption(productName, 20);
    const captionPngs = await Promise.all(
      plan.cuts.map(async (cut, i) => {
        if (!cut.caption) return null;
        const png = await renderCaptionPng(cut.caption, target.width);
        if (!png) return null;
        const file = path.join(dir, `caption-${i}.png`);
        await writeFile(file, png);
        return file;
      }),
    );
    let tagPng: string | null = null;
    if (tag) {
      const png = await renderTagPng(tag, target.width);
      if (png) {
        tagPng = path.join(dir, 'tag.png');
        await writeFile(tagPng, png);
      }
    }
    const withText = captionPngs.some(Boolean) || Boolean(tagPng);

    const cuts = plan.cuts.map((cut) => ({ ...cut, path: files[cut.clip]! }));
    const rendered: { path: string; duration: number }[] = [];
    for (let i = 0; i < cuts.length; i++) {
      const cutPath = path.join(dir, `cut-${i}.mp4`);
      await ffmpeg(singleCutRenderArgs(cuts[i]!, i, cutPath, target.width, target.height, captionPngs[i] ?? null), 90_000, dir);
      rendered.push({ path: cutPath, duration: cuts[i]!.duration });
    }

    const output = path.join(dir, 'clip.mp4');
    await ffmpeg(
      joinRenderedCutsArgs({
        cuts: rendered,
        output,
        width: target.width,
        height: target.height,
        tagPng,
      }),
      120_000,
      dir,
    );

    const captions = withText ? plan.cuts.flatMap((cut) => (cut.caption ? [cut.caption] : [])) : [];
    // concat이라 컷 길이 합이 실제 영상 길이 (xfade 겹침 없음)
    const seconds = Math.floor(plan.cuts.reduce((s, c) => s + c.duration, 0) * 10) / 10;
    const edit = `컷 ${plan.cuts.length}개 · ${seconds}초 · 자막 ${captions.length}개`;
    const notice =
      [plan.notice, withText ? null : '자막 글꼴을 찾지 못해 자막 없이 만들었어요.'].filter(Boolean).join(' ') || null;
    return { clip: await readFile(output), summary: plan.summary ? `${plan.summary} (${edit})` : edit, captions, notice };
  });
}

async function runStockMotion(projectId: string, inputs: StockInput[], target: Target, productName: string, applied: boolean) {
  const base = { ...target, kind: 'stock' as const, credits: inputs.map(({ video }) => video.credit), applied };
  try {
    const { clip, summary, captions, notice } = await makeStockMontage(inputs, target, productName, projectId);
        : `무료 영상으로 컷을 만들지 못했어요. 잠시 뒤 다시 만들어 보고, 계속 안 되면 다른 영상을 골라 주세요. (${summarizeUnknownError(err)})`;
    await setMotion(projectId, { ...base, status: 'failed', clipPath: null, notice, updatedAt: nowIso() }).catch(() => null);
  }
}

/** 배포 로그·사용자 안내용으로 알 수 없는 오류를 짧게 남긴다 */
function summarizeUnknownError(err: unknown) {
  const e = err as { code?: string | number; signal?: string; message?: string };
  const parts = [e.code != null ? `code=${e.code}` : null, e.signal ? `signal=${e.signal}` : null, e.message?.slice(0, 80)]
    .filter(Boolean)
    .join(' · ');
  return parts || 'unknown';
}

async function loadStockPhotoSource(productName: string) {
  const photos = await searchStockPhotos(productName);
  const photo = photos[0];
  if (!photo) throw new ApiError(404, '상품과 어울리는 무료 사진을 찾지 못했어요. 검색어를 바꿔 무료 영상으로 만들어 주세요.');
  const data = await downloadStockFile(photo.source, photo.url);
  const mimeType = photo.url.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
  return { source: { data, mimeType }, credit: photo.credit };
}

async function runHeroMotion(projectId: string, kind: PhotoMotionKind, target: Target, productName: string, applied: boolean) {
  const base = { ...target, kind, clipPath: null, notice: null, applied };
  try {
    let source: { data: Buffer; mimeType: string };
    let credits: HeroMotionRecord['credits'];
    if (kind === 'video') {
      const found = await loadStockPhotoSource(productName);
      source = found.source;
      credits = [found.credit];
    } else {
      const asset = await findAssetRecord(target.assetId);
      const data = asset && (await loadFile(asset.path));
      if (!asset || !data) throw new ApiError(404, '맨 위 사진을 찾을 수 없어요.');
      source = { data, mimeType: asset.contentType || mimeFromPath(asset.path) };
    }

    let usedKind: PhotoMotionKind = kind;
    let notice: string | null = null;
    let clip: Buffer;
    try {
      clip = await makeClip(kind, source, target, productName);
    } catch (err) {
      if (kind !== 'video') throw err;
      console.error('[lever] hero video failed, falling back to pan', err);
      notice = `AI 영상을 만들지 못해 찾은 무료 사진을 줌·이동 컷으로 대신했어요. (${err instanceof ApiError ? err.message : '일시 오류'})`;
      usedKind = 'pan';
      clip = await makeClip('pan', source, target, productName);
    }
    const clipPath = `assets/motion-${projectId}-${Date.now()}.mp4`;
    await saveFile(clipPath, clip);
    await setMotion(projectId, { ...base, kind: usedKind, credits, status: 'ready', clipPath, notice, updatedAt: nowIso() });
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
    const target = STOCK_TARGET;
    const picks = parseStockPicks(options);
    if (!picks) throw badRequest(`가져올 영상을 1~${MAX_STOCK_PICKS}개 골라 주세요.`);
    const inputs = await Promise.all(picks.map(async (pick) => ({ pick, video: await getStockClipSource(pick.source, pick.videoId) })));
    const credits = inputs.map(({ video }) => video.credit);
    const pending = await setMotion(projectId, { ...target, kind, credits, applied, status: 'pending', clipPath: null, notice: null, updatedAt: nowIso() });
    runInBackground('stock motion', () => runStockMotion(projectId, inputs, target, project.productName, applied));
    return { heroMotion: toHeroMotionInfo(pending.heroMotion) };
  }

  if (kind === 'video') {
    const inputs = await Promise.all(
      picks.map(async (pick) => ({ pick, video: await getStockClipSource(pick.source, pick.videoId, projectId) })),
    );
    for (const { video } of inputs) {
      if (video.duration < 2) throw badRequest('2초보다 짧은 영상은 쓸 수 없어요. 더 긴 영상을 골라 주세요.');
    }
    const pending = await setMotion(projectId, {
      ...STOCK_TARGET,
      kind,
      applied,
      status: 'pending',
      clipPath: null,
      notice: null,
      updatedAt: nowIso(),
    });
    runInBackground('hero motion', () => runHeroMotion(projectId, 'video', STOCK_TARGET, project.productName, applied));
    return { heroMotion: toHeroMotionInfo(pending.heroMotion) };
  }

  const target = findHeroPhoto(project);
  if (!target) throw badRequest('맨 위 사진 자리에 사진을 먼저 넣어 주세요.');
  const pending = await setMotion(projectId, { ...target, kind, applied, status: 'pending', clipPath: null, notice: null, updatedAt: nowIso() });
  runInBackground('hero motion', () => runHeroMotion(projectId, kind, target, project.productName, applied));
  return { heroMotion: toHeroMotionInfo(pending.heroMotion) };
}

/** POST /projects/{id}/hero-motion/apply — 미리 본 컷을 상세페이지 첫 섹션 위에 넣는다 ({ applied: false }면 뺀다) */
export async function applyHeroMotion(projectId: string, body: { applied?: unknown } = {}) {
  const applied = body.applied !== false;
  const project = await updateProject(projectId, (p) => {
    if (p.heroMotion?.status !== 'ready' || !p.heroMotion.clipPath) throw badRequest('적용할 움직이는 컷이 아직 없어요.');
    return { ...p, heroMotion: { ...p.heroMotion, applied } };
  });
  return { heroMotion: toHeroMotionInfo(project.heroMotion) };
}

/** GET /projects/{id}/hero-motion/stock?q= — 컷 모양(가로)에 맞는 무료 영상 검색 (검색어가 없으면 상품명) */
export async function searchHeroStock(projectId: string, query: string | null) {
  const project = await getProject(projectId);
  const q = (query ?? '').trim().slice(0, 80) || project.productName.trim();
  if (!q) throw badRequest('검색어를 입력해 주세요.');
  return searchStockVideos(q, stockOrientation(HERO_CLIP_SIZE.width, HERO_CLIP_SIZE.height));
}

// ===== 다운로드: 상세페이지 맨 위에 올릴 GIF =====

/** POST /projects/{id}/hero-motion/gif { outWidth } — 클립 → GIF (용량 맞춰 단계적으로 줄임) */
export async function buildHeroGif(projectId: string, body: { outWidth?: unknown }) {
  const { heroMotion } = await getProject(projectId);
  if (heroMotion?.status !== 'ready' || !heroMotion.clipPath) throw badRequest('움직이는 컷이 아직 준비되지 않았어요.');
  const clip = await loadFile(heroMotion.clipPath);
  if (!clip) throw badRequest('움직이는 컷 파일이 없어요. 다시 만들어 주세요.');
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const UPLOAD_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']);

/** POST /projects/{id}/hero-motion/upload (multipart file) — 내 영상을 첨부해 스톡과 같이 고를 수 있게 한다 */
export async function uploadHeroStockVideo(projectId: string, req: Request) {
  await getProject(projectId);
  const file = (await req.formData()).get('file');
  if (!(file instanceof Blob)) throw badRequest('영상 파일을 골라 주세요.');
  const type = (file.type || '').toLowerCase();
  if (type && !UPLOAD_TYPES.has(type) && !type.startsWith('video/')) {
    throw badRequest('mp4·mov·webm 같은 영상 파일만 올릴 수 있어요.');
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, '영상은 100MB까지만 올릴 수 있어요.');
  const data = Buffer.from(await file.arrayBuffer());
  if (data.length < 1024) throw badRequest('파일이 너무 작아요. 영상 파일을 확인해 주세요.');

  const videoId = Date.now();
  const name = typeof (file as File).name === 'string' ? (file as File).name.replace(/\.[^.]+$/, '').slice(0, 40) : '내 영상';

  return withTempDir(async (dir) => {
    const tmp = path.join(dir, 'upload.bin');
    const thumbTmp = path.join(dir, 'thumb.jpg');
    await writeFile(tmp, data);
    const probed = await probeVideo(tmp);
    if (probed.duration < 2) throw badRequest('2초보다 짧은 영상은 쓸 수 없어요.');
    // 중간 지점 썸네일
    const seek = Math.min(Math.max(0.3, probed.duration * 0.2), Math.max(0, probed.duration - 0.2));
    await ffmpeg(['-y', '-ss', String(seek), '-i', tmp, '-frames:v', '1', '-q:v', '5', thumbTmp], 30_000);
    const thumb = await readFile(thumbTmp).catch(() => null);

    await saveFile(uploadVideoPath(projectId, videoId), data);
    const meta = { duration: probed.duration, width: probed.width, height: probed.height, name };
    await saveFile(uploadMetaPath(projectId, videoId), Buffer.from(JSON.stringify(meta), 'utf8'));
    if (thumb) await saveFile(uploadThumbPath(projectId, videoId), thumb);

    return { video: uploadMetaToStock(projectId, videoId, meta) };
  });
}

  const outWidth = Number(body.outWidth);
  if (!Number.isFinite(outWidth) || outWidth < 200 || outWidth > 1600) throw badRequest('GIF 폭이 올바르지 않아요.');

  const gif = await withTempDir(async (dir) => {
    const input = path.join(dir, 'clip.mp4');
    const output = path.join(dir, 'hero.gif');
    await writeFile(input, clip);
    for (const step of GIF_STEPS) {
      await ffmpeg(heroGifArgs(input, output, outWidth, step));
      if ((await stat(output)).size <= GIF_MAX_BYTES || step === GIF_STEPS.at(-1)) break;
    }
    return readFile(output);
  });
  return new Response(new Uint8Array(gif), {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', 'Content-Length': String(gif.length) },
  });
}
