import 'server-only';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ApiError } from '../http';

const exec = promisify(execFile);
/** FFMPEG_PATH(직접 지정) → PATH의 ffmpeg */
const binary = () => process.env.FFMPEG_PATH || 'ffmpeg';

let available: Promise<boolean> | null = null;

/** 설치 여부 (없다고 나오면 다음 호출에서 다시 확인 — 설치 후 서버 재시작 없이 동작) */
export function hasFfmpeg() {
  available ??= exec(binary(), ['-version'], { timeout: 10_000, windowsHide: true }).then(
    () => true,
    () => {
      available = null;
      return false;
    },
  );
  return available;
}

export async function ffmpeg(args: string[], timeoutMs = 180_000) {
  if (!(await hasFfmpeg())) {
    throw new ApiError(503, '움직이는 컷을 만들려면 서버 PC에 ffmpeg가 필요해요. (설치 후 PATH 등록 또는 FFMPEG_PATH 설정)');
  }
  await exec(binary(), ['-hide_banner', '-loglevel', 'error', ...args], {
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
}

/** 임시 폴더에서 작업하고 끝나면 지운다 */
export async function withTempDir<T>(task: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'wingsfarm-motion-'));
  try {
    return await task(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
