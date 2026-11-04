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
import { existsSync, readFileSync } from 'node:fs';
import { generateAiClip, hasAiSceneProvider } from '@/server/shortform/aiScene';
import {
  geminiApiKey,
  isGeminiVoiceLabel,
  resolveGeminiVoice,
  synthesizeGeminiMp3,
} from '@/server/shortform/geminiTts';
import { keyframeAbsPath } from '@/server/shortform/sceneCapture';
import {
  getJob,
  loadProductPhoto,
  patchJob,
  readWebProduct,
  saveOutputCard,
  saveOutputMp4,
  type SfJob,
} from '@/server/shortform/webStore';

const ROLE_KIND: Record<string, string> = {
  HOOK: 'HOOK',
  TIP: 'TIP',
  STEP: 'TIP',
  WRONG: 'TIP',
  RIGHT: 'TIP',
  COMPARE: 'TIP',
  REVEAL: 'REVEAL',
  SHOW: 'TIP',
  CTA: 'CTA',
};

function loadAnalysisJson(id: string): Record<string, unknown> | null {
  const file = path.join(process.cwd(), 'shortform', 'studio', 'data', 'analysis', `${id}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 레퍼런스 키프레임 위에 상품 사진을 크게 올려 한 장의 장면 이미지를 만든다. */
async function compositeSceneFrame(productBuf: Buffer, keyframePath: string | null, outPath: string) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  if (keyframePath && existsSync(keyframePath)) {
    const bg = await loadImage(keyframePath);
    const scale = Math.max(W / bg.width, H / bg.height);
    const dw = bg.width * scale;
    const dh = bg.height * scale;
    ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);
  }
  const prod = await loadImage(productBuf);
  const maxW = W * 0.88;
  const maxH = H * 0.62;
  const s = Math.min(maxW / prod.width, maxH / prod.height);
  const pw = prod.width * s;
  const ph = prod.height * s;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2 - H * 0.04;
  // 살짝 둥근 느낌의 카드
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 40;
  ctx.drawImage(prod, px, py, pw, ph);
  ctx.restore();
  const { writeFile: wf } = await import('node:fs/promises');
  await wf(outPath, canvas.toBuffer('image/jpeg'));
}

/** clone: fields.lines + analysis.scenes → 장면별 초수 영상 */
function buildCloneTemplate(
  analysis: Record<string, unknown> | null,
  fields: Record<string, unknown>,
): Template {
  const scenes = Array.isArray(analysis?.scenes) ? (analysis!.scenes as Array<Record<string, unknown>>) : [];
  const lines = Array.isArray(fields.lines) ? (fields.lines as Array<Record<string, unknown>>) : [];
  const textOnly = fields.voice_mode === 'text_only' || analysis?.voice === 'text_only' || analysis?.voice === 'asmr';
  const segments: Array<Record<string, unknown>> = [];
  const n = Math.max(lines.length, scenes.length);
  for (let i = 0; i < n; i++) {
    const ln = lines[i] || {};
    const s = scenes[i] || {};
    const say = String(ln.say || '');
    if (!say && !textOnly) continue;
    const role = String(ln.role || s.role || 'TIP');
    const seconds = Number(ln.seconds || s.seconds) || 3;
    const measured = Boolean(s.measured || ln.keyframe || s.keyframe);
    const shot = String(s.shot || 'hero');
    const src =
      String(ln.source || '') ||
      (shot === 'origin' ? 'stock:origin' : shot === 'photo' ? 'photo:1' : `ai:${shot}`);
    const seg: Record<string, unknown> = {
      kind: ROLE_KIND[role] || 'TIP',
      source: src,
      label: String(ln.label || s.label || ''),
      ref_frame: String(ln.keyframe || s.keyframe || ''),
      clone_visual: '1',
      target_dur: measured ? seconds : undefined,
    };
    if (textOnly) {
      seg.text = say || String(s.purpose || '');
      seg.dur = measured ? seconds : Math.max(2, Math.min(5, seconds));
    } else {
      seg.say = say;
      if (measured) seg.target_dur = seconds;
    }
    segments.push(seg);
  }
  if (!segments.length) {
    segments.push({ kind: 'HOOK', say: String(fields.title1 || '상품을 소개해요'), source: 'photo:1', dur: 3 });
  }
  return {
    name: '레퍼런스 복제',
    layout: String(analysis?.layout || 'full'),
    title: ['{title1}', '{title2}'],
    info: '{info}',
    segments,
    fields: [
      { key: 'title1', type: 'text' },
      { key: 'title2', type: 'text' },
      { key: 'info', type: 'text' },
    ],
  };
}

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
  // Gemini 키가 있으면 Gemini TTS 우선 (여성/남성 → Kore/Charon, Gemini * 라벨 → 지정 보이스)
  if (geminiApiKey()) {
    const name =
      resolveGeminiVoice(voiceLabel) || (voiceLabel.includes('남성') ? 'Charon' : 'Kore');
    try {
      await synthesizeGeminiMp3(text, name, outPath);
      return;
    } catch (err) {
      if (isGeminiVoiceLabel(voiceLabel)) throw err;
      console.warn('[shortform] Gemini TTS 실패 → OpenAI 폴백', err);
    }
  } else if (isGeminiVoiceLabel(voiceLabel)) {
    throw new Error('GEMINI_API_KEY가 없어요. .env.local에 넣고 서버를 다시 켜 주세요.');
  }

  const client = openaiClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY(권장) 또는 OPENAI_API_KEY를 .env.local에 넣어 주세요.');
  }
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

/** AI/일반 클립을 목표 길이·해상도에 맞춘다 */
async function fitClip(src: string, outPath: string, seconds: number) {
  const w = even(W);
  const h = even(H);
  await ffmpeg(
    [
      '-y',
      '-stream_loop',
      '-1',
      '-i',
      src,
      '-t',
      String(Math.max(0.5, seconds)),
      '-vf',
      `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=${CLIP_FPS},format=yuv420p`,
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-movflags',
      '+faststart',
      outPath,
    ],
    120_000,
  );
}

async function renderVideo(
  tpl: Template,
  product: Record<string, unknown>,
  fields: Record<string, unknown>,
  photoBuf: Buffer,
  job: SfJob,
  log: (m: string) => Promise<void>,
  mode: string = 'photo',
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
    let usedAi = false;

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!;
      const say = speakable(seg.say || '');
      const au = path.join(dir, `${String(i).padStart(2, '0')}_tts.mp3`);
      let dur = 3;
      if (say) {
        await ttsToFile(say, au, voice);
        const audioDur = await probeDuration(au);
        dur = LEAD + (audioDur > 0 ? audioDur : Math.max(2.2, say.length * 0.12)) + PAD;
        const target = Number(seg.target_dur) || 0;
        if (target > dur) dur = target;
        scriptLines.push(say);
      } else {
        dur = Number(seg.dur || seg.target_dur) || 3;
        await silenceMp3(dur, au);
        if (seg.text) scriptLines.push(speakable(seg.text));
      }

      const pan = path.join(dir, `${String(i).padStart(2, '0')}_pan.mp4`);
      let visual = '상품사진';
      const source = String(seg.source || '');
      let aiPath: string | null = null;
      if (mode === 'ai' && source.startsWith('ai:') && hasAiSceneProvider()) {
        aiPath = await generateAiClip(source, product, job.product, photoBuf, log);
      }
      if (aiPath) {
        await fitClip(aiPath, pan, dur);
        usedAi = true;
        visual = `AI:${source.slice(3)}`;
      } else {
        const kf = seg.ref_frame ? keyframeAbsPath(String(seg.ref_frame)) : null;
        if (seg.clone_visual) {
          const frameJpg = path.join(dir, `${String(i).padStart(2, '0')}_frame.jpg`);
          await compositeSceneFrame(photoBuf, kf, frameJpg);
          await panPhoto(frameJpg, pan, dur);
          visual = kf ? '캡처+상품' : '상품';
        } else {
          await panPhoto(photoPath, pan, dur);
        }
      }
      const capText = speakable(seg.say || seg.text || '');
      const capBuf = capText ? await renderCaptionPng(capText.slice(0, 22), W) : null;
      const capPath = capBuf ? path.join(dir, `${String(i).padStart(2, '0')}_cap.png`) : null;
      if (capBuf && capPath) await writeFile(capPath, capBuf);
      const clip = path.join(dir, `${String(i).padStart(2, '0')}.mp4`);
      await muxClip(pan, au, capPath, clip, dur);
      clips.push(clip);
      await log(`[${seg.kind || 'TIP'}] ${dur.toFixed(1)}s ${visual} · ${say || seg.text || '(무음)'}`);
    }

    const list = path.join(dir, 'list.txt');
    const outLocal = path.join(dir, 'out.mp4');
    await concatClips(clips, list, outLocal);
    const { readFile } = await import('node:fs/promises');
    const mp4 = await readFile(outLocal);
    const fileName = `${String(product.name || job.product)}_${job.id}.mp4`.replace(/[\\/:*?"<>|]+/g, '_');
    const url = await saveOutputMp4(fileName, mp4);
    return { url, script: scriptLines.join('\n'), usedAi };
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
      await log('웹 엔진에서는 모션그래픽 대신 기본 자막으로 만들어요');
      delete fields.motion;
    }
    if (mode === 'ai' && !hasAiSceneProvider()) {
      await log('REPLICATE/FAL 키가 없어 사진만 모드로 만들어요');
      mode = 'photo';
    } else if (mode === 'ai') {
      await log('AI 장면 모드 (Replicate)');
    }

    let tpl = templates[job.template] as Template | undefined;

    if (job.template === 'clone') {
      const analysis = job.ref ? loadAnalysisJson(job.ref) : null;
      tpl = buildCloneTemplate(analysis, fields);
      await log(
        analysis?.capture
          ? `장면 ${tpl.segments?.length ?? 0}개 · 레퍼런스 캡처 초수에 맞춰 상품 영상 생성`
          : `장면 ${tpl.segments?.length ?? 0}개 · 상품 사진으로 복제 렌더`,
      );
    }

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

    if (tpl.engine === 'short' && !tpl.segments?.length) {
      tpl.segments = [
        { kind: 'HOOK', say: '{hook_text}|{hook}|{line1}' },
        { kind: 'CTA', say: '{cta}|{outro}|{line2}' },
      ];
    }

    const { url, script, usedAi } = await renderVideo(
      tpl,
      product as unknown as Record<string, unknown>,
      fields,
      photo,
      { ...job, fields },
      log,
      mode,
    );
    await patchJob(jobId, {
      status: 'done',
      finished: new Date().toISOString().slice(0, 16).replace('T', ' '),
      result: { type: 'video', file: url, script },
      fidelity: null,
      used_ai: usedAi,
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
