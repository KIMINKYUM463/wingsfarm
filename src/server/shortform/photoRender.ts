/**
 * 웹형 사진만 모드 렌더 — OpenAI TTS + ffmpeg-static + 자막 PNG.
 * Python/edge-tts/Remotion 없이 Vercel에서도 mp4를 만든다.
 */
import 'server-only';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { openaiClient } from '@/lib/server/openai';
import { runInBackground } from '@/server/lever/background';
import { ffmpeg, withTempDir } from '@/server/lever/media/ffmpeg';
import { renderCaptionPng } from '@/server/lever/media/captionPng';
import { CLIP_FPS } from '@/server/lever/media/motion';
import {
  getJob,
  loadProductPhoto,
  patchJob,
  readWebProduct,
  saveOutputCard,
  saveOutputMp4,
  type SfJob,
} from '@/server/shortform/webStore';

const W = 1080;
const H = 1920;
const LEAD = 0.25;
const PAD = 0.35;

type Template = {
  name?: string;
  layout?: string;
  output?: string;
  engine?: string;
  title?: string[];
  info?: string;
  segments?: Array<Record<string, unknown>>;
  fields?: Array<{ key: string; type: string; sources?: string[] }>;
  highlight?: string;
};

function fill(s: unknown, ctx: Record<string, unknown>): string {
  if (typeof s !== 'string') return String(s ?? '');
  let out = s;
  for (let i = 0; i < 6; i++) {
    out = out.replace(/\{(\w+)(?:\|([^{}]*))?\}/g, (_, k: string, d?: string) => {
      const v = ctx[k];
      return v !== undefined && v !== null && v !== '' ? String(v) : d || '';
    });
  }
  return out;
}

function speakable(text: string) {
  return text.replace(/\*/g, '').trim();
}

function buildSegments(tpl: Template, video: Record<string, unknown>, product: Record<string, unknown>) {
  const base = { ...product, ...video };
  const segs: Array<Record<string, string>> = [];
  for (const spec of tpl.segments ?? []) {
    if (spec.each) {
      const items = (video[String(spec.each)] as unknown[]) || [];
      items.forEach((raw, idx) => {
        const item =
          Array.isArray(raw)
            ? { text: String(raw[0] ?? ''), source: String(raw[1] ?? '') }
            : typeof raw === 'object' && raw
              ? (raw as { text?: string; source?: string })
              : { text: String(raw) };
        const ctx = { ...base, ...item, n: idx + 1 };
        const seg: Record<string, string> = {};
        for (const [k, v] of Object.entries(spec)) {
          if (k === 'each') continue;
          seg[k] = fill(v, ctx);
        }
        segs.push(seg);
      });
    } else {
      const seg: Record<string, string> = {};
      for (const [k, v] of Object.entries(spec)) seg[k] = fill(v, base);
      if (spec.optional && !seg.say && !seg.text) continue;
      segs.push(seg);
    }
  }
  return segs;
}

function buildVideoFields(tpl: Template, fields: Record<string, unknown>, jobId: string) {
  const video: Record<string, unknown> = { id: jobId, template: fields };
  for (const f of tpl.fields ?? []) {
    const v = fields[f.key];
    if (f.type === 'list') {
      const srcs = f.sources || ['photo:1'];
      const items = (Array.isArray(v) ? v : []).map((x, i) => {
        if (typeof x === 'object' && x && 'text' in x) {
          return [String((x as { text: string }).text), (x as { source?: string }).source || srcs[i % srcs.length]];
        }
        return [String(x), srcs[i % srcs.length]];
      });
      video[f.key] = items;
    } else if (v !== undefined && v !== null && v !== '') {
      video[f.key] = v;
    }
  }
  // flat aliases for fill()
  for (const [k, v] of Object.entries(fields)) {
    if (!Array.isArray(v)) video[k] = v;
  }
  return video;
}

async function ensureCaptionFont() {
  try {
    const { readFile } = await import('node:fs/promises');
    const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'Pretendard-Bold.otf');
    const data = await readFile(fontPath);
    GlobalFonts.register(data, 'WingsCaption');
  } catch {
    /* fallback system font */
  }
}

async function probeDuration(filePath: string): Promise<number> {
  // probeVideo는 Video 해상도까지 요구해서 mp3에 쓸 수 없다 → Duration만 읽는다
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const bundled = (await import('ffmpeg-static')).default;
  const bin = process.env.FFMPEG_PATH || bundled || 'ffmpeg';
  const exec = promisify(execFile);
  let stderr = '';
  try {
    await exec(bin, ['-hide_banner', '-i', filePath], { timeout: 20_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  } catch (err) {
    stderr = String((err as { stderr?: string }).stderr ?? '');
  }
  const dur = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!dur) return 0;
  return Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
}

async function ttsToFile(text: string, outPath: string, voiceLabel: string) {
  const client = openaiClient();
  if (!client) throw new Error('OPENAI_API_KEY가 없어 음성을 만들 수 없어요. Vercel 환경변수에 키를 넣어 주세요.');
  const voice = voiceLabel.includes('남성') ? 'onyx' : 'nova';
  const res = await client.audio.speech.create({
    model: 'tts-1',
    voice,
    input: text.slice(0, 900),
    response_format: 'mp3',
  });
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buf);
}

async function silenceMp3(seconds: number, outPath: string) {
  await ffmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    'anullsrc=r=24000:cl=mono',
    '-t',
    String(Math.max(0.4, seconds)),
    '-q:a',
    '9',
    outPath,
  ]);
}

function even(n: number) {
  return Math.max(2, Math.round(n / 2) * 2);
}

/** 사진 → 지정 길이만큼 천천히 확대되는 무음 클립 */
async function panPhoto(photo: string, outPath: string, seconds: number) {
  const w = even(W);
  const h = even(H);
  const frames = Math.max(CLIP_FPS, Math.round(seconds * CLIP_FPS));
  const filter = [
    `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase`,
    `crop=${w * 2}:${h * 2}`,
    `zoompan=z='1+0.1*on/${frames}':x='(iw-iw/zoom)*on/${frames}':y='(ih-ih/zoom)/2':d=${frames}:s=${w}x${h}:fps=${CLIP_FPS}`,
    'format=yuv420p',
  ].join(',');
  await ffmpeg(
    [
      '-y',
      '-loop',
      '1',
      '-i',
      photo,
      '-vf',
      filter,
      '-frames:v',
      String(frames),
      '-r',
      String(CLIP_FPS),
      '-fps_mode',
      'cfr',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-an',
      '-movflags',
      '+faststart',
      outPath,
    ],
    120_000,
  );
}

async function muxClip(video: string, audio: string, captionPng: string | null, outPath: string, seconds: number) {
  const y = Math.round(H * 0.72);
  if (!captionPng) {
    await ffmpeg(
      [
        '-y',
        '-i',
        video,
        '-i',
        audio,
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-shortest',
        '-movflags',
        '+faststart',
        outPath,
      ],
      90_000,
    );
    return;
  }
  await ffmpeg(
    [
      '-y',
      '-i',
      video,
      '-framerate',
      String(CLIP_FPS),
      '-loop',
      '1',
      '-t',
      String(seconds),
      '-i',
      captionPng,
      '-i',
      audio,
      '-filter_complex',
      `[0:v]format=yuv420p[base];[1:v]format=rgba,fade=t=in:st=0.15:d=0.25:alpha=1[txt];[base][txt]overlay=(W-w)/2:${y}:format=auto,format=yuv420p[out]`,
      '-map',
      '[out]',
      '-map',
      '2:a',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-c:a',
      'aac',
      '-shortest',
      '-movflags',
      '+faststart',
      outPath,
    ],
    120_000,
  );
}

async function concatClips(clips: string[], listFile: string, outPath: string) {
  const body = clips.map((c) => `file '${c.replace(/\\/g, '/')}'`).join('\n');
  await writeFile(listFile, body);
  await ffmpeg(
    [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listFile,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      outPath,
    ],
    180_000,
  );
}

async function renderCards(
  tpl: Template,
  product: Record<string, unknown>,
  fields: Record<string, unknown>,
  photoBuf: Buffer,
  job: SfJob,
  log: (m: string) => Promise<void>,
) {
  await ensureCaptionFont();
  const img = await loadImage(photoBuf);
  const items = (Array.isArray(fields.items) ? fields.items : []).map((x) =>
    typeof x === 'object' && x && 'text' in x ? String((x as { text: string }).text) : String(x),
  );
  const titles = [String(fields.title1 || product.name || ''), String(fields.title2 || '')].filter(Boolean);
  const cards: string[] = [];
  const pages = [
    { badge: '', lines: titles },
    ...items.map((text, i) => ({ badge: String(i + 1), lines: text.includes(',') ? text.split(',', 2).map((s) => s.trim()) : [text] })),
    { badge: '', lines: [String(fields.outro_card || '저장해 두고 장 볼 때 꺼내 보세요'), fill(tpl.info || '', { ...product, ...fields })] },
  ];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const canvas = createCanvas(1080, 1350);
    const ctx = canvas.getContext('2d');
    const scale = Math.max(1080 / img.width, 1350 / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (1080 - dw) / 2, (1350 - dh) / 2, dw, dh);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 900, 1080, 450);
    if (page.badge) {
      ctx.fillStyle = '#f5c518';
      ctx.beginPath();
      ctx.arc(540, 820, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#141414';
      ctx.font = '700 72px WingsCaption, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(page.badge, 540, 845);
    }
    ctx.textAlign = 'center';
    page.lines.forEach((line, li) => {
      ctx.fillStyle = li === 0 ? '#ffffff' : '#f5c518';
      ctx.font = '700 56px WingsCaption, sans-serif';
      ctx.fillText(line.replace(/\*/g, '').slice(0, 28), 540, 1000 + li * 70);
    });
    const file = `${job.product}_${job.id}_${String(i + 1).padStart(2, '0')}.jpg`;
    const url = await saveOutputCard(file, canvas.toBuffer('image/jpeg'));
    cards.push(url);
    await log(`카드 ${i + 1}/${pages.length}`);
  }
  return cards;
}

async function renderVideo(
  tpl: Template,
  product: Record<string, unknown>,
  fields: Record<string, unknown>,
  photoBuf: Buffer,
  job: SfJob,
  log: (m: string) => Promise<void>,
) {
  return withTempDir(async (dir) => {
    const photoPath = path.join(dir, 'photo.jpg');
    await writeFile(photoPath, photoBuf);
    const video = buildVideoFields(tpl, fields, job.id);
    const segs = buildSegments(tpl, video, product);
    if (!segs.length) throw new Error('만들 장면이 없어요. 초안을 다시 만들어 주세요.');

    const clips: string[] = [];
    const scriptLines: string[] = [];
    const voice = String(fields.voice || '여성');

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!;
      const say = speakable(seg.say || '');
      const au = path.join(dir, `${String(i).padStart(2, '0')}_tts.mp3`);
      let dur = 3;
      if (say) {
        await ttsToFile(say, au, voice);
        const audioDur = await probeDuration(au);
        dur = LEAD + (audioDur > 0 ? audioDur : Math.max(2.2, say.length * 0.12)) + PAD;
        scriptLines.push(say);
      } else {
        dur = Number(seg.dur) || 3;
        await silenceMp3(dur, au);
        if (seg.text) scriptLines.push(speakable(seg.text));
      }

      const pan = path.join(dir, `${String(i).padStart(2, '0')}_pan.mp4`);
      await panPhoto(photoPath, pan, dur);
      const capText = speakable(seg.say || seg.text || '');
      const capBuf = capText ? await renderCaptionPng(capText.slice(0, 22), W) : null;
      const capPath = capBuf ? path.join(dir, `${String(i).padStart(2, '0')}_cap.png`) : null;
      if (capBuf && capPath) await writeFile(capPath, capBuf);
      const clip = path.join(dir, `${String(i).padStart(2, '0')}.mp4`);
      await muxClip(pan, au, capPath, clip, dur);
      clips.push(clip);
      await log(`[${seg.kind || 'TIP'}] ${say || seg.text || '(무음)'}`);
    }

    const list = path.join(dir, 'list.txt');
    const outLocal = path.join(dir, 'out.mp4');
    await concatClips(clips, list, outLocal);
    const { readFile } = await import('node:fs/promises');
    const mp4 = await readFile(outLocal);
    const fileName = `${String(product.name || job.product)}_${job.id}.mp4`.replace(/[\\/:*?"<>|]+/g, '_');
    const url = await saveOutputMp4(fileName, mp4);
    return { url, script: scriptLines.join('\n') };
  });
}

export async function runWebJob(jobId: string, templates: Record<string, Template | Record<string, unknown>>) {
  const job = await getJob(jobId);
  if (!job) return;
  await patchJob(jobId, { status: 'running', log: [...(job.log || []), '웹 엔진으로 만들기 시작'] });

  const log = async (m: string) => {
    const cur = await getJob(jobId);
    await patchJob(jobId, { log: [...(cur?.log || []), m] });
  };

  try {
    const product = await readWebProduct(job.product);
    if (!product) throw new Error('상품을 먼저 저장해 주세요');
    const photo = await loadProductPhoto(job.product);
    if (!photo) throw new Error('상품 사진이 없어요');

    let mode = job.mode;
    const fields = { ...job.fields };
    if (fields.motion) {
      await log('배포 웹 엔진에서는 모션그래픽 대신 사진 모드로 만들어요');
      delete fields.motion;
    }
    if (mode !== 'photo') {
      await log('배포 웹 엔진에서는 AI 장면 대신 사진만 모드로 만들어요');
      mode = 'photo';
    }

    const tpl = templates[job.template] as Template | undefined;
    if (!tpl) throw new Error('없는 템플릿이에요');
    if ((tpl as { kind?: string }).kind === '촬영') throw new Error('이 템플릿은 직접 촬영해야 해요');

    if (tpl.output === 'cards') {
      const files = await renderCards(tpl, product as unknown as Record<string, unknown>, fields, photo, job, log);
      await patchJob(jobId, {
        status: 'done',
        finished: new Date().toISOString().slice(0, 16).replace('T', ' '),
        result: { type: 'cards', files },
        fidelity: null,
        used_ai: false,
      });
      return;
    }

    if (job.template === 'clone' || tpl.engine === 'short') {
      // short/clone 도 사진+문장 기반으로 단순 렌더 (segments 없으면 훅·CTA 가짜 세그먼트)
      if (!tpl.segments?.length) {
        (tpl as Template).segments = [
          { kind: 'HOOK', say: '{hook_text}|{hook}|{line1}' },
          { kind: 'CTA', say: '{cta}|{outro}|{line2}' },
        ];
      }
    }

    const { url, script } = await renderVideo(tpl, product, fields, photo, { ...job, fields }, log);
    await patchJob(jobId, {
      status: 'done',
      finished: new Date().toISOString().slice(0, 16).replace('T', ' '),
      result: { type: 'video', file: url, script },
      fidelity: null,
      used_ai: false,
    });
  } catch (err) {
    console.error('[shortform] web render failed', err);
    await patchJob(jobId, {
      status: 'error',
      error: err instanceof Error ? err.message : '만드는 중 문제가 생겼어요',
      finished: new Date().toISOString().slice(0, 16).replace('T', ' '),
    });
  }
}

export function enqueueWebJob(jobId: string, templates: Record<string, Template | Record<string, unknown>>) {
  runInBackground(`shortform:${jobId}`, () => runWebJob(jobId, templates));
}
