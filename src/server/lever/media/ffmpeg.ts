import 'server-only';
import { execFile } from 'node:child_process';
import { access, chmod, constants, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import bundledFfmpeg from 'ffmpeg-static';
import { ApiError } from '../http';

const exec = promisify(execFile);

/** FFMPEG_PATH(직접 지정) → PC에 설치된 ffmpeg → npm 패키지에 들어 있는 ffmpeg (Vercel처럼 설치할 수 없는 서버용) */
const candidates = () => [process.env.FFMPEG_PATH, 'ffmpeg', bundledFfmpeg].filter((p): p is string => Boolean(p));

/** Vercel 등에 풀린 ffmpeg-static 바이너리는 실행 비트가 빠져 EACCES가 나는 경우가 있다 */
async function ensureExecutable(bin: string) {
  if (process.platform === 'win32' || bin === 'ffmpeg') return;
  try {
    await access(bin, constants.X_OK);
  } catch {
    await chmod(bin, 0o755).catch(() => null);
  }
}

const runs = async (bin: string) => {
  await ensureExecutable(bin);
  return exec(bin, ['-version'], { timeout: 10_000, windowsHide: true }).then(
    () => true,
    () => false,
  );
};

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

interface ExecFailure {
  killed?: boolean;
  signal?: string | null;
  code?: string | number | null;
  message?: string;
  stderr?: string;
}

/**
 * ffmpeg가 죽은 이유를 사용자 안내로 바꾼다 (모르는 이유면 null — 원래 오류를 그대로 던진다)
 * - 시간 초과: execFile이 SIGTERM으로 끄고 killed=true
 * - 메모리 부족: 서버(OS)가 SIGKILL로 끈다
 * - EACCES: 배포 묶음에서 실행 비트가 빠진 경우
 */
export function ffmpegFailure(err: unknown): ApiError | null {
  const { killed, signal, code, message, stderr } = (err ?? {}) as ExecFailure;
  if (killed) return new ApiError(504, '영상 편집이 너무 오래 걸려 멈췄어요. 영상 수를 줄이거나 더 짧은 영상을 골라 주세요.');
  if (signal === 'SIGKILL') return new ApiError(507, '서버 메모리가 부족해 영상 편집이 멈췄어요. 영상을 1개만 골라 다시 만들어 주세요.');
  if (code === 'EACCES' || code === 'EPERM') {
    return new ApiError(503, '영상 편집 프로그램을 실행할 권한이 없어요. 배포 설정을 확인하거나 잠시 뒤 다시 시도해 주세요.');
  }
  if (code === 'ENOENT') {
    return new ApiError(503, '움직이는 컷을 만들 ffmpeg를 찾지 못했어요. (설치 후 PATH 등록 또는 FFMPEG_PATH 설정)');
  }
  // ffmpeg 자체 실패(잘못된 코덱·필터 등) — stderr 일부를 남겨 원인 추적에 쓴다
  if (code === 1 || code === 255 || /ffmpeg|Error|Invalid/i.test(`${message ?? ''}${stderr ?? ''}`)) {
    const detail = (stderr || message || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    return new ApiError(
      502,
      detail
        ? `영상 편집에 실패했어요. 다른 영상을 골라 주세요. (${detail})`
        : '영상 편집에 실패했어요. 다른 영상을 골라 주세요.',
    );
  }
  return null;
}

/** cwd: 필터 안의 파일 이름(글꼴·자막)을 상대 경로로 쓰려면 그 폴더에서 실행한다 */
export async function ffmpeg(args: string[], timeoutMs = 180_000, cwd?: string) {
  const bin = await findFfmpeg();
  if (!bin) {
    throw new ApiError(503, '움직이는 컷을 만들 ffmpeg를 찾지 못했어요. (설치 후 PATH 등록 또는 FFMPEG_PATH 설정)');
  }
  await ensureExecutable(bin);
  await exec(bin, ['-hide_banner', '-loglevel', 'error', ...args], {
    cwd,
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  }).catch((err: unknown) => {
    console.error('[lever] ffmpeg failed', (err as { stderr?: string }).stderr?.slice(-1500));
    throw ffmpegFailure(err) ?? err;
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
