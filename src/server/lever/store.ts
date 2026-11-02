import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from './http';
import { createSupabaseStorage, supabaseConfig, type SupabaseStorage } from './supabaseStorage';

/**
 * 상세페이지(레버페이지) 저장소
 *
 * - SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY가 있으면 Supabase Storage 버킷에 저장한다 (Vercel 배포용).
 * - 없으면 `.data/detail-page` 폴더에 JSON·이미지 파일로 저장한다 (내 PC 전용).
 *   Vercel 서버는 디스크에 쓸 수 없으므로 Vercel에서는 Supabase가 필수다.
 * - 같은 파일을 동시에 고치면 마지막 쓰기만 남으므로 파일별 잠금(withLock)으로 직렬화한다.
 */
export const DATA_ROOT = path.resolve(
  /*turbopackIgnore: true*/ process.env.LEVER_DATA_DIR || path.join(process.cwd(), '.data', 'detail-page'),
);

/** 저장소 밖 경로 접근(../) 차단 */
export const resolveDataPath = (relPath: string) => {
  const full = path.resolve(DATA_ROOT, relPath);
  if (full !== DATA_ROOT && !full.startsWith(DATA_ROOT + path.sep)) {
    throw new Error(`잘못된 저장소 경로: ${relPath}`);
  }
  return full;
};

/** Supabase에 넘기는 경로도 로컬과 같은 규칙으로 검사한 뒤 `/` 구분 상대 경로로 바꾼다 */
const toKey = (relPath: string) => path.relative(DATA_ROOT, resolveDataPath(relPath)).split(path.sep).join('/');

const isNotFound = (err: unknown) => (err as NodeJS.ErrnoException)?.code === 'ENOENT';

const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
const RENAME_RETRY_LIMIT_MS = 2000;

/**
 * Windows에선 다른 요청이 대상 파일을 읽는 중이면 rename이 EPERM으로 실패한다.
 * 잠깐 기다렸다 다시 시도한다 (graceful-fs와 같은 방식).
 */
async function renameWithRetry(from: string, to: string) {
  const startedAt = Date.now();
  for (let delay = 10; ; delay = Math.min(delay * 2, 100)) {
    try {
      return await rename(from, to);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code ?? '';
      if (!TRANSIENT_RENAME_CODES.has(code) || Date.now() - startedAt > RENAME_RETRY_LIMIT_MS) {
        await rm(from, { force: true });
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

interface Backend {
  read(relPath: string): Promise<Buffer | null>;
  write(relPath: string, data: string | Buffer): Promise<void>;
  remove(relPath: string): Promise<void>;
  list(relDir: string): Promise<string[]>;
}

const localBackend: Backend = {
  async read(relPath) {
    try {
      return await readFile(resolveDataPath(relPath));
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  },
  /** 임시 파일에 쓴 뒤 rename → 쓰는 도중 종료돼도 파일이 깨지지 않음 */
  async write(relPath, data) {
    const full = resolveDataPath(relPath);
    await mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.${randomUUID()}.tmp`;
    await writeFile(tmp, data);
    await renameWithRetry(tmp, full);
  },
  async remove(relPath) {
    await rm(resolveDataPath(relPath), { recursive: true, force: true });
  },
  async list(relDir) {
    try {
      return await readdir(resolveDataPath(relDir));
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  },
};

let supabase: SupabaseStorage | null | undefined;
const getSupabase = () => {
  if (supabase === undefined) {
    const config = supabaseConfig();
    supabase = config ? createSupabaseStorage(config) : null;
  }
  return supabase;
};

const NO_STORAGE_ON_VERCEL =
  '배포 사이트에서 상세페이지를 쓰려면 Supabase 저장소를 연결해야 해요. Vercel 환경변수에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 넣고 다시 배포해 주세요.';

const getBackend = (): Backend => {
  const storage = getSupabase();
  if (storage) {
    return {
      read: (relPath) => storage.read(toKey(relPath)),
      write: (relPath, data) => storage.write(toKey(relPath), data),
      remove: (relPath) => storage.remove(toKey(relPath)),
      list: (relDir) => storage.list(toKey(relDir)),
    };
  }
  return process.env.VERCEL ? readOnlyBackend : localBackend;
};

const refuseWrite = async () => {
  throw new ApiError(503, NO_STORAGE_ON_VERCEL);
};

/** Supabase 없는 Vercel: 화면은 빈 상태로 열리고, 저장하려는 순간에만 안내한다 */
const readOnlyBackend: Backend = { ...localBackend, write: refuseWrite, remove: refuseWrite };

/** Supabase를 쓰면 브라우저 업로드 주소를 Supabase가 직접 발급한다 (로컬이면 null) */
export const remoteUploadUrl = (relPath: string) => getSupabase()?.signedUploadUrl(toKey(relPath)) ?? null;

export const readBinary = (relPath: string) => getBackend().read(relPath);

export async function readJson<T>(relPath: string, fallback: T): Promise<T> {
  const data = await readBinary(relPath);
  return data ? (JSON.parse(data.toString('utf8')) as T) : fallback;
}

export const writeData = (relPath: string, data: string | Buffer) => getBackend().write(relPath, data);

export const writeJson = (relPath: string, data: unknown) => writeData(relPath, JSON.stringify(data));

export const removeData = (relPath: string) => getBackend().remove(relPath);

export const listFiles = (relDir: string) => getBackend().list(relDir);

const locks = new Map<string, Promise<unknown>>();

/** 같은 key의 작업을 순서대로 실행 (읽기-수정-쓰기 경쟁 방지) */
export function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
}

/** JSON 파일 하나를 잠금 안에서 읽고 고쳐 쓴다 */
export function updateJson<T, R = T>(
  relPath: string,
  fallback: T,
  mutate: (current: T) => T | Promise<T>,
  pick: (next: T) => R = (next) => next as unknown as R,
): Promise<R> {
  return withLock(relPath, async () => {
    const next = await mutate(await readJson(relPath, fallback));
    await writeJson(relPath, next);
    return pick(next);
  });
}

export const nowIso = () => new Date().toISOString();
export const newId = () => randomUUID();
