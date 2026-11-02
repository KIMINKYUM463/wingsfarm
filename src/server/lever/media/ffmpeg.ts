import 'server-only';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import bundledFfmpeg from 'ffmpeg-static';
import { ApiError } from '../http';

const exec = promisify(execFile);

/** FFMPEG_PATH(직접 지정) → PC에 설치된 ffmpeg → npm 패키지에 들어 있는 ffmpeg (Vercel처럼 설치할 수 없는 서버용) */
const candidates = () => [process.env.FFMPEG_PATH, 'ffmpeg', bundledFfmpeg].filter((p): p is string => Boolean(p));

const runs = (bin: string) =>
  exec(bin, ['-version'], { timeout: 10_000, windowsHide: true }).then(
    () => true,
    () => false,
  );

let found: Promise<string | null> | null = null;

/** 실행되는 ffmpeg 경로 (못 찾으면 다음 호출에서 다시 확인 — 설치 후 서버 재시작 없이 동작) */
function findFfmpeg() {
  found ??= (async () => {
    for (const bin of candidates()) if (await runs(bin)) return bin;
    found = null;
    return null;
  })();
  return found;
}

export async function ffmpeg(args: string[], timeoutMs = 180_000) {
  const bin = await findFfmpeg();
  if (!bin) {
    throw new ApiError(503, '움직이는 컷을 만들 ffmpeg를 찾지 못했어요. (설치 후 PATH 등록 또는 FFMPEG_PATH 설정)');
  }
  await exec(bin, ['-hide_banner', '-loglevel', 'error', ...args], {
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
