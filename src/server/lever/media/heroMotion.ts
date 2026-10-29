import 'server-only';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { HeroMotionKind } from '@/shared/types/heroMotion';
import { findAssetRecord } from '../assets';
import { asNode, isImageSlot, walk } from '../frames/tree';
import { requireGemini } from '../gemini';
import { ApiError, badRequest } from '../http';
import { getProject, isMotionRunning, sortFrames, toHeroMotionInfo, updateProject, type HeroMotionRecord, type ProjectRecord } from '../projects';
import { loadFile, mimeFromPath, saveFile } from '../storage';
import { nowIso } from '../store';
import { ffmpeg, withTempDir } from './ffmpeg';
import { GIF_MAX_BYTES, GIF_STEPS, heroGifArgs, panClipArgs, VIDEO_PROMPT_RULES, videoAspect, videoClipArgs } from './motion';

type Target = Pick<HeroMotionRecord, 'frameId' | 'elementId' | 'assetId' | 'width' | 'height'>;

/** 페이지 맨 위 사진 자리 (첫 사진 자리가 비어 있으면 만들 수 없다) */
function findHeroTarget(project: ProjectRecord): Target | null {
  for (const frame of sortFrames(project.frames)) {
    if (frame.status !== 'active') continue;
    const slot = [...walk(asNode(frame.frameData))].find(isImageSlot);
    if (!slot) continue;
    if (!slot.assetId) return null;
    return { frameId: frame.id, elementId: slot.id, assetId: slot.assetId, width: Number(slot.width), height: Number(slot.height) };
  }
  return null;
}

const setMotion = (projectId: string, motion: HeroMotionRecord) => updateProject(projectId, (p) => ({ ...p, heroMotion: motion }));

async function makeClip(kind: HeroMotionKind, source: { data: Buffer; mimeType: string }, target: Target, productName: string) {
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

async function runHeroMotion(projectId: string, kind: HeroMotionKind, target: Target, productName: string) {
  const base = { ...target, kind, clipPath: null, notice: null };
  try {
    const asset = await findAssetRecord(target.assetId);
    const data = asset && (await loadFile(asset.path));
    if (!asset || !data) throw new ApiError(404, '맨 위 사진을 찾을 수 없어요.');
    const source = { data, mimeType: asset.contentType || mimeFromPath(asset.path) };

    let usedKind = kind;
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

/** 작업을 걸어 두고 바로 돌아온다 (AI 영상은 1~3분) — 화면은 프로젝트 조회로 상태를 확인 */
export async function startHeroMotion(projectId: string, kind: HeroMotionKind) {
  const project = await getProject(projectId);
  if (isMotionRunning(project.heroMotion)) throw badRequest('움직이는 컷을 만들고 있어요. 잠시만 기다려 주세요.');
  const target = findHeroTarget(project);
  if (!target) throw badRequest('맨 위 사진 자리에 사진을 먼저 넣어 주세요.');
  if (kind === 'video') await requireGemini();
  const pending = await setMotion(projectId, { ...target, kind, status: 'pending', clipPath: null, notice: null, updatedAt: nowIso() });
  void runHeroMotion(projectId, kind, target, project.productName);
  return { heroMotion: toHeroMotionInfo(pending.heroMotion) };
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
