/**
 * 이 PC에서만: 클로드 코드가 쓰던 Python·Remotion·효과음·배경음악을 호출한다.
 * Vercel에는 Python과 크롬이 없으므로 여기 함수는 바로 건너뛴다.
 */
import 'server-only';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DATA_ROOT } from '@/server/lever/store';
import { ffmpeg } from '@/server/lever/media/ffmpeg';
import { declickSamples } from '@/server/shortform/declick';

const ROOT = path.join(process.cwd(), 'shortform');

export function isLocalDemo() {
  return !process.env.VERCEL;
}

function pythonBin() {
  const local = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python312', 'python.exe')
    : '';
  if (local && existsSync(local)) return local;
  return process.platform === 'win32' ? 'python' : 'python3';
}

export function productDir(folder: string) {
  return path.join(DATA_ROOT, 'files', 'shortform', 'products', folder);
}

function remotionCli() {
  const cli = path.join(ROOT, 'motion', 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
  return existsSync(cli) ? cli : null;
}

export function canRunPythonMotion() {
  return isLocalDemo() && existsSync(path.join(ROOT, 'make_motion.py')) && Boolean(remotionCli());
}

function bgmPath(mood: string) {
  if (!mood || mood === '없음') return null;
  const file = path.join(ROOT, 'studio', 'data', 'bgm', `${mood}.mp3`);
  return existsSync(file) ? file : null;
}

function runProcess(cmd: string, args: string[], cwd: string, log: (m: string) => Promise<void> | void, timeoutMs: number) {
  return new Promise<number>((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve(-1);
    }, timeoutMs);
    const take = (buf: Buffer) => {
      for (const line of buf.toString('utf8').split(/\r?\n/)) {
        const text = line.trim();
        if (text) void log(text.slice(0, 300));
      }
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (err) => {
      clearTimeout(timer);
      void log(err.message);
      resolve(-1);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
}

function wavBytes(samples: Float32Array, rate: number) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] ?? 0));
    pcm.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * 장면 소리를 각각 0에서 시작해 0으로 끝내고, 하나의 wav로 잇는다.
 * 장면마다 따로 인코딩하면 이음새에서 '픽'이 난다.
 */
export async function buildSeamlessVoice(inputs: string[], dest: string) {
  const dir = path.dirname(dest);
  await mkdir(dir, { recursive: true });
  const parts: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const raw = path.join(dir, `declick-${i}.f32`);
    const wav = path.join(dir, `declick-${i}.wav`);
    await ffmpeg(['-y', '-i', inputs[i]!, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', raw], 60_000);
    const buf = await readFile(raw);
    const aligned = new ArrayBuffer(buf.length);
    new Uint8Array(aligned).set(buf);
    const sealed = declickSamples(new Float32Array(aligned));
    await writeFile(wav, wavBytes(sealed, 48000));
    parts.push(wav);
  }
  if (!parts.length) return;
  const list = path.join(dir, 'declick-list.txt');
  await writeFile(list, parts.map((file) => `file '${file.replace(/\\/g, '/')}'`).join('\n'));
  await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '1', dest], 60_000);
}

/** 분위기 mp3. 없으면 이 PC의 music.py가 한 번 만든다. */
export async function ensureBgm(mood: string, log: (m: string) => Promise<void> | void) {
  const hit = bgmPath(mood);
  if (hit || !isLocalDemo() || !mood || mood === '없음') return hit;
  await log(`배경음악 준비: ${mood}`);
  const code = await runProcess(
    pythonBin(),
    ['-c', `from studio.music import get_bgm; p=get_bgm(${JSON.stringify(mood)}); print(p or "")`],
    ROOT,
    log,
    120_000,
  );
  if (code !== 0) {
    await log('배경음악을 만들지 못해 음악 없이 이어 붙여요');
    return null;
  }
  return bgmPath(mood);
}

/**
 * 완성본 위에 배경음악만 얹는다.
 * 장면마다 효과음을 넣으면 대사가 끝나는 지점에서 '찍'으로 들려서 넣지 않는다.
 */
export async function mixBed(
  video: string,
  dest: string,
  sceneDurs: number[],
  mood: string,
  _seed: number,
  log: (m: string) => Promise<void> | void,
) {
  const bgm = await ensureBgm(mood, log);
  if (!bgm) return false;
  await log(`배경음악 ${mood}을 대사 아래에 깔아요`);
  const total = sceneDurs.reduce((sum, d) => sum + d, 0) || 8;
  await ffmpeg(
    [
      '-y',
      '-i',
      video,
      '-stream_loop',
      '-1',
      '-i',
      bgm,
      '-filter_complex',
      `[0:a]aformat=channel_layouts=mono[voice];[1:a]aformat=channel_layouts=mono,volume=0.12,afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, total - 1).toFixed(2)}:d=0.8[bgm];[voice][bgm]amix=inputs=2:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.95[a]`,
      '-map',
      '0:v',
      '-map',
      '[a]',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-ar',
      '48000',
      '-ac',
      '1',
      '-movflags',
      '+faststart',
      dest,
    ],
    180_000,
  );
  return true;
}

type OverlayScene = {
  /** 자막이 아직 없는 장면 영상 */
  video: string;
  /** 대사가 들어 있는 클립. 여기서 소리만 뽑는다 */
  audioFrom: string;
  say: string;
  kind: string;
  seconds: number;
  label?: string;
};

function motionWords(say: string, seconds: number) {
  const marked = [...say.matchAll(/\*([^*]+)\*/g)].map((m) => m[1]!.replace(/\s+/g, ''));
  const plain = say.replace(/\*/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  let parts = plain.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    const chars = [...plain.replace(/\s+/g, '')];
    parts = [];
    for (let i = 0; i < chars.length; i += 2) parts.push(chars.slice(i, i + 2).join(''));
  }
  if (!parts.length) parts = [' '];
  const span = Math.max(0.3, seconds - 0.05);
  return parts.map((text, i) => ({
    text,
    start: (span * i) / parts.length,
    end: (span * (i + 1)) / parts.length,
    hl: marked.some((m) => m.includes(text) || text.includes(m)),
  }));
}

/**
 * 이미 만든 장면 영상 위에 Remotion 글자 모션·장면 전환을 올린다.
 * 효과음은 넣지 않는다. 실패하면 false.
 */
export async function overlayMotion(
  jobId: string,
  scenes: OverlayScene[],
  meta: { title1?: string; title2?: string; info?: string; aiLabel?: boolean; music?: string; motionStyle?: string },
  dest: string,
  log: (m: string) => Promise<void> | void,
) {
  const cli = remotionCli();
  if (!isLocalDemo() || !cli || scenes.length === 0) return false;
  const runId = jobId.replace(/[^\w가-힣.-]+/g, '_').slice(0, 40);
  const run = path.join(ROOT, 'motion', 'public', 'runs', runId);
  await rm(run, { recursive: true, force: true });
  await mkdir(run, { recursive: true });
  try {
    await log('장면 영상 위에 글자 모션과 장면 전환을 입혀요');
    const built = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]!;
      const videoName = `s${i}.mp4`;
      await copyFile(scene.video, path.join(run, videoName));
      const kind = ['HOOK', 'TIP', 'REVEAL', 'PRICE', 'CTA'].includes(scene.kind) ? scene.kind : 'TIP';
      built.push({
        kind,
        lead: 0.02,
        frames: Math.max(24, Math.round(scene.seconds * 30)),
        bg: `runs/${runId}/${videoName}`,
        bgType: 'video',
        words: motionWords(scene.say, scene.seconds),
        label: scene.label || '',
      });
    }
    const voiceName = 'voice.wav';
    await buildSeamlessVoice(
      scenes.map((scene) => scene.audioFrom),
      path.join(run, voiceName),
    );
    const props: Record<string, unknown> = {
      title1: meta.title1 || '',
      title2: meta.title2 || '',
      info: meta.info || '',
      highlight: 'yellow',
      price: null,
      voice: `runs/${runId}/${voiceName}`,
      aiLabel: Boolean(meta.aiLabel),
      motionStyle: meta.motionStyle || 'clean',
      scenes: built,
      bgmVolume: 0.12,
      seed: 1,
    };
    const bgm = await ensureBgm(String(meta.music || ''), log);
    if (bgm) {
      await copyFile(bgm, path.join(run, 'bgm.mp3'));
      props.bgm = `runs/${runId}/bgm.mp3`;
    }
    const propsPath = path.join(run, 'props.json');
    await writeFile(propsPath, JSON.stringify(props));
    const args = [cli, 'render', 'src/index.jsx', 'Motion', dest, `--props=${propsPath}`, '--codec=h264', '--crf=20', '--log=error'];
    const browser = process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'remotion-chs', 'chrome-headless-shell.exe')
      : '';
    if (browser && existsSync(browser)) args.push(`--browser-executable=${browser}`);
    const code = await runProcess(process.execPath, args, path.join(ROOT, 'motion'), log, 8 * 60_000);
    if (code !== 0 || !existsSync(dest)) {
      await log('모션그래픽을 올리지 못해, 자막만 있는 영상으로 마무리해요');
      return false;
    }
    return true;
  } catch (err) {
    await log(`모션그래픽을 올리지 못했어요: ${err instanceof Error ? err.message : err}`);
    return false;
  } finally {
    await rm(run, { recursive: true, force: true }).catch(() => undefined);
  }
}

type FieldDef = { key: string; type?: string; sources?: string[] };

/** 판매형·템플릿 설정을 make_motion.py가 읽는 JSON으로 만든다. */
function motionConfig(job: { id: string; template: string; mode: string; fields: Record<string, unknown> }, tpl: { engine?: string; fields?: FieldDef[] }) {
  const fields = job.fields;
  const label = String(fields.voice || '');
  const voice = label.includes('남성') ? 'gemini:Charon' : 'gemini:Kore';
  const base: Record<string, unknown> = {
    id: job.id,
    render_seed: job.id,
    mode: job.mode,
    motion_style: fields.motion_style || 'clean',
    ai_label: fields.ai_label !== false && job.mode !== 'photo',
    voice,
  };
  if (tpl.engine === 'short') {
    const config: Record<string, unknown> = { ...base, engine: 'short' };
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'features' || value == null || value === '') continue;
      config[key] = typeof value === 'string' ? value.replace(/\*/g, '') : value;
    }
    const features = Array.isArray(fields.features) ? fields.features : [];
    config.features = features
      .map((item) => (item && typeof item === 'object' && 'text' in item ? String((item as { text: string }).text) : String(item)))
      .map((text) => text.replace(/\*/g, ''))
      .filter(Boolean);
    return config;
  }
  const video: Record<string, unknown> = { id: job.id, template: job.template };
  for (const field of tpl.fields || []) {
    const value = fields[field.key];
    if (field.type === 'list') {
      const sources = field.sources?.length ? field.sources : ['photo:1'];
      const items = Array.isArray(value) ? value : [];
      video[field.key] = items
        .map((item, i) => {
          const text = item && typeof item === 'object' && 'text' in item ? String((item as { text: string }).text) : String(item ?? '');
          const source = item && typeof item === 'object' && 'source' in item ? String((item as { source: string }).source) : sources[i % sources.length];
          return text.trim() ? [text, source] : null;
        })
        .filter(Boolean);
    } else if (value != null && value !== '') {
      video[field.key] = value;
    }
  }
  return { ...base, videos: [video] };
}

/**
 * 이 PC에 Remotion이 있으면 make_motion.py로 모션 영상을 만든다.
 * 없거나 실패하면 null. 호출측이 웹 엔진 영상으로 이어 간다.
 */
export async function renderPythonMotion(
  job: { id: string; product: string; template: string; mode: string; fields: Record<string, unknown> },
  tpl: { engine?: string; output?: string; fields?: FieldDef[] },
  log: (m: string) => Promise<void> | void,
) {
  if (!isLocalDemo()) return null;
  const look = String(job.fields.look || '');
  if (look === 'ucc' || look === 'farmer' || look === 'origin') return null;
  if (job.template === 'clone' || tpl.output === 'cards') return null;
  if (job.fields.motion === false) return null;
  const dir = productDir(job.product);
  const photo = path.join(dir, '00_studio.jpg');
  if (!existsSync(photo)) {
    await log('상품 사진 폴더를 찾지 못해 Python 모션은 건너뛰어요');
    return null;
  }
  if (!remotionCli()) {
    await log('Remotion이 설치되어 있지 않아요. 웹 영상에 효과음과 배경음악만 입혀요. shortform/motion 에서 npm install 하면 글자 모션까지 됩니다.');
    return null;
  }
  const mood = String(job.fields.music || '');
  const bgm = await ensureBgm(mood, log);
  const config = motionConfig(job, tpl);
  if (bgm) config.bgm_file = bgm;
  const work = path.join(tmpdir(), `wingsfarm-motion-${job.id}`);
  await mkdir(work, { recursive: true });
  const cfg = path.join(work, 'config.json');
  const out = path.join(work, 'out.mp4');
  await writeFile(cfg, JSON.stringify(config));
  await log('이 PC에서 Python으로 모션그래픽·효과음·배경음악을 입혀요');
  const code = await runProcess(
    pythonBin(),
    ['-u', path.join(ROOT, 'make_motion.py'), dir, '--config', cfg, '--out', out],
    ROOT,
    log,
    8 * 60_000,
  );
  if (code !== 0 || !existsSync(out)) {
    await log('Python 모션이 실패해서, 웹 엔진 영상에 효과음과 배경음악을 입혀요');
    return null;
  }
  return out;
}
