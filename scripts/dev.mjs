/**
 * npm run dev — 3000이 이미 쓰이면 그 프로세스를 끄고 next dev를 띄운다.
 * 기본은 Turbopack (탭 이동 시 Compiling이 webpack보다 훨씬 짧다).
 * 필요하면: npm run dev:webpack
 */
import { execSync, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 3000;
const useWebpack = process.env.NEXT_DEV_WEBPACK === '1' || process.argv.includes('--webpack');

function pidsOnPort(port) {
  if (process.platform === 'win32') {
    let out = '';
    try {
      out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    } catch {
      return [];
    }
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      const pid = line.trim().split(/\s+/).at(-1);
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
    }
    return [...pids];
  }

  try {
    return execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' })
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'inherit' });
    else execSync(`kill -9 ${pid}`, { stdio: 'inherit' });
  } catch {
    // 이미 종료된 경우
  }
}

const existing = pidsOnPort(PORT);
if (existing.length) {
  console.log(`포트 ${PORT} 사용 중 (PID ${existing.join(', ')}) — 종료 후 다시 시작합니다.`);
  for (const pid of existing) killPid(pid);
  await sleep(800);
}

// Next 16 기본은 Turbopack. webpack은 탭마다 Compiling이 길어 개발 전환이 느리다.
const args = ['next', 'dev', '-p', String(PORT)];
if (useWebpack) args.splice(2, 0, '--webpack');

console.log(useWebpack ? 'dev: webpack' : 'dev: turbopack (빠름)');

const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
