/**
 * 숏폼 웹형 저장소 — lever store(로컬 .data 또는 Supabase)에 상품·작업·영상을 둔다.
 * Vercel에서는 SUPABASE_* 환경변수가 있어야 저장·렌더가 된다.
 */
import 'server-only';
import { listFiles, readBinary, readJson, updateJson, writeData, writeJson } from '@/server/lever/store';
import { publicUrl, saveFile } from '@/server/lever/storage';

const ROOT = 'files/shortform';
const PRODUCTS = `${ROOT}/products`;
const JOBS_FILE = `${ROOT}/jobs.json`;
const OUTPUT = `${ROOT}/output`;

export type SfProduct = {
  folder: string;
  name: string;
  category?: string;
  origin?: string;
  unit?: string;
  price?: string | number;
  memo?: string;
  en_name?: string;
  look?: string;
  photo: string | null;
  photos: number;
  cached: string[];
  updated_at?: string;
};

export type SfJob = {
  id: string;
  product: string;
  template: string;
  template_name: string;
  ref?: string | null;
  mode: string;
  fields: Record<string, unknown>;
  status: 'queued' | 'running' | 'done' | 'error' | 'drafting';
  created: string;
  finished?: string;
  log: string[];
  result: null | { type: 'video' | 'cards'; file?: string; files?: string[]; script?: string };
  error?: string;
  fidelity?: null;
  post?: unknown;
  used_ai?: boolean;
};

function safeFolder(name: string) {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!cleaned) throw new Error('상품명을 입력해 주세요');
  return cleaned;
}

export function productPhotoPath(folder: string, file = '00_studio.jpg') {
  return `shortform/products/${folder}/${file}`;
}

export function productJsonPath(folder: string) {
  return `${PRODUCTS}/${folder}/product.json`;
}

export function outputPath(fileName: string) {
  return `shortform/output/${fileName}`;
}

export async function listWebProducts(): Promise<SfProduct[]> {
  const names = await listFiles(PRODUCTS);
  const out: SfProduct[] = [];
  for (const name of names) {
    const meta = await readJson<Record<string, unknown> | null>(`${PRODUCTS}/${name}/product.json`, null);
    if (!meta) continue;
    const photoRel = productPhotoPath(name);
    const hasPhoto = Boolean(await readBinary(`files/${photoRel}`));
    out.push({
      folder: name,
      name: String(meta.name ?? name),
      category: meta.category ? String(meta.category) : undefined,
      origin: meta.origin ? String(meta.origin) : undefined,
      unit: meta.unit ? String(meta.unit) : undefined,
      price: meta.price as string | number | undefined,
      memo: meta.memo ? String(meta.memo) : undefined,
      en_name: meta.en_name ? String(meta.en_name) : undefined,
      look: meta.look ? String(meta.look) : undefined,
      photo: hasPhoto ? publicUrl(photoRel) : null,
      photos: hasPhoto ? 1 : 0,
      cached: [],
      updated_at: meta.updated_at ? String(meta.updated_at) : undefined,
    });
  }
  out.sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));
  return out;
}

export async function readWebProduct(folder: string): Promise<SfProduct | null> {
  const all = await listWebProducts();
  return all.find((p) => p.folder === folder) ?? null;
}

export async function loadProductPhoto(folder: string): Promise<Buffer | null> {
  return readBinary(`files/${productPhotoPath(folder)}`);
}

export async function upsertWebProduct(body: Record<string, unknown>): Promise<SfProduct> {
  const name = String(body.name ?? '').trim();
  const folder = safeFolder(name);
  const from = body.from ? String(body.from) : '';
  const now = new Date().toISOString();

  let photoBuf: Buffer | null = null;
  if (typeof body.photo === 'string' && body.photo.startsWith('data:')) {
    const m = body.photo.match(/^data:image\/[\w+.-]+;base64,(.+)$/i);
    if (!m) throw new Error('사진을 읽지 못했어요. JPG나 PNG로 올려 주세요');
    photoBuf = Buffer.from(m[1], 'base64');
  } else if (from && from !== folder) {
    photoBuf = await loadProductPhoto(from);
  }

  if (photoBuf) {
    await saveFile(productPhotoPath(folder), photoBuf);
  } else {
    const existing = await loadProductPhoto(folder);
    if (!existing) throw new Error('사진을 한 장 올려 주세요');
  }

  const meta = {
    name,
    category: body.category || '과일',
    origin: body.origin || '',
    unit: body.unit || '',
    price: body.price || '',
    memo: body.memo || '',
    updated_at: now,
  };
  await writeJson(productJsonPath(folder), meta);

  const product = await readWebProduct(folder);
  if (!product) throw new Error('상품 저장에 실패했어요');
  return product;
}

export async function listJobs(): Promise<SfJob[]> {
  const jobs = await readJson<SfJob[]>(JOBS_FILE, []);
  return jobs.map(({ log: _log, ...rest }) => ({ ...rest, log: [] }));
}

export async function getJob(id: string): Promise<SfJob | null> {
  const jobs = await readJson<SfJob[]>(JOBS_FILE, []);
  return jobs.find((j) => j.id === id) ?? null;
}

export async function saveJob(job: SfJob): Promise<SfJob> {
  return updateJson<SfJob[], SfJob>(JOBS_FILE, [], (jobs) => {
    const i = jobs.findIndex((j) => j.id === job.id);
    if (i >= 0) jobs[i] = job;
    else jobs.unshift(job);
    return jobs;
  }, () => job);
}

export async function patchJob(id: string, patch: Partial<SfJob>): Promise<SfJob | null> {
  return updateJson<SfJob[], SfJob | null>(JOBS_FILE, [], (jobs) => {
    const i = jobs.findIndex((j) => j.id === id);
    if (i < 0) return jobs;
    jobs[i] = { ...jobs[i], ...patch };
    return jobs;
  }, (jobs) => jobs.find((j) => j.id === id) ?? null);
}

export async function hideJob(id: string): Promise<void> {
  await updateJson<SfJob[]>(JOBS_FILE, [], (jobs) => jobs.filter((j) => j.id !== id));
}

export async function saveOutputMp4(fileName: string, data: Buffer) {
  const rel = outputPath(fileName);
  await saveFile(rel, data);
  return publicUrl(rel);
}

export async function saveOutputCard(fileName: string, data: Buffer) {
  const rel = outputPath(fileName);
  await saveFile(rel, data);
  return publicUrl(rel);
}

export { writeData, OUTPUT };
