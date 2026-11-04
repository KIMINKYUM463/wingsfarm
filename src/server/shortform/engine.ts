/**
 * 숏폼 스튜디오 Python 엔진.
 * HTTP 서버를 켜지 않고 stdin/stdout JSON으로 bridge.py 와 대화한다.
 * Next API가 첫 요청 때 프로세스를 붙잡고, 사용자는 터미널/ bat 없이 /shortform 만 열면 된다.
 *
 * 상태는 globalThis 에 둔다 — next dev HMR 로 모듈이 다시 로드돼도
 * 엔진을 죽이지 않아 queued 작업이 '스튜디오가 다시 켜지면서 중단'으로 죽지 않는다.
 */
import 'server-only';
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { handleShortformNode, isShortformServerless } from '@/server/shortform/nodeApi';

const ROOT = path.join(process.cwd(), 'shortform');
const BRIDGE = path.join(ROOT, 'studio', 'bridge.py');

type EngineResult = { ok: true; result: unknown } | { ok: false; error: string; status?: number };

type Pending = {
  resolve: (v: EngineResult) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type EngineState = {
  child: ChildProcessWithoutNullStreams | null;
  ready: Promise<void> | null;
  seq: number;
  pending: Map<number, Pending>;
};

const g = globalThis as typeof globalThis & { __wingsfarmShortformEngine?: EngineState };
const state: EngineState = (g.__wingsfarmShortformEngine ??= {
  child: null,
  ready: null,
  seq: 0,
  pending: new Map(),
});

function pythonBin() {
  const local = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python312', 'python.exe')
    : '';
  if (local && existsSync(local)) return local;
  return process.platform === 'win32' ? 'python' : 'python3';
}

/** shortform/.env + 루트 .env.local 키를 자식 환경에 넣는다 */
function engineEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' };
  for (const file of [path.join(ROOT, '.env'), path.join(process.cwd(), '.env.local'), path.join(process.cwd(), '.env')]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line.includes('=') || line.trim().startsWith('#')) continue;
      const i = line.indexOf('=');
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (k && v && !env[k]) env[k] = v;
    }
  }
  return env;
}

function failAll(err: Error) {
  for (const [, p] of state.pending) {
    clearTimeout(p.timer);
    p.reject(err);
  }
  state.pending.clear();
}

function onLine(line: string) {
  let msg: { id?: number | null; ok?: boolean; result?: unknown; error?: string; status?: number };
  try {
    msg = JSON.parse(line);
  } catch {
    console.error('[shortform] bad engine line', line.slice(0, 200));
    return;
  }
  if (msg.id == null) return;
  const p = state.pending.get(msg.id);
  if (!p) return;
  state.pending.delete(msg.id);
  clearTimeout(p.timer);
  if (msg.ok) p.resolve({ ok: true, result: msg.result });
  else p.resolve({ ok: false, error: msg.error || '숏폼 엔진 오류', status: msg.status });
}

function startEngine() {
  if (!existsSync(BRIDGE)) {
    return Promise.reject(new Error('shortform/studio/bridge.py 를 찾지 못했어요. shortform 폴더가 프로젝트에 있는지 확인하세요.'));
  }
  state.ready = new Promise<void>((resolve, reject) => {
    const proc = spawn(pythonBin(), ['-u', BRIDGE], {
      cwd: ROOT,
      env: engineEnv(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    state.child = proc;
    let booted = false;
    const rl = readline.createInterface({ input: proc.stdout });
    rl.on('line', (line) => {
      if (!booted) {
        try {
          const msg = JSON.parse(line) as { ok?: boolean; result?: { ready?: boolean } };
          if (msg.ok && msg.result?.ready) {
            booted = true;
            resolve();
            return;
          }
        } catch {
          /* fallthrough */
        }
      }
      onLine(line);
    });
    proc.stderr.on('data', (buf: Buffer) => {
      const text = buf.toString('utf8').trim();
      if (text) console.error('[shortform:engine]', text.slice(-2000));
    });
    proc.on('error', (err) => {
      state.child = null;
      state.ready = null;
      failAll(err);
      if (!booted) reject(err);
    });
    proc.on('exit', (code) => {
      state.child = null;
      state.ready = null;
      const err = new Error(`숏폼 엔진이 종료됐어요 (code ${code}). 페이지를 새로고침해 주세요.`);
      failAll(err);
      if (!booted) reject(err);
    });
    setTimeout(() => {
      if (!booted) {
        proc.kill();
        reject(new Error('숏폼 엔진 시작이 너무 오래 걸려요. Python·requirements 설치를 확인해 주세요.'));
      }
    }, 60_000);
  });
  return state.ready;
}

async function ensureEngine() {
  // ready 만 본다 — child 할당 전 이중 spawn 방지
  if (state.ready) return state.ready;
  return startEngine();
}

export async function shortformCall(method: string, params: Record<string, unknown> = {}, timeoutMs = 300_000): Promise<EngineResult> {
  // Vercel 등 serverless: Python spawn 불가 → Node 읽기 전용으로 bootstrap 등은 살린다
  if (isShortformServerless()) {
    return handleShortformNode(method, params);
  }

  try {
    await ensureEngine();
  } catch (err) {
    // 로컬에서도 Python이 없으면 bootstrap만이라도 Node로 열어 UI가 뜨게 한다
    if (method === 'bootstrap' || method === 'products' || method === 'jobs' || method === 'analysis' || method === 'job') {
      console.error('[shortform] python engine unavailable, falling back to node', err);
      return handleShortformNode(method, params);
    }
    const message =
      err instanceof Error
        ? err.message
        : '숏폼 엔진에 연결하지 못했어요. Python·requirements 설치를 확인해 주세요.';
    return { ok: false, error: message, status: 500 };
  }

  if (!state.child?.stdin) {
    return { ok: false, error: '숏폼 엔진에 연결하지 못했어요.', status: 500 };
  }
  const id = ++state.seq;
  return new Promise<EngineResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      state.pending.delete(id);
      resolve({ ok: false, error: '요청 시간이 초과됐어요. 잠시 뒤 다시 시도해 주세요.', status: 504 });
    }, timeoutMs);
    state.pending.set(id, { resolve, reject, timer });
    state.child!.stdin.write(`${JSON.stringify({ id, method, params })}\n`, (err) => {
      if (err) {
        state.pending.delete(id);
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

export function shortformRoots() {
  return {
    root: ROOT,
    products: path.join(ROOT, 'products'),
    output: path.join(ROOT, 'output'),
    frames: path.join(ROOT, 'studio', 'data', 'frames'),
    analysis: path.join(ROOT, 'studio', 'data', 'analysis'),
    static: path.join(ROOT, 'studio', 'static'),
  };
}
