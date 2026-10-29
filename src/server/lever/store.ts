import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * 상세페이지(레버페이지) 로컬 저장소
 *
 * - 원본은 Supabase(Postgres + Storage)를 쓰지만, 윙스팜AI는 단일 PC에서 돌아가므로
 *   `.data/detail-page` 폴더에 JSON·이미지 파일로 저장한다.
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

const isNotFound = (err: unknown) => (err as NodeJS.ErrnoException)?.code === 'ENOENT';

export async function readJson<T>(relPath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(resolveDataPath(relPath), 'utf8')) as T;
  } catch (err) {
    if (isNotFound(err)) return fallback;
    throw err;
  }
}

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

/** 임시 파일에 쓴 뒤 rename → 쓰는 도중 종료돼도 파일이 깨지지 않음 */
export async function writeData(relPath: string, data: string | Buffer) {
  const full = resolveDataPath(relPath);
  await mkdir(path.dirname(full), { recursive: true });
  const tmp = `${full}.${randomUUID()}.tmp`;
  await writeFile(tmp, data);
  await renameWithRetry(tmp, full);
}

export const writeJson = (relPath: string, data: unknown) =>
  writeData(relPath, JSON.stringify(data));

export async function readBinary(relPath: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveDataPath(relPath));
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function removeData(relPath: string) {
  await rm(resolveDataPath(relPath), { recursive: true, force: true });
}

export async function listFiles(relDir: string): Promise<string[]> {
  try {
    return await readdir(resolveDataPath(relDir));
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }
}

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
