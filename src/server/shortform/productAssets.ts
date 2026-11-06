/**
 * 셀러가 직접 올린 영상·사진 — 스톡/AI보다 우선해 장면에 쓴다.
 * (유튜브·인스타 등 플랫폼 스크래핑이 아니라, 사용자가 권한 있는 파일을 올리는 경로)
 */
import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { listFiles, readBinary, readJson, writeJson } from '@/server/lever/store';
import { publicUrl, saveFile } from '@/server/lever/storage';

export type ProductAssetKind = 'video' | 'image';

export type ProductAsset = {
  id: string;
  name: string;
  kind: ProductAssetKind;
  /** 장면 유형 태그 — hook/origin/crave 등 (비우면 any) */
  shot: string;
  ext: string;
  created: string;
  url: string;
  /** CC 등 라이선스 코드 */
  license?: string;
  /** 영상에 넣을 출처 문구 (CC BY 필수) */
  attribution?: string;
  sourceUrl?: string;
};

const SHOTS = new Set([
  'any',
  'hook',
  'detail',
  'crave',
  'hero',
  'hold',
  'pack',
  'store',
  'prep',
  'origin',
  'photo',
]);

function safeFolder(folder: string) {
  const cleaned = folder.replace(/[\\/:*?"<>|]+/g, '').trim();
  if (!cleaned) throw new Error('상품을 먼저 저장해 주세요');
  return cleaned;
}

function assetsMetaPath(folder: string) {
  return `files/shortform/products/${safeFolder(folder)}/assets.json`;
}

function assetFilePath(folder: string, id: string, ext: string) {
  return `shortform/products/${safeFolder(folder)}/uploads/${id}${ext}`;
}

function diskUploadsDir(folder: string) {
  return path.join(process.cwd(), 'shortform', 'products', safeFolder(folder), '_uploads');
}

async function readMeta(folder: string): Promise<Omit<ProductAsset, 'url'>[]> {
  return (await readJson<Omit<ProductAsset, 'url'>[]>(assetsMetaPath(folder), [])) || [];
}

async function writeMeta(folder: string, list: Omit<ProductAsset, 'url'>[]) {
  await writeJson(assetsMetaPath(folder), list);
}

function withUrl(folder: string, item: Omit<ProductAsset, 'url'>): ProductAsset {
  return {
    ...item,
    url: publicUrl(assetFilePath(folder, item.id, item.ext)),
  };
}

export async function listProductAssets(folder: string): Promise<ProductAsset[]> {
  const f = safeFolder(folder);
  const list = await readMeta(f);
  return list.map((a) => withUrl(f, a));
}

function parseDataUrl(dataUrl: string): { mime: string; buf: Buffer } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
  if (!m) throw new Error('파일을 읽지 못했어요. 다시 올려 주세요');
  return { mime: m[1]!.toLowerCase(), buf: Buffer.from(m[2]!, 'base64') };
}

function kindFromMime(mime: string): { kind: ProductAssetKind; ext: string } | null {
  if (mime.startsWith('video/mp4') || mime === 'video/quicktime') {
    return { kind: 'video', ext: mime.includes('quicktime') ? '.mov' : '.mp4' };
  }
  if (mime === 'video/webm') return { kind: 'video', ext: '.webm' };
  if (mime === 'image/jpeg' || mime === 'image/jpg') return { kind: 'image', ext: '.jpg' };
  if (mime === 'image/png') return { kind: 'image', ext: '.png' };
  if (mime === 'image/webp') return { kind: 'image', ext: '.webp' };
  return null;
}

const MAX_BYTES = 40 * 1024 * 1024; // 40MB

export async function addProductAsset(opts: {
  folder: string;
  dataUrl: string;
  name?: string;
  shot?: string;
}): Promise<ProductAsset> {
  const folder = safeFolder(opts.folder);
  const { mime, buf } = parseDataUrl(opts.dataUrl);
  if (buf.length > MAX_BYTES) throw new Error('파일이 너무 커요. 40MB 이하로 올려 주세요');
  const typed = kindFromMime(mime);
  if (!typed) throw new Error('mp4·mov·webm 영상 또는 jpg·png·webp 사진만 올릴 수 있어요');

  const shotRaw = String(opts.shot || 'any').toLowerCase().trim();
  const shot = SHOTS.has(shotRaw) ? shotRaw : 'any';
  const id = randomUUID().slice(0, 12);
  const name = String(opts.name || `내 ${typed.kind === 'video' ? '영상' : '사진'}`).slice(0, 60);

  await saveFile(assetFilePath(folder, id, typed.ext), buf);

  // 로컬 렌더(ffmpeg)용 디스크 미러
  try {
    const dir = diskUploadsDir(folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${id}${typed.ext}`), buf);
  } catch {
    /* Vercel 등 읽기전용은 무시 — materialize 때 스토어에서 복원 */
  }

  const item: Omit<ProductAsset, 'url'> = {
    id,
    name,
    kind: typed.kind,
    shot,
    ext: typed.ext,
    created: new Date().toISOString(),
  };
  const list = await readMeta(folder);
  list.unshift(item);
  await writeMeta(folder, list.slice(0, 40));
  return withUrl(folder, item);
}

/** 버퍼로 자산 추가 (CC 가져오기 등) */
export async function addProductAssetFromBuffer(opts: {
  folder: string;
  buf: Buffer;
  ext: string;
  kind: ProductAssetKind;
  name: string;
  shot?: string;
  license?: string;
  attribution?: string;
  sourceUrl?: string;
}): Promise<ProductAsset> {
  const folder = safeFolder(opts.folder);
  if (opts.buf.length > MAX_BYTES) throw new Error('파일이 너무 커요. 40MB 이하로 올려 주세요');
  const shotRaw = String(opts.shot || 'any').toLowerCase().trim();
  const shot = SHOTS.has(shotRaw) ? shotRaw : 'any';
  const id = randomUUID().slice(0, 12);
  const ext = opts.ext.startsWith('.') ? opts.ext : `.${opts.ext}`;

  await saveFile(assetFilePath(folder, id, ext), opts.buf);
  try {
    const dir = diskUploadsDir(folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${id}${ext}`), opts.buf);
  } catch {
    /* ignore */
  }

  const item: Omit<ProductAsset, 'url'> = {
    id,
    name: String(opts.name || 'asset').slice(0, 60),
    kind: opts.kind,
    shot,
    ext,
    created: new Date().toISOString(),
    license: opts.license,
    attribution: opts.attribution,
    sourceUrl: opts.sourceUrl,
  };
  const list = await readMeta(folder);
  list.unshift(item);
  await writeMeta(folder, list.slice(0, 40));
  return withUrl(folder, item);
}

export async function removeProductAsset(folder: string, id: string): Promise<void> {
  const f = safeFolder(folder);
  const list = await readMeta(f);
  const hit = list.find((a) => a.id === id);
  if (!hit) throw new Error('없는 파일이에요');
  const next = list.filter((a) => a.id !== id);
  await writeMeta(f, next);
  // 스토어 파일은 남겨도 되지만 list에서 빠지면 안 씀. 용량 위해 삭제는 skip(안전).
}

/** 렌더 중 ffmpeg가 읽을 수 있게 로컬 경로로 꺼낸다 */
export async function materializeProductAsset(
  folder: string,
  id: string,
  destDir: string,
): Promise<{
  path: string;
  kind: ProductAssetKind;
  shot: string;
  name: string;
  attribution?: string;
  license?: string;
} | null> {
  const f = safeFolder(folder);
  const list = await readMeta(f);
  const hit = list.find((a) => a.id === id);
  if (!hit) return null;
  const buf = await readBinary(`files/${assetFilePath(f, hit.id, hit.ext)}`);
  if (!buf) return null;
  await mkdir(destDir, { recursive: true });
  const out = path.join(destDir, `upload_${hit.id}${hit.ext}`);
  await writeFile(out, buf);
  return {
    path: out,
    kind: hit.kind,
    shot: hit.shot,
    name: hit.name,
    attribution: hit.attribution,
    license: hit.license,
  };
}

/** 장면 shot에 맞는 업로드를 우선 고른다 */
export function pickUploadForShot(
  assets: ProductAsset[],
  shot: string,
  avoidIds: Set<string>,
): ProductAsset | null {
  const unused = assets.filter((a) => !avoidIds.has(a.id));
  if (!unused.length) return null;
  const exact = unused.filter((a) => a.shot === shot);
  if (exact.length) return exact[0]!;
  const any = unused.filter((a) => a.shot === 'any' || !a.shot);
  if (any.length) {
    // 영상 우선
    return any.find((a) => a.kind === 'video') || any[0]!;
  }
  // 태그 안 맞아도 영상 하나라도
  return unused.find((a) => a.kind === 'video') || unused[0] || null;
}

/** 장면 선택 UI용 id — upload:{id} */
export function uploadSceneOptions(assets: ProductAsset[]) {
  return assets.map((a) => ({
    id: `upload:${a.id}`,
    label: `내 ${a.kind === 'video' ? '영상' : '사진'}: ${a.name}${a.shot && a.shot !== 'any' ? ` (${a.shot})` : ''}`,
    cost: false,
  }));
}

/** bootstrap 등에서 상품에 assets 붙일 때 */
export async function attachAssetsToProducts<T extends { folder: string }>(
  products: T[],
): Promise<Array<T & { assets: ProductAsset[] }>> {
  const out: Array<T & { assets: ProductAsset[] }> = [];
  for (const p of products) {
    try {
      out.push({ ...p, assets: await listProductAssets(p.folder) });
    } catch {
      out.push({ ...p, assets: [] });
    }
  }
  return out;
}

export async function ensureAssetsListed(folder: string) {
  // listFiles로 uploads 폴더가 비어 있어도 meta만 있으면 됨
  try {
    await listFiles(`files/shortform/products/${safeFolder(folder)}/uploads`);
  } catch {
    /* empty ok */
  }
  return listProductAssets(folder);
}
