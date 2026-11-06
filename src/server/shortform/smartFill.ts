/**
 * 똑똑하게 채우기 — 장면마다
 * 0) 셀러가 올린 내 영상/사진 (shot 태그 우선)
 * 1) 레퍼런스 장면 유형 + 상품으로 비슷한 무료 스톡 영상 (Pexels/Pixabay)
 * 2) 스톡 사진
 * 3) Replicate AI 장면
 * 4) null → 호출측이 상품 사진 사용
 *
 * ※ 유튜브/인스타 원본을 긁어오지 않는다. 레퍼런스의 shot·목적·제목을 검색어로만 쓴다.
 */
import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  estimateSceneSeconds,
  generateAiSceneVisual,
  hasAiSceneProvider,
} from '@/server/shortform/aiScene';
import {
  downloadStockFile,
  getStockClipSource,
  searchStockPhotos,
  searchStockVideos,
} from '@/server/lever/media/stock';
import {
  expandStockQuery,
  farmShotQueries,
  isAmbiguousStockTerm,
  isUnsafeEnglishFor,
  looksIrrelevantStock,
  mentionsWrongFood,
  produceIdentity,
  rejectsProduce,
} from '@/server/lever/media/stockQuery';
import { relevantClipIds } from '@/server/shortform/clipRelevance';
import { fetchCcClipForShot } from '@/server/shortform/ccMedia';
import {
  listProductAssets,
  materializeProductAsset,
  pickUploadForShot,
} from '@/server/shortform/productAssets';
import { hashSeed, pickIndex } from '@/server/shortform/variety';
import type { StockSource } from '@/shared/types/heroMotion';

export type RefSceneContext = {
  title?: string;
  purpose?: string;
  text?: string;
  /** 이번 장면 대본(나레이션) — 영상이 말과 맞도록 검색에 넣는다 */
  script?: string;
  shot?: string;
  /** 레퍼런스 메타·대본에서 뽑은 검색 보조 단어 */
  keywords?: string[];
};

export type SmartResolveOpts = {
  sceneIndex?: number;
  avoidPaths?: Set<string>;
  /** 장면 길이(초) — CC 컷 길이에 맞춤 */
  seconds?: number;
};

function clipDir(productFolder: string) {
  return path.join(process.cwd(), 'shortform', 'products', productFolder, '_clips');
}

function unique(list: string[]) {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))];
}

/**
 * 농수산물 숏폼용 스톡 검색어.
 * - orange 단독처럼 꽃·패션이 나오는 검색은 쓰지 않는다.
 * - 산지/시식/손질 등 장면 유형 + 식품 영어명을 붙인다.
 */
export function buildSmartQueries(
  product: Record<string, unknown>,
  shot: string,
  seed: number,
  ref?: RefSceneContext | null,
): string[] {
  const koName = String(product.name || '');
  const enRaw = String(product.en_name || '');
  const ident = produceIdentity(koName);
  // 한글 품목 정체성을 우선. 참외인데 en_name이 melon이면 외국 멜론이 나온다.
  const productQs = unique([
    ...(ident?.queries || []),
    ...expandStockQuery(koName),
    ...(enRaw && !isAmbiguousStockTerm(enRaw) && !isUnsafeEnglishFor(koName, enRaw) ? expandStockQuery(enRaw) : []),
  ]);
  const primary = productQs[0] || 'fresh farm produce fruit';
  const out: string[] = [];

  const category = String(product.category || '');
  // 1) 장면 유형별 농식품 쿼리 (가장 중요)
  const farm = farmShotQueries(primary, shot, category);
  out.push(...farm);
  for (const pq of productQs.slice(1, 3)) {
    out.push(...farmShotQueries(pq, shot, category).slice(0, 2));
  }

  // 2) 대본·visual 힌트로 영상 검색 (말이 산지면 orchard, 먹으면 eating)
  if (ref?.keywords?.length) {
    const visualEn = ref.keywords.filter((k) => /^[a-zA-Z]/.test(k)).slice(0, 6).join(' ');
    if (
      visualEn.split(/\s+/).length >= 2 &&
      !isUnsafeEnglishFor(koName, visualEn) &&
      !rejectsProduce(koName, visualEn)
    ) {
      out.unshift(visualEn);
    }
  }
  if (ref?.script) {
    const scriptHits = expandStockQuery(ref.script);
    // 한글만 있으면 일반어, 참외인데 melon이면 버림
    if (
      scriptHits[0] &&
      !scriptHits[0].includes('Korean farm produce') &&
      !isUnsafeEnglishFor(koName, scriptHits[0]) &&
      !rejectsProduce(koName, scriptHits[0])
    ) {
      out.unshift(`${scriptHits[0]} ${shot === 'crave' ? 'eating' : shot === 'origin' ? 'farm' : 'fruit'}`);
    }
  }
  if (ref?.keywords?.length) {
    for (const kw of ref.keywords.slice(0, 4)) {
      if (kw.length < 2 || /^(신선|과일|보세요|바로|보내|산지에서)$/.test(kw)) continue;
      const eng = expandStockQuery(kw);
      if (eng[0] && !eng[0].includes('Korean farm produce')) {
        out.push(farmShotQueries(eng[0], shot, category)[0]!);
      }
    }
  }

  // 시드로 순서만 살짝 섞되, 식품 쿼리 유지
  const list = unique(out).slice(0, 10);
  if (list.length < 2) return list;
  const rot = pickIndex(seed, list.length, shot.length);
  return [...list.slice(rot), ...list.slice(0, rot)];
}

function asExternal(source: StockSource): 'pexels' | 'pixabay' {
  return source === 'pixabay' ? 'pixabay' : 'pexels';
}

async function tryStockVideo(
  product: Record<string, unknown>,
  productFolder: string,
  shot: string,
  seed: number,
  ref: RefSceneContext | null | undefined,
  sceneIndex: number,
  avoidPaths: Set<string> | undefined,
  log?: (m: string) => Promise<void> | void,
): Promise<{ path: string; attribution: string } | null> {
  if (!process.env.PEXELS_API_KEY && !process.env.PIXABAY_API_KEY) {
    await log?.('스톡 키(PEXELS/PIXABAY)가 없어 스톡 영상을 건너뛰어요');
    return null;
  }
  const dir = clipDir(productFolder);
  await mkdir(dir, { recursive: true });
  // 장면마다 다른 파일 — 같은 shot이라도 연속 장면에서 동일 영상이 반복되지 않게
  const variant = pickIndex(seed, 5, shot.charCodeAt(0) + sceneIndex * 13);
  // v2: 식품·산지 전용 검색어로 바꾼 뒤 캐시 버전 (옛 orange=꽃 캐시 방지)
  const out = path.join(dir, `smart_stock_v4_${shot}_s${sceneIndex}_v${variant}.mp4`);
  if (existsSync(out) && !avoidPaths?.has(out)) {
    await log?.(`스톡 영상 캐시: ${shot} 장면${sceneIndex + 1}`);
    return { path: out, attribution: `Stock video (cached) · ${shot}` };
  }

  const queries = buildSmartQueries(product, shot, seed + sceneIndex, ref);
  await log?.(`스톡 영상 검색(${shot}/장면${sceneIndex + 1}): ${queries.slice(0, 3).join(' · ')}`);

  for (let qi = 0; qi < queries.length; qi++) {
    const q = queries[qi]!;
    try {
      const { videos } = await searchStockVideos(q, 'portrait');
      if (!videos.length) continue;
      const portrait = videos.filter((v) => v.duration >= 3 && v.height >= v.width);
      const pool = portrait.length ? portrait : videos;
      const ordered = [...pool].sort(
        (a, b) => pickIndex(seed, 997, a.id + sceneIndex) - pickIndex(seed, 997, b.id + sceneIndex),
      );
      const productName = String(product.name || '');
      const pending = ordered.filter((pick) => {
        const blob = `${pick.author || ''} ${pick.pageUrl || ''} ${pick.thumbnail || ''}`;
        return !looksIrrelevantStock(pick) && !mentionsWrongFood(productName, blob);
      }).slice(0, 8);
      const keep = await relevantClipIds(
        productName,
        ref?.script || ref?.purpose || '',
        pending.map((pick) => ({
          id: String(pick.id),
          text: `${pick.pageUrl || ''} ${pick.author || ''}`,
        })),
        log,
      );
      for (const pick of pending) {
        if (!keep.has(String(pick.id))) continue;
        const tag = `${pick.source}-${pick.id}`;
        const tagPath = path.join(dir, `smart_stock_id_${pick.source}_${pick.id}.mp4`);
        if (avoidPaths?.has(tagPath) || avoidPaths?.has(tag)) continue;
        const source = asExternal(pick.source);
        const src = await getStockClipSource(source, pick.id);
        const file =
          src.files.find((f) => f.height >= f.width && f.height >= 720) ||
          src.files.find((f) => f.link?.startsWith('http')) ||
          src.files[0];
        if (!file?.link?.startsWith('http')) continue;
        const buf = await downloadStockFile(source, file.link);
        await writeFile(out, buf);
        // id 태그 파일도 만들어 다음 장면에서 같은 클립 재사용 방지 표시
        if (!existsSync(tagPath)) await writeFile(tagPath, buf).catch(() => null);
        avoidPaths?.add(out);
        avoidPaths?.add(tagPath);
        avoidPaths?.add(tag);
        const credit = `Video by ${src.credit.author} on ${source}${pick.pageUrl ? ` — ${pick.pageUrl}` : ''}`;
        await log?.(`스톡 영상 채택: ${shot} 장면${sceneIndex + 1} · "${q}" · ${src.credit.author}`);
        return { path: out, attribution: credit };
      }
    } catch (err) {
      await log?.(`스톡 검색 실패(${q}): ${err instanceof Error ? err.message : err}`);
    }
  }
  await log?.(`스톡 영상 없음 → 다음 단계(${shot})`);
  return null;
}

async function tryStockPhoto(
  product: Record<string, unknown>,
  productFolder: string,
  shot: string,
  seed: number,
  ref: RefSceneContext | null | undefined,
  sceneIndex: number,
  avoidPaths: Set<string> | undefined,
  log?: (m: string) => Promise<void> | void,
): Promise<{ path: string; attribution: string } | null> {
  const dir = clipDir(productFolder);
  await mkdir(dir, { recursive: true });
  const variant = pickIndex(seed, 4, shot.length + 3 + sceneIndex);
  const out = path.join(dir, `smart_photo_v4_${shot}_s${sceneIndex}_v${variant}.jpg`);
  if (existsSync(out) && !avoidPaths?.has(out)) {
    await log?.(`스톡 사진 캐시: ${shot} 장면${sceneIndex + 1}`);
    return { path: out, attribution: `Stock photo (cached) · ${shot}` };
  }
  const queries = buildSmartQueries(product, shot, seed + sceneIndex, ref);
  for (const q of queries.slice(0, 4)) {
    try {
      const photos = await searchStockPhotos(q);
      if (!photos.length) continue;
      const productName = String(product.name || '');
      const pending = photos.filter((photo) => {
        const photoBlob = `${photo.credit?.author || ''} ${photo.credit?.url || ''} ${photo.url || ''}`;
        return photo.url && !mentionsWrongFood(productName, photoBlob);
      }).slice(0, 8);
      const keep = await relevantClipIds(
        productName,
        ref?.script || '',
        pending.map((photo) => ({ id: String(photo.id), text: `${photo.url || ''} ${photo.credit?.url || ''}` })),
        log,
      );
      for (const photo of pending) {
        if (!keep.has(String(photo.id))) continue;
        const tag = `photo-${photo.source}-${photo.id}`;
        if (!photo?.url || avoidPaths?.has(tag)) continue;
        const res = await fetch(photo.url, { signal: AbortSignal.timeout(60_000) });
        if (!res.ok) continue;
        await writeFile(out, Buffer.from(await res.arrayBuffer()));
        avoidPaths?.add(out);
        avoidPaths?.add(tag);
        const credit = `Photo by ${photo.credit.author} on ${photo.source} — ${photo.credit.url || photo.source}`;
        await log?.(`스톡 사진 채택: ${shot} 장면${sceneIndex + 1} · "${q}" · ${photo.credit.author}`);
        return { path: out, attribution: credit };
      }
    } catch (err) {
      await log?.(`스톡 사진 실패(${q}): ${err instanceof Error ? err.message : err}`);
    }
  }
  return null;
}

export type SmartVisual =
  | { kind: 'video'; path: string; label: string; usedAi: boolean; attribution?: string }
  | { kind: 'image'; path: string; label: string; usedAi: boolean; attribution?: string };

async function tryUserUpload(
  productFolder: string,
  shot: string,
  explicitId: string | null,
  avoidPaths: Set<string> | undefined,
  log?: (m: string) => Promise<void> | void,
): Promise<SmartVisual | null> {
  const assets = await listProductAssets(productFolder);
  if (!assets.length) return null;
  const avoidIds = new Set(
    [...(avoidPaths || [])]
      .map((p) => {
        const m = String(p).match(/upload[_:]([a-z0-9-]+)/i);
        return m?.[1];
      })
      .filter(Boolean) as string[],
  );
  const pick = explicitId
    ? assets.find((a) => a.id === explicitId) || null
    : pickUploadForShot(assets, shot, avoidIds);
  if (!pick) return null;
  const dir = clipDir(productFolder);
  const mat = await materializeProductAsset(productFolder, pick.id, dir);
  if (!mat) return null;
  avoidPaths?.add(mat.path);
  avoidPaths?.add(`upload:${pick.id}`);
  await log?.(
    `내 업로드 사용: ${pick.name} (${pick.kind}${pick.shot && pick.shot !== 'any' ? ` · ${pick.shot}` : ''})`,
  );
  return {
    kind: pick.kind === 'video' ? 'video' : 'image',
    path: mat.path,
    label: mat.attribution ? `CC:${pick.name}` : `내영상:${pick.name}`,
    usedAi: false,
    attribution: mat.attribution || pick.attribution,
  };
}

/** 장면 source(ai:hook 등)에 맞는 비주얼. 실패 시 null → 상품 사진. */
export async function resolveSmartVisual(
  source: string,
  product: Record<string, unknown>,
  productFolder: string,
  photoBuf: Buffer,
  log?: (m: string) => Promise<void> | void,
  seedKey?: string,
  ref?: RefSceneContext | null,
  opts?: SmartResolveOpts,
): Promise<SmartVisual | null> {
  const shotRaw = source.includes(':') ? source.split(':')[1]! : source || 'hero';
  const explicitUpload = source.startsWith('upload:') ? shotRaw : null;
  const shot = explicitUpload ? ref?.shot || 'hero' : shotRaw;
  const sceneIndex = opts?.sceneIndex ?? 0;
  const seed = hashSeed(`${seedKey || productFolder}:${shot}:${sceneIndex}:${ref?.script || ref?.purpose || ''}`);

  if (source.startsWith('photo:')) return null;

  // 0) 내 업로드 — 명시적 id 또는 장면 shot 태그 매칭
  const uploaded = await tryUserUpload(
    productFolder,
    shot,
    explicitUpload,
    opts?.avoidPaths,
    log,
  );
  if (uploaded) return uploaded;
  if (explicitUpload) {
    await log?.(`지정한 업로드(${explicitUpload})를 찾지 못했어요`);
    return null;
  }

  // 0.5) CC: AI가 대본에 맞는 유튜브/구글 CC를 골라 구간 절단 (수동 선택 아님)
  if (process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || process.env.SERPAPI_API_KEY) {
    const avoidIds = new Set(
      [...(opts?.avoidPaths || [])]
        .map((p) => {
          const m = String(p).match(/cc_ai_s\d+_([\w-]{11})_/);
          return m?.[1];
        })
        .filter(Boolean) as string[],
    );
    const visualEn = (ref?.keywords || []).filter((k) => /^[a-zA-Z]/.test(k)).join(' ');
    const cc = await fetchCcClipForShot({
      productName: String(product.name || productFolder),
      productFolder,
      shot,
      sceneIndex,
      script: ref?.script || ref?.purpose || '',
      visual: visualEn || undefined,
      seconds: opts?.seconds || 5,
      avoidVideoIds: avoidIds,
      log,
    });
    if (cc) {
      opts?.avoidPaths?.add(cc.path);
      if (cc.videoId) opts?.avoidPaths?.add(`yt:${cc.videoId}`);
      return {
        kind: 'video',
        path: cc.path,
        label: `CC·AI:${shot}`,
        usedAi: false,
        attribution: cc.attribution,
      };
    }
  }

  const stockVid = await tryStockVideo(
    product,
    productFolder,
    shot,
    seed,
    ref,
    sceneIndex,
    opts?.avoidPaths,
    log,
  );
  if (stockVid) {
    return {
      kind: 'video',
      path: stockVid.path,
      label: `스톡영상:${shot}`,
      usedAi: false,
      attribution: stockVid.attribution,
    };
  }

  const stockPic = await tryStockPhoto(
    product,
    productFolder,
    shot,
    seed,
    ref,
    sceneIndex,
    opts?.avoidPaths,
    log,
  );
  if (stockPic) {
    return {
      kind: 'image',
      path: stockPic.path,
      label: `스톡사진:${shot}`,
      usedAi: false,
      attribution: stockPic.attribution,
    };
  }

  // 영상(CC·스톡) 없음 → AI 이미지 생성 → 대본 예상 초로 영상화 (실패 시 이미지 패닝)
  if (hasAiSceneProvider() && !source.startsWith('photo:') && !source.startsWith('upload:')) {
    const aiShot = shot === 'origin' && !source.startsWith('ai:') ? 'origin' : shot;
    const aiSource = `ai:${aiShot}`;
    const script = ref?.script || ref?.purpose || '';
    const seconds = opts?.seconds || estimateSceneSeconds(script, 4);
    const visualEn = (ref?.keywords || []).filter((k) => /^[a-zA-Z]/.test(k)).join(' ');
    await log?.(
      `키워드에 맞는 영상 없음 → 상품 사진으로 AI 이미지를 만들고 ~${seconds.toFixed(1)}초 영상으로 (장면${sceneIndex + 1})`,
    );
    const ai = await generateAiSceneVisual(aiSource, product, productFolder, photoBuf, log, {
      script,
      seconds,
      sceneIndex,
      visual: visualEn || undefined,
    });
    if (ai?.kind === 'video') {
      opts?.avoidPaths?.add(ai.path);
      return {
        kind: 'video',
        path: ai.path,
        label: `AI영상:${shot}`,
        usedAi: true,
        attribution: `AI 생성 영상 · 대본 맞춤 (~${ai.seconds}s)`,
      };
    }
    if (ai?.kind === 'image') {
      opts?.avoidPaths?.add(ai.path);
      return {
        kind: 'image',
        path: ai.path,
        label: `AI사진:${shot}`,
        usedAi: true,
        attribution: `AI 생성 이미지 · ${ai.seconds}초 패닝`,
      };
    }
  }

  return null;
}
