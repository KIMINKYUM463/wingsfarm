/**
 * 크리에이티브 커먼즈(CC) 전용 미디어
 * - YouTube: Data API videoLicense=creativeCommon 만 검색·재검증 후 가져오기
 * - Google: SerpAPI 이미지(상업적 재사용 가능 필터) + 영상 중 유튜브 CC만 가져오기
 * - 표준 유튜브 라이선스·미확인 영상은 절대 받지 않음
 * - 영상에 출처(attribution) 필수
 */
import 'server-only';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  expandStockQuery,
  isUnsafeEnglishFor,
  mentionsWrongFood,
  produceIdentity,
  rejectsProduce,
} from '@/server/lever/media/stockQuery';
import { addProductAssetFromBuffer, type ProductAsset } from '@/server/shortform/productAssets';
import { hasSerpApi } from '@/server/shortform/serpSearch';

export type CcHit = {
  id: string;
  title: string;
  link: string;
  thumbnail?: string;
  channel?: string;
  source: 'youtube_cc' | 'google_cc_image' | 'google_cc_video';
  license: string;
  attribution: string;
  kind: 'video' | 'image';
  /** 유튜브 videoId (영상만) */
  videoId?: string;
  duration?: string;
};

function youtubeKey() {
  return (
    process.env.YOUTUBE_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    ''
  );
}

function serpKey() {
  return process.env.SERPAPI_API_KEY?.trim() || '';
}

export function hasCcSearch() {
  return Boolean(youtubeKey() || serpKey());
}

function buildFarmQuery(productName: string, shot?: string) {
  const shotKo: Record<string, string> = {
    origin: 'farm harvest orchard',
    crave: 'eating tasting food',
    hook: 'cutting fruit knife',
    detail: 'close up fresh produce',
    prep: 'preparing food kitchen',
    pack: 'packing produce box',
    hold: 'hands holding fruit',
    hero: 'market display produce',
    store: 'fridge fresh food',
  };
  // 참외 → oriental melon. 'melon'만 쓰면 외국 캔탈롭이 나온다.
  const ident = produceIdentity(productName);
  const mapped = ident?.queries[0] || expandStockQuery(productName)[0] || productName.trim();
  return [mapped, shot && shot !== 'any' ? shotKo[shot] || '' : 'fresh produce farm', 'food']
    .filter(Boolean)
    .join(' ');
}

function parseIsoDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

type CcCandidate = CcHit & { description?: string; durationSec?: number };

async function enrichYoutubeCc(hits: CcHit[]): Promise<CcCandidate[]> {
  const ids = hits.map((h) => h.videoId).filter(Boolean) as string[];
  if (!ids.length || !youtubeKey()) return hits;
  const data = await ytGet<{
    items?: Array<{
      id?: string;
      snippet?: { title?: string; description?: string; channelTitle?: string };
      contentDetails?: { duration?: string };
      status?: { license?: string };
    }>;
  }>('videos', {
    part: 'snippet,contentDetails,status',
    id: ids.slice(0, 15).join(','),
  });
  const byId = new Map((data.items || []).map((it) => [it.id!, it]));
  return hits.flatMap((h) => {
    if (!h.videoId) return [];
    const it = byId.get(h.videoId);
    if (!it || it.status?.license !== 'creativeCommon') return [];
    return [
      {
        ...h,
        title: String(it.snippet?.title || h.title),
        channel: String(it.snippet?.channelTitle || h.channel),
        description: String(it.snippet?.description || '').slice(0, 400),
        durationSec: parseIsoDuration(String(it.contentDetails?.duration || '')),
        attribution: `${it.snippet?.title || h.title} — ${it.snippet?.channelTitle || h.channel} (YouTube CC BY)`,
      },
    ];
  });
}

/** AI가 대본에 맞는 CC 영상·시작 초를 고른다 */
async function pickCcForScript(opts: {
  script: string;
  shot: string;
  productName: string;
  candidates: CcCandidate[];
  avoidIds: Set<string>;
}): Promise<{ videoId: string; startSec: number; reason: string } | null> {
  const pool = opts.candidates.filter((c) => {
    if (!c.videoId || opts.avoidIds.has(c.videoId)) return false;
    const blob = `${c.title} ${c.description || ''} ${c.channel || ''}`;
    return !mentionsWrongFood(opts.productName, blob);
  });
  if (!pool.length) return null;
  const look = produceIdentity(opts.productName)?.look || '';

  const { openaiClient, OPENAI_MODEL } = await import('@/lib/server/openai');
  const client = openaiClient();
  if (!client) {
    // 키 없으면 제목 키워드 점수
    const words = opts.script.replace(/\*/g, '').split(/\s+/).filter((w) => w.length >= 2);
    let best = pool[0]!;
    let bestScore = -1;
    for (const c of pool) {
      const blob = `${c.title} ${c.description || ''}`.toLowerCase();
      const score = words.reduce((n, w) => n + (blob.includes(w.toLowerCase()) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (bestScore <= 0) return null;
    const dur = best.durationSec || 30;
    const start = Math.min(Math.max(0, Math.floor(dur * 0.15)), Math.max(0, dur - 8));
    return { videoId: best.videoId!, startSec: start, reason: '키워드 매칭' };
  }

  const list = pool.slice(0, 10).map((c, i) => ({
    i,
    id: c.videoId,
    title: c.title,
    channel: c.channel,
    durationSec: c.durationSec || 0,
    description: (c.description || '').slice(0, 180),
  }));
  const prompt = `농수산물 숏폼 한 장면에 넣을 YouTube Creative Commons 클립을 고르세요.
대본(나레이션): "${opts.script.replace(/\*/g, '')}"
장면 유형: ${opts.shot}
상품: ${opts.productName}

후보(반드시 이 중 id만):
${JSON.stringify(list, null, 0)}

규칙:
- 제목의 주인공이 상품 키워드와 같은 품목일 때만 고르세요. ${look ? `생김새: ${look}` : ''}
- 다른 음식(참치, 문어, 새우, 랍스터, 빵, 과자)이면 videoId를 null.
- 그냥 seafood·crab·food처럼 품목 이름이 없으면 videoId를 null.
- 꽃·패션·가방·인테리어는 제외.
- startSec: 그 내용이 나올 법한 시작 초(0 이상, durationSec-5 이하).
- 맞는 영상이 하나도 없으면 videoId를 null. 비슷한 다른 음식으로 채우지 마세요.

JSON만: {"videoId":"..."|null,"startSec":number,"reason":"한 줄"}`;

  try {
    const res = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    const raw = res.choices[0]?.message?.content || '{}';
    const d = JSON.parse(raw) as { videoId?: string | null; startSec?: number; reason?: string };
    if (!d.videoId || !pool.some((p) => p.videoId === d.videoId)) return null;
    const hit = pool.find((p) => p.videoId === d.videoId)!;
    const chosen = `${hit.title} ${hit.description || ''} ${hit.channel || ''}`;
    if (mentionsWrongFood(opts.productName, chosen)) return null;
    const maxStart = Math.max(0, (hit.durationSec || 60) - 6);
    const startSec = Math.max(0, Math.min(maxStart, Number(d.startSec) || 0));
    return { videoId: d.videoId, startSec, reason: String(d.reason || 'AI 선정') };
  } catch {
    return null;
  }
}

/** 대본 맞춤 CC 검색 → AI 선정 → 구간 잘라 로컬 파일로 */
export async function fetchCcClipForShot(opts: {
  productName: string;
  productFolder: string;
  shot: string;
  sceneIndex: number;
  script?: string;
  visual?: string;
  seconds?: number;
  avoidVideoIds?: Set<string>;
  log?: (m: string) => Promise<void> | void;
}): Promise<{ path: string; attribution: string; videoId?: string } | null> {
  if (!youtubeKey() && !serpKey()) return null;
  const script = (opts.script || '').replace(/\*/g, '').trim();
  const avoid = opts.avoidVideoIds || new Set<string>();
  const clipSec = Math.max(3, Math.min(12, opts.seconds || 5));

  try {
    await opts.log?.(
      `CC AI 매칭: 장면${opts.sceneIndex + 1} · “${(script || opts.shot).slice(0, 28)}”`,
    );

    // 대본·visual 기반 검색어. 참외인데 visual이 melon/cantaloupe면 버린다.
    const identQs = produceIdentity(opts.productName)?.queries || [];
    const queries = [
      ...identQs.slice(0, 2),
      (opts.visual || '').trim(),
      buildFarmQuery(opts.productName, opts.shot),
      script ? `${expandStockQuery(script)[0] || ''}` : '',
    ]
      .map((q) => q.trim())
      .filter(
        (q) =>
          q.length >= 4 &&
          !isUnsafeEnglishFor(opts.productName, q) &&
          !rejectsProduce(opts.productName, q),
      );

    const merged: CcHit[] = [];
    const seen = new Set<string>();
    for (const q of [...new Set(queries)].slice(0, 3)) {
      const batches = await Promise.allSettled([
        searchYoutubeCc(q),
        searchGoogleCcVideos(q).catch(() => [] as CcHit[]),
      ]);
      for (const b of batches) {
        if (b.status !== 'fulfilled') continue;
        for (const h of b.value) {
          if (h.kind !== 'video' || !h.videoId || seen.has(h.videoId) || avoid.has(h.videoId)) continue;
          seen.add(h.videoId);
          merged.push(h);
        }
      }
      if (merged.length >= 10) break;
    }

    if (!merged.length) {
      await opts.log?.(`CC 후보 없음 (${opts.shot})`);
      return null;
    }

    const enriched = await enrichYoutubeCc(merged);
    const pick = await pickCcForScript({
      script: script || `${opts.productName} ${opts.shot}`,
      shot: opts.shot,
      productName: opts.productName,
      candidates: enriched.length ? enriched : merged,
      avoidIds: avoid,
    });
    if (!pick) {
      await opts.log?.('CC: 대본과 맞는 영상 없음 → 스톡으로');
      return null;
    }

    await opts.log?.(
      `CC 선정: ${pick.reason} · ${pick.videoId} @${pick.startSec}s (${clipSec}초)`,
    );

    const dir = path.join(process.cwd(), 'shortform', 'products', opts.productFolder, '_clips');
    await mkdir(dir, { recursive: true });
    const out = path.join(
      dir,
      `cc_ai_s${opts.sceneIndex}_${pick.videoId}_${pick.startSec}.mp4`,
    );
    if (existsSync(out)) {
      const meta = await assertYoutubeCc(pick.videoId);
      return {
        path: out,
        attribution: `${meta.title} — ${meta.channel} (YouTube CC BY)`,
        videoId: pick.videoId,
      };
    }

    const cut = await downloadAndCutCc({
      folder: opts.productFolder,
      videoId: pick.videoId,
      startSec: pick.startSec,
      durationSec: clipSec,
      outPath: out,
    });
    if (!cut) return null;
    return { path: cut.path, attribution: cut.attribution, videoId: pick.videoId };
  } catch (err) {
    await opts.log?.(`CC AI 가져오기 실패: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function downloadAndCutCc(opts: {
  folder: string;
  videoId: string;
  startSec: number;
  durationSec: number;
  outPath: string;
}): Promise<{ path: string; attribution: string } | null> {
  const meta = await assertYoutubeCc(opts.videoId);
  const tmpDir = path.join(process.cwd(), 'shortform', 'products', opts.folder, '_cc_tmp');
  await mkdir(tmpDir, { recursive: true });
  const outTpl = path.join(tmpDir, `${opts.videoId}_full.%(ext)s`);

  // 구간만 받으려고 시도 (yt-dlp 신버전). 실패하면 전체 후 자르기
  const end = opts.startSec + opts.durationSec + 1;
  try {
    await run(ytdlpBin(), [
      '-f',
      'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]/b',
      '--merge-output-format',
      'mp4',
      '--download-sections',
      `*${opts.startSec}-${end}`,
      '-o',
      outTpl,
      '--no-playlist',
      '--force-keyframes-at-cuts',
      `https://www.youtube.com/watch?v=${opts.videoId}`,
    ]);
  } catch {
    await run(ytdlpBin(), [
      '-f',
      'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]/b',
      '--merge-output-format',
      'mp4',
      '-o',
      outTpl,
      '--no-playlist',
      `https://www.youtube.com/watch?v=${opts.videoId}`,
    ]);
  }

  const files = await readdir(tmpDir);
  const hit = files
    .filter((f) => f.includes(opts.videoId) && /\.(mp4|mkv|webm)$/i.test(f))
    .sort((a, b) => (a.includes('_full') ? -1 : 1) - (b.includes('_full') ? -1 : 1))[0];
  const src = hit ? path.join(tmpDir, hit) : null;
  if (!src || !existsSync(src)) throw new Error('CC 다운로드 실패 (yt-dlp)');

  await mkdir(path.dirname(opts.outPath), { recursive: true });
  await run(ffmpegBin(), [
    '-y',
    '-ss',
    String(Math.max(0, opts.startSec)),
    '-i',
    src,
    '-t',
    String(opts.durationSec),
    '-vf',
    'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-an',
    opts.outPath,
  ]);

  return {
    path: opts.outPath,
    attribution: `${meta.title} — ${meta.channel} (YouTube CC BY)`,
  };
}

async function ytGet<T>(pathname: string, params: Record<string, string>): Promise<T> {
  const key = youtubeKey();
  if (!key) throw new Error('YOUTUBE_API_KEY 또는 GOOGLE_API_KEY가 필요해요 (YouTube Data API v3)');
  const url = new URL(`https://www.googleapis.com/youtube/v3/${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', key);
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: 'no-store' });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`YouTube API 오류 (${res.status}) ${t.slice(0, 160)}`);
  }
  return (await res.json()) as T;
}

/** YouTube CC BY 영상만 */
export async function searchYoutubeCc(query: string): Promise<CcHit[]> {
  if (!youtubeKey()) return [];
  const data = await ytGet<{
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
      };
    }>;
  }>('search', {
    part: 'snippet',
    type: 'video',
    videoLicense: 'creativeCommon',
    q: query,
    maxResults: '10',
    safeSearch: 'moderate',
    relevanceLanguage: 'ko',
  });

  const hits: CcHit[] = [];
  for (const item of data.items || []) {
    const videoId = item.id?.videoId;
    if (!videoId) continue;
    const title = String(item.snippet?.title || '');
    const channel = String(item.snippet?.channelTitle || 'YouTube');
    const thumb =
      item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.high?.url || undefined;
    hits.push({
      id: `yt_${videoId}`,
      title,
      link: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: thumb,
      channel,
      source: 'youtube_cc',
      license: 'YouTube Creative Commons (CC BY)',
      attribution: `${title} — ${channel} (YouTube CC BY)`,
      kind: 'video',
      videoId,
    });
  }
  return hits;
}

/** videos.list 로 라이선스 재확인 — creativeCommon 만 통과 */
export async function assertYoutubeCc(videoId: string): Promise<{ title: string; channel: string }> {
  const data = await ytGet<{
    items?: Array<{
      status?: { license?: string };
      snippet?: { title?: string; channelTitle?: string };
    }>;
  }>('videos', {
    part: 'status,snippet',
    id: videoId,
  });
  const item = data.items?.[0];
  if (!item) throw new Error('유튜브 영상을 찾지 못했어요');
  if (item.status?.license !== 'creativeCommon') {
    throw new Error('크리에이티브 커먼즈가 아닌 영상이라 가져올 수 없어요');
  }
  return {
    title: String(item.snippet?.title || videoId),
    channel: String(item.snippet?.channelTitle || 'YouTube'),
  };
}

async function serpGet(params: Record<string, string>) {
  const key = serpKey();
  if (!key) throw new Error('SERPAPI_API_KEY가 없어요');
  const url = new URL('https://serpapi.com/search.json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('api_key', key);
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: 'no-store' });
  if (!res.ok) throw new Error(`SerpAPI 오류 (${res.status})`);
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Google 이미지 — 상업적 재사용 가능(sur:fmc) 필터
 * (구글 '사용 권한' ≈ Free to use or share, even commercially)
 */
export async function searchGoogleCcImages(query: string): Promise<CcHit[]> {
  if (!hasSerpApi()) return [];
  const data = await serpGet({
    engine: 'google_images',
    q: `${query} food produce`,
    tbs: 'sur:fmc',
    hl: 'ko',
    gl: 'kr',
  });
  const results = (data.images_results as Array<Record<string, unknown>> | undefined) || [];
  return results.slice(0, 10).flatMap((r, i) => {
    const link = String(r.original || r.link || '');
    const title = String(r.title || 'Google image');
    const source = String(r.source || r.link || 'Google');
    if (!/^https?:\/\//i.test(link)) return [];
    // data URI·추적 링크 제외, 흔한 이미지 확장자·CDN 허용
    return [
      {
        id: `ggi_${i}_${Buffer.from(link).toString('base64url').slice(0, 16)}`,
        title,
        link,
        thumbnail: r.thumbnail ? String(r.thumbnail) : link,
        channel: source,
        source: 'google_cc_image' as const,
        license: 'Google usage rights: free to use/share commercially (verify on source)',
        attribution: `${title} — ${source} (licensed for commercial reuse via Google filter)`,
        kind: 'image' as const,
      },
    ];
  });
}

/** Google 영상 검색 → 유튜브 링크만 골라 Data API로 CC 재검증 */
export async function searchGoogleCcVideos(query: string): Promise<CcHit[]> {
  if (!hasSerpApi()) return [];
  const data = await serpGet({
    engine: 'google_videos',
    q: `${query} Creative Commons`,
    hl: 'ko',
    gl: 'kr',
  });
  const results = (data.video_results as Array<Record<string, unknown>> | undefined) || [];
  const candidates: { videoId: string; title: string; thumb?: string; channel?: string }[] = [];
  for (const r of results.slice(0, 12)) {
    const link = String(r.link || '');
    const m = link.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/);
    if (!m) continue;
    candidates.push({
      videoId: m[1]!,
      title: String(r.title || ''),
      thumb: r.thumbnail ? String(r.thumbnail) : undefined,
      channel: r.source ? String(r.source) : undefined,
    });
  }
  if (!candidates.length || !youtubeKey()) {
    // Data API 없으면 가져오기 불가 — 검색 결과도 CC 미검증이라 비움
    return [];
  }
  const ids = [...new Set(candidates.map((c) => c.videoId))].slice(0, 10).join(',');
  const verified = await ytGet<{
    items?: Array<{
      id?: string;
      status?: { license?: string };
      snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } };
    }>;
  }>('videos', { part: 'status,snippet', id: ids });

  const hits: CcHit[] = [];
  for (const item of verified.items || []) {
    if (item.status?.license !== 'creativeCommon' || !item.id) continue;
    const title = String(item.snippet?.title || item.id);
    const channel = String(item.snippet?.channelTitle || 'YouTube');
    hits.push({
      id: `gyt_${item.id}`,
      title,
      link: `https://www.youtube.com/watch?v=${item.id}`,
      thumbnail: item.snippet?.thumbnails?.medium?.url,
      channel,
      source: 'google_cc_video',
      license: 'YouTube Creative Commons (CC BY) · found via Google',
      attribution: `${title} — ${channel} (YouTube CC BY)`,
      kind: 'video',
      videoId: item.id,
    });
  }
  return hits;
}

export async function searchCcMedia(opts: {
  productName: string;
  shot?: string;
}): Promise<{ query: string; hits: CcHit[]; notice: string; providers: string[] }> {
  const query = buildFarmQuery(opts.productName, opts.shot);
  if (!query.trim()) throw new Error('상품명을 넣어 주세요');
  if (!hasCcSearch()) {
    throw new Error('YOUTUBE_API_KEY(또는 GOOGLE_API_KEY)나 SERPAPI_API_KEY가 필요해요');
  }

  const providers: string[] = [];
  const settled = await Promise.allSettled([
    searchYoutubeCc(query).then((h) => {
      if (h.length) providers.push('YouTube CC');
      return h;
    }),
    searchGoogleCcVideos(query).then((h) => {
      if (h.length) providers.push('Google→YouTube CC');
      return h;
    }),
    searchGoogleCcImages(query).then((h) => {
      if (h.length) providers.push('Google 상업적 재사용 이미지');
      return h;
    }),
  ]);

  const hits: CcHit[] = [];
  const seen = new Set<string>();
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const h of s.value) {
      const key = h.videoId || h.link;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(h);
    }
  }

  const errors = settled
    .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
    .map((s) => (s.reason instanceof Error ? s.reason.message : String(s.reason)));

  if (!hits.length && errors.length) throw new Error(errors[0]!);

  return {
    query,
    hits: hits.slice(0, 18),
    providers,
    notice:
      '크리에이티브 커먼즈·상업적 재사용 가능으로 걸린 결과만 보여 요. 장면에 넣으면 출처가 영상에 표시됩니다. CC BY-NC 등 세부 조건은 원문 페이지도 확인하세요.',
  };
}

function ytdlpBin() {
  return process.platform === 'win32' ? 'yt-dlp' : 'yt-dlp';
}

function ffmpegBin() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('ffmpeg-static') as string;
  } catch {
    return 'ffmpeg';
  }
}

function run(cmd: string, args: string[], cwd?: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, windowsHide: true, env: process.env });
    let err = '';
    child.stderr.on('data', (b: Buffer) => {
      err += b.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.trim().slice(-400) || `${cmd} 실패 (${code})`));
    });
  });
}

/** CC 유튜브 영상 → 상품 업로드 자산으로 (최대 12초) */
export async function importYoutubeCcToProduct(opts: {
  folder: string;
  videoId: string;
  shot?: string;
}): Promise<ProductAsset> {
  const meta = await assertYoutubeCc(opts.videoId);
  const tmpDir = path.join(process.cwd(), 'shortform', 'products', opts.folder, '_cc_tmp');
  await mkdir(tmpDir, { recursive: true });
  const outMp4 = path.join(tmpDir, `${opts.videoId}_clip.mp4`);
  const outTpl = path.join(tmpDir, `${opts.videoId}_raw.%(ext)s`);
  await run(ytdlpBin(), [
    '-f',
    'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]/b',
    '--merge-output-format',
    'mp4',
    '-o',
    outTpl,
    '--no-playlist',
    `https://www.youtube.com/watch?v=${opts.videoId}`,
  ]);

  const files = await readdir(tmpDir);
  const hit = files.find((f) => f.startsWith(`${opts.videoId}_raw`) && /\.(mp4|mkv|webm)$/i.test(f));
  const src = hit ? path.join(tmpDir, hit) : null;
  if (!src || !existsSync(src)) throw new Error('CC 영상을 내려받지 못했어요 (yt-dlp 확인)');

  // 앞 12초만 — 숏폼 장면용
  await run(ffmpegBin(), [
    '-y',
    '-i',
    src,
    '-t',
    '12',
    '-vf',
    'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-an',
    outMp4,
  ]);

  const buf = await readFile(outMp4);
  const attribution = `${meta.title} — ${meta.channel} (YouTube CC BY)`;
  return addProductAssetFromBuffer({
    folder: opts.folder,
    buf,
    ext: '.mp4',
    kind: 'video',
    name: meta.title.slice(0, 40),
    shot: opts.shot || 'any',
    license: 'youtube-cc-by',
    attribution,
    sourceUrl: `https://www.youtube.com/watch?v=${opts.videoId}`,
  });
}

/** Google 상업적 재사용 이미지 → 상품 자산 */
export async function importGoogleCcImageToProduct(opts: {
  folder: string;
  imageUrl: string;
  title: string;
  attribution: string;
  shot?: string;
}): Promise<ProductAsset> {
  const res = await fetch(opts.imageUrl, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'WingsFarmShortform/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('이미지를 받지 못했어요');
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (!ctype.includes('image') && !/\.(jpe?g|png|webp)(\?|$)/i.test(opts.imageUrl)) {
    throw new Error('이미지 파일이 아니에요');
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) throw new Error('이미지가 너무 커요');
  const ext = ctype.includes('png') ? '.png' : ctype.includes('webp') ? '.webp' : '.jpg';
  return addProductAssetFromBuffer({
    folder: opts.folder,
    buf,
    ext,
    kind: 'image',
    name: opts.title.slice(0, 40) || 'CC image',
    shot: opts.shot || 'any',
    license: 'google-usage-commercial',
    attribution: opts.attribution,
    sourceUrl: opts.imageUrl,
  });
}

export async function importCcHitToProduct(opts: {
  folder: string;
  hit: CcHit;
  shot?: string;
}): Promise<ProductAsset> {
  if (opts.hit.kind === 'video' && opts.hit.videoId) {
    return importYoutubeCcToProduct({
      folder: opts.folder,
      videoId: opts.hit.videoId,
      shot: opts.shot,
    });
  }
  if (opts.hit.kind === 'image') {
    return importGoogleCcImageToProduct({
      folder: opts.folder,
      imageUrl: opts.hit.link,
      title: opts.hit.title,
      attribution: opts.hit.attribution,
      shot: opts.shot,
    });
  }
  throw new Error('이 결과는 장면에 넣을 수 없어요');
}
