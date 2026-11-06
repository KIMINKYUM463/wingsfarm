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
import { renderCaptionPng, renderPunchPng } from '@/server/lever/media/captionPng';
import { CLIP_FPS } from '@/server/lever/media/motion';
import { existsSync, readFileSync } from 'node:fs';
import { generateAiSceneVisual, hasAiSceneProvider } from '@/server/shortform/aiScene';
import { generateFarmerScene, generateUccVideo, type UccRole, type UccWho } from '@/server/shortform/seedance';
import { listProductAssets, materializeProductAsset } from '@/server/shortform/productAssets';
import {
  geminiApiKey,
  isGeminiVoiceLabel,
  resolveGeminiVoice,
  synthesizeGeminiMp3,
  TIGHT_SPEECH_AF,
} from '@/server/shortform/geminiTts';
import { keyframeAbsPath } from '@/server/shortform/sceneCapture';
import { inferShotFromSay } from '@/server/shortform/copywriter';
import { resolveSmartVisual, type RefSceneContext } from '@/server/shortform/smartFill';
import { hashSeed, panFilter, pickIndex } from '@/server/shortform/variety';
import { buildSeamlessVoice, canRunPythonMotion, isLocalDemo, mixBed, overlayMotion, renderPythonMotion } from '@/server/shortform/localStudio';
import { producePlace } from '@/server/lever/media/stockQuery';
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
    // 대본에 적은 shot/visual을 우선 — 영상이 말에 맞게
    const line = say || (textOnly ? String(s.purpose || '') : '');
    const shot = String(ln.shot || '').trim() || inferShotFromSay(line, String(s.shot || 'hero'));
    const src =
      String(ln.source || '') ||
      (shot === 'origin' ? 'stock:origin' : shot === 'photo' ? 'photo:1' : `ai:${shot}`);
    const seg: Record<string, unknown> = {
      kind: ROLE_KIND[role] || 'TIP',
      source: src,
      label: String(ln.label || s.label || ''),
      ref_frame: String(ln.keyframe || s.keyframe || ''),
      clone_visual: '1',
      // 대본은 항상 say에 둔다. text_only여도 문장은 보존 (렌더에서 TTS on/off만 결정)
      say: line,
      shot,
      visual: String(ln.visual || ''),
      purpose: String(ln.visual || s.purpose || ''),
      target_dur: measured ? seconds : undefined,
    };
    if (textOnly) {
      seg.text = line;
      seg.dur = measured ? seconds : Math.max(2, Math.min(5, seconds || 3));
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
  const raw = `${outPath}.raw.mp3`;
  await writeFile(raw, buf);
  await ffmpeg([
    '-y',
    '-i',
    raw,
    '-af',
    TIGHT_SPEECH_AF,
    '-ar',
    '48000',
    '-ac',
    '1',
    '-f',
    'wav',
    '-c:a',
    'pcm_s16le',
    outPath,
  ]).catch(async () => {
    await writeFile(outPath, buf);
  });
}

/** 대사가 있는 장면 길이. 말 길이에 맞추고 앞뒤 여백은 넣지 않는다. */
function speechSeconds(audioDur: number, say: string) {
  if (audioDur > 0.25) return audioDur;
  return Math.max(0.8, say.length * 0.12);
}

async function silenceMp3(seconds: number, outPath: string) {
  await ffmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    'anullsrc=r=48000:cl=mono',
    '-t',
    String(Math.max(0.4, seconds)),
    '-f',
    'wav',
    '-c:a',
    'pcm_s16le',
    outPath,
  ]);
}

function even(n: number) {
  return Math.max(2, Math.round(n / 2) * 2);
}

/** 사진 → 작업·장면마다 다른 방향의 패닝/줌 (무음) */
async function panPhoto(photo: string, outPath: string, seconds: number, seed = 0, sceneIndex = 0) {
  const w = even(W);
  const h = even(H);
  const frames = Math.max(CLIP_FPS, Math.round(seconds * CLIP_FPS));
  const zoom = panFilter(seed, sceneIndex, frames, w, h, CLIP_FPS);
  const filter = [
    `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase`,
    `crop=${w * 2}:${h * 2}`,
    zoom,
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

/** CC 출처를 화면 하단에 작게 넣는다 */
async function burnAttribution(video: string, credit: string, outPath: string, seconds: number) {
  const label = `CC · ${credit.replace(/\n/g, ' ').slice(0, 56)}`;
  const png = await renderCaptionPng(label, Math.round(W * 0.92));
  if (!png) {
    const { copyFile } = await import('node:fs/promises');
    await copyFile(video, outPath);
    return;
  }
  const pngPath = `${outPath}.credit.png`;
  await writeFile(pngPath, png);
  const y = Math.round(H * 0.92);
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
      pngPath,
      '-filter_complex',
      `[0:v]format=yuv420p[base];[1:v]format=rgba,scale=iw*0.85:-1[txt];[base][txt]overlay=(W-w)/2:${y}:format=auto,format=yuv420p[out]`,
      '-map',
      '[out]',
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-t',
      String(seconds),
      '-movflags',
      '+faststart',
      outPath,
    ],
    90_000,
  );
}

/** 음량만 맞춘다. 뒤에 무음을 붙이지 않는다. 끝 '픽'과 장면 사이 공백은 trimClipEdges가 자른다. */
function alignAudioFilter() {
  return 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono';
}

async function muxClip(video: string, audio: string, captionPng: string | null, outPath: string, seconds: number) {
  const y = Math.round(H * 0.72);
  const af = alignAudioFilter();
  const t = String(Math.max(0.5, seconds));
  // 효과음 트랙 없음. -shortest 대신 -t 로 끊겨서 나는 클릭을 막는다.
  if (!captionPng) {
    await ffmpeg(
      [
        '-y',
        '-i',
        video,
        '-i',
        audio,
        '-filter_complex',
        `[1:a]${af}[a]`,
        '-map',
        '0:v',
        '-map',
        '[a]',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-c:a',
        'flac',
        '-t',
        t,
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
      t,
      '-i',
      captionPng,
      '-i',
      audio,
      '-filter_complex',
      `[0:v]format=yuv420p[base];[1:v]format=rgba,fade=t=in:st=0.15:d=0.25:alpha=1[txt];[base][txt]overlay=(W-w)/2:${y}:format=auto,format=yuv420p[out];[2:a]${af}[a]`,
      '-map',
      '[out]',
      '-map',
      '[a]',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-c:a',
      'flac',
      '-t',
      t,
      '-movflags',
      '+faststart',
      outPath,
    ],
    120_000,
  );
}

async function concatClips(clips: string[], listFile: string, outPath: string, durs: number[] = []) {
  // 장면마다 SAR·fps가 다르면 concat이 "parameters do not match"로 죽는다.
  // 붙이기 전에 1080x1920, SAR 1:1, 24fps, 모노 48kHz로 맞춘다.
  const body = clips.map((c) => `file '${c.replace(/\\/g, '/')}'`).join('\n');
  await writeFile(listFile, body);
  if (!clips.length) throw new Error('이어 붙일 장면이 없어요');

  const w = even(W);
  const h = even(H);
  const dir = path.dirname(outPath);
  const videoOnly = path.join(dir, 'video-only.mp4');
  const voice = path.join(dir, 'voice-seamless.wav');
  const args = ['-y'];
  for (const c of clips) args.push('-i', c);
  const parts: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    parts.push(
      `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=${CLIP_FPS},format=yuv420p,setpts=PTS-STARTPTS[v${i}]`,
    );
  }
  parts.push(`${clips.map((_, i) => `[v${i}]`).join('')}concat=n=${clips.length}:v=1:a=0[v]`);
  args.push(
    '-filter_complex',
    parts.join(';'),
    '-map',
    '[v]',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-r',
    String(CLIP_FPS),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    videoOnly,
  );
  await ffmpeg(args, 300_000);
  // 소리는 장면마다 인코딩하지 않고, 0으로 끝난 wav 하나를 영상에 한 번만 붙인다.
  await buildSeamlessVoice(clips, voice);
  await ffmpeg(
    [
      '-y',
      '-i',
      videoOnly,
      '-i',
      voice,
      '-map',
      '0:v',
      '-map',
      '1:a',
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
      outPath,
    ],
    120_000,
  );
  void durs;
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

/**
 * AI/스톡 클립을 목표 길이에 맞춘다.
 * -stream_loop 금지: 짧은 영상이 처음부터 다시 나가 '같은 장면이 두 번'처럼 보인다.
 * 클립이 짧으면 마지막 프레임을 멈춰서 길이를 채운다.
 */
async function fitClip(src: string, outPath: string, seconds: number, seed = 0, sceneIndex = 0, keepAudio = false) {
  const w = even(W);
  const h = even(H);
  const dur = Math.max(0.5, seconds);
  const start = (pickIndex(seed, 25, sceneIndex + 9) / 10).toFixed(1); // 0.0~2.4초
  const args = [
    '-y',
    '-ss',
    start,
    '-i',
    src,
    '-t',
    String(dur),
    '-vf',
    `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=${CLIP_FPS},format=yuv420p,tpad=stop_mode=clone:stop_duration=${Math.ceil(dur) + 2}`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
  ];
  if (keepAudio) args.push('-c:a', 'flac', '-ar', '48000', '-ac', '1');
  else args.push('-an');
  args.push('-movflags', '+faststart', outPath);
  await ffmpeg(args, 120_000);
}

/** *별표* 단어, 없으면 문장 앞 여섯 글자. 참고 영상의 '아삭' '쏙' 자리 */
function punchWord(say: string) {
  const marked = say.match(/\*([^*]{1,8})\*/);
  const raw = (marked?.[1] || say.replace(/\*/g, '')).replace(/[^\p{L}\p{N}]/gu, '');
  return [...raw].slice(0, 6).join('');
}

/** 가운데 큰 글자. keepAudio면 농부 목소리를 유지한다 */
async function burnPunch(video: string, word: string, outPath: string, seconds: number, keepAudio: boolean) {
  const png = await renderPunchPng(word, W);
  if (!png) {
    const { copyFile } = await import('node:fs/promises');
    await copyFile(video, outPath);
    return;
  }
  const pngPath = `${outPath}.punch.png`;
  await writeFile(pngPath, png);
  const args = [
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
    pngPath,
    '-filter_complex',
    `[0:v]format=yuv420p[base];[1:v]format=rgba[txt];[base][txt]overlay=(W-w)/2:(H-h)*36/100:format=auto,format=yuv420p[out]`,
    '-map',
    '[out]',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-t',
    String(seconds),
  ];
  if (keepAudio) args.push('-map', '0:a?', '-c:a', 'flac', '-ar', '48000', '-ac', '1');
  else args.push('-an');
  args.push('-movflags', '+faststart', outPath);
  await ffmpeg(args, 90_000);
}

/** 영상에 이미 있는 목소리(시댄스)를 유지하고 자막만 얹는다 */
async function muxVideoAudio(video: string, captionPng: string | null, outPath: string, seconds: number) {
  const y = Math.round(H * 0.72);
  const af = alignAudioFilter();
  const t = String(Math.max(0.5, seconds));
  if (!captionPng) {
    await ffmpeg(
      [
        '-y',
        '-i',
        video,
        '-filter_complex',
        `[0:a]${af}[a]`,
        '-map',
        '0:v',
        '-map',
        '[a]',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-c:a',
        'flac',
        '-t',
        t,
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
      t,
      '-i',
      captionPng,
      '-filter_complex',
      `[0:v]format=yuv420p[base];[1:v]format=rgba,fade=t=in:st=0.15:d=0.25:alpha=1[txt];[base][txt]overlay=(W-w)/2:${y}:format=auto,format=yuv420p[out];[0:a]${af}[a]`,
      '-map',
      '[out]',
      '-map',
      '[a]',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-c:a',
      'flac',
      '-t',
      t,
      '-movflags',
      '+faststart',
      outPath,
    ],
    120_000,
  );
}

async function ffmpegText(args: string[]) {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const bundled = (await import('ffmpeg-static')).default;
  const bin = process.env.FFMPEG_PATH || bundled || 'ffmpeg';
  const exec = promisify(execFile);
  try {
    const { stderr } = await exec(bin, ['-hide_banner', ...args], {
      timeout: 60_000,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });
    return String(stderr ?? '');
  } catch (err) {
    return String((err as { stderr?: string }).stderr ?? '');
  }
}

function clockSeconds(stderr: string) {
  const dur = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!dur) return 0;
  return Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
}

/**
 * 장면 앞뒤의 무음만 자른다. 말 중간의 쉼은 그대로 둔다.
 * 자른 끝 25ms는 0으로 내려, 장면이 바뀔 때 '픽'이 나지 않게 한다.
 */
async function trimClipEdges(src: string, dest: string) {
  const info = await ffmpegText(['-i', src, '-af', 'silencedetect=noise=-36dB:d=0.12', '-f', 'null', '-']);
  const duration = clockSeconds(info);
  if (!(duration > 0.2)) {
    const { copyFile } = await import('node:fs/promises');
    await copyFile(src, dest);
    return;
  }
  const starts = [...info.matchAll(/silence_start:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
  const ends = [...info.matchAll(/silence_end:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
  let start = 0;
  let end = duration;
  if (starts[0] !== undefined && starts[0] < 0.08 && ends[0] !== undefined && ends[0] > starts[0]) {
    start = Math.max(0, ends[0] - 0.02);
  }
  const lastStart = starts[starts.length - 1];
  const lastEnd = ends[ends.length - 1];
  const trailingOpen = lastStart !== undefined && ends.length < starts.length;
  const trailingToEnd = lastStart !== undefined && lastEnd !== undefined && lastEnd >= duration - 0.08;
  // 무음이 시작되기 20ms 앞에서 자른다. '픽'은 무음 직전의 짧은 충격음이라 그 지점에 있다.
  if ((trailingOpen || trailingToEnd) && lastStart > start + 0.2) end = Math.max(start + 0.2, lastStart - 0.02);
  const keep = end - start;
  const fade = 0.035;
  if (!(keep > 0.3) || (start < 0.03 && duration - end < 0.1)) {
    const st = Math.max(0, duration - fade);
    await ffmpeg(
      ['-y', '-i', src, '-af', `afade=t=out:st=${st.toFixed(3)}:d=${fade}`, '-c:v', 'copy', '-c:a', 'flac', dest],
      60_000,
    );
    return;
  }
  const st = Math.max(0, keep - fade);
  await ffmpeg(
    [
      '-y',
      '-i',
      src,
      '-filter_complex',
      `[0:v]trim=start=${start.toFixed(3)}:duration=${keep.toFixed(3)},setpts=PTS-STARTPTS[v];[0:a]atrim=start=${start.toFixed(3)}:duration=${keep.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${st.toFixed(3)}:d=${fade}[a]`,
      '-map',
      '[v]',
      '-map',
      '[a]',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'flac',
      '-ar',
      '48000',
      '-ac',
      '1',
      dest,
    ],
    90_000,
  );
}

function refKeywordsFromAnalysis(analysis: Record<string, unknown> | null): string[] {
  if (!analysis) return [];
  const meta = (analysis.meta || {}) as Record<string, unknown>;
  const title = String(meta.title || '');
  const words = title
    .split(/[\s|/·,，、\-–—]+/)
    .map((w) => w.replace(/[^\w가-힣]/g, ''))
    .filter((w) => w.length >= 2 && !/^(법|하는|고르는|이렇게|진짜|최고|꿀팁|shorts?)$/i.test(w));
  return words.slice(0, 6);
}

function refContextForScene(
  analysis: Record<string, unknown> | null,
  sceneIndex: number,
  seg: Record<string, unknown>,
  scriptLine = '',
): RefSceneContext | null {
  if (!analysis && !seg && !scriptLine) return null;
  const scenes = Array.isArray(analysis?.scenes) ? (analysis!.scenes as Array<Record<string, unknown>>) : [];
  const s = scenes[sceneIndex] || {};
  const meta = (analysis?.meta || {}) as Record<string, unknown>;
  const scriptWords = scriptLine
    .replace(/\*/g, '')
    .split(/[\s,/·|]+/)
    .map((w) => w.replace(/[^\w가-힣]/g, ''))
    .filter((w) => w.length >= 2);
  const visual = String(seg.visual || '').trim();
  const shot =
    String(seg.shot || '').trim() ||
    String(s.shot || seg.source || '').replace(/^(ai|stock|photo|upload):/, '') ||
    'hero';
  return {
    title: String(meta.title || ''),
    purpose: String(seg.purpose || s.purpose || ''),
    text: String(s.text || ''),
    script: scriptLine.replace(/\*/g, '').slice(0, 80),
    shot,
    keywords: uniqueWords([
      ...refKeywordsFromAnalysis(analysis),
      ...scriptWords,
      ...visual.split(/\s+/).filter((w) => w.length >= 2),
    ]).slice(0, 10),
  };
}

function uniqueWords(words: string[]) {
  return [...new Set(words.filter(Boolean))];
}

type ShotPlan = { shot: string; angle: string; ban: string };

/** 대본이 비슷해도 장면 구도는 겹치지 않게 고른다. 확대·부감·손질·완성 컷을 나눈다. */
function planShot(say: string, index: number, total: number, where: 'sea' | 'meat' | 'farm', taken: Set<string>): ShotPlan {
  const t = say.replace(/\*/g, '');
  const ladder: ShotPlan[] =
    where === 'sea'
      ? [
          { shot: 'hero', angle: 'wide fish-market stall, many crabs in blue boxes', ban: 'sink, faucet, price tag, won, numbers' },
          { shot: 'prep', angle: 'close-up, water rinsing one crab, slow zoom in', ban: 'knife, shears, price tag, won' },
          { shot: 'detail', angle: 'macro, kitchen shears cutting one leg, fill the frame', ban: 'faucet, sink, running water, price tag' },
          { shot: 'hook', angle: 'top-down, knife cutting legs into bite-size pieces on a board', ban: 'faucet, sink, price tag, won' },
          { shot: 'crave', angle: 'cooked pieces on a plate, chopsticks, tight food photo', ban: 'price tag, won, numbers, sink, faucet' },
          { shot: 'origin', angle: 'fishing boat deck, crab in a blue box, sea behind, wide', ban: 'sink, kitchen, price tag' },
        ]
      : where === 'meat'
        ? [
            { shot: 'hero', angle: 'wide butcher counter', ban: 'price tag, won' },
            { shot: 'detail', angle: 'macro of marbling, fill the frame', ban: 'price tag' },
            { shot: 'prep', angle: 'close-up knife slicing on a board', ban: 'price tag' },
            { shot: 'crave', angle: 'grilled pieces on a plate', ban: 'price tag, won' },
            { shot: 'hold', angle: 'hand holding one cut toward camera', ban: 'price tag' },
          ]
        : [
            { shot: 'hero', angle: 'wide crate in the orchard', ban: 'price tag, won' },
            { shot: 'origin', angle: 'fruit still on the tree, wide', ban: 'price tag' },
            { shot: 'detail', angle: 'macro of the skin, fill the frame', ban: 'price tag' },
            { shot: 'prep', angle: 'close-up cutting on a board', ban: 'price tag' },
            { shot: 'crave', angle: 'a bite lifted to the camera', ban: 'price tag, won' },
            { shot: 'hold', angle: 'hand holding one piece', ban: 'price tag' },
          ];
  let pick = index % ladder.length;
  if (/씻|헹구|흐르는/.test(t)) pick = Math.max(0, ladder.findIndex((s) => s.shot === 'prep'));
  else if (/썰|한\s*입|크기/.test(t)) pick = Math.max(0, ladder.findIndex((s) => s.shot === 'hook'));
  else if (/손질|가위/.test(t) && !/쉽|생각/.test(t)) pick = Math.max(0, ladder.findIndex((s) => s.shot === 'detail'));
  else if (index === total - 1) pick = Math.max(0, ladder.findIndex((s) => s.shot === 'crave'));
  else if (index === 0) pick = 0;
  let guard = 0;
  while (taken.has(`${ladder[pick]!.shot}`) && guard < ladder.length) {
    pick = (pick + 1) % ladder.length;
    guard += 1;
  }
  const chosen = ladder[pick]!;
  taken.add(chosen.shot);
  const zoom = ['wide', 'slow zoom-in close-up', 'macro', 'top-down', 'side angle'][index % 5];
  return { ...chosen, angle: `${chosen.angle}. Lens: ${zoom}` };
}

function uccRoleOf(fields: Record<string, unknown>, product: Record<string, unknown>): UccRole {
  const picked = String(fields.ucc_role || 'auto');
  if (picked === 'fisher' || picked === 'farmer') return picked;
  const blob = `${product.category || ''} ${product.name || ''}`;
  return /수산|해산|어부|게|생선|새우|오징어|굴|전복|문어|낙지|홍어|갈치|연어|꽃게|대게/.test(blob) ? 'fisher' : 'farmer';
}

/** 상품에 올려 둔 영상에서 1초 지점 한 장을 뽑아 산지 사진의 구도 참고로 쓴다 */
async function uploadHintFrame(folder: string, dir: string, log: (m: string) => Promise<void>) {
  try {
    const assets = await listProductAssets(folder);
    const vid = assets.find((a) => a.kind === 'video');
    if (!vid) return null;
    const mat = await materializeProductAsset(folder, vid.id, dir);
    if (!mat || mat.kind !== 'video') return null;
    const frame = path.join(dir, 'upload-hint.jpg');
    await ffmpeg(['-y', '-ss', '1', '-i', mat.path, '-frames:v', '1', frame], 30_000);
    const { readFile } = await import('node:fs/promises');
    await log(`올린 영상 구도를 참고해요: ${mat.name}`);
    return await readFile(frame);
  } catch (err) {
    await log(`올린 영상 프레임은 건너뛰어요: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function renderVideo(
  tpl: Template,
  product: Record<string, unknown>,
  fields: Record<string, unknown>,
  photoBuf: Buffer,
  job: SfJob,
  log: (m: string) => Promise<void>,
  mode: string = 'photo',
  analysis: Record<string, unknown> | null = null,
) {
  return withTempDir(async (dir) => {
    const photoPath = path.join(dir, 'photo.jpg');
    await writeFile(photoPath, photoBuf);
    const video = buildVideoFields(tpl, fields, job.id);
    const segs = buildSegments(tpl, video, product);
    if (!segs.length) throw new Error('만들 장면이 없어요. 초안을 다시 만들어 주세요.');

    const clips: string[] = [];
    const sceneDurs: number[] = [];
    const motionScenes: { video: string; audioFrom: string; say: string; kind: string; seconds: number; label?: string }[] = [];
    const place = producePlace(String(product.name || ''), String(product.category || ''));
    const takenShots = new Set<string>();
    const placeName = place === 'sea' ? '배·어시장·손질대' : place === 'meat' ? '정육점' : '밭·과수원';
    const wantOverlay = isLocalDemo() && fields.motion !== false && canRunPythonMotion();
    const scriptLines: string[] = [];
    const sources: Array<{ scene: number; label: string; attribution?: string }> = [];
    const voice = String(fields.voice || '여성');
    const textOnly = fields.voice_mode === 'text_only';
    const seed = hashSeed(job.id);
    const usedVisuals = new Set<string>();
    let usedAi = false;
    let look = String(fields.look || '');
    const uploadFrame = look === 'origin' || look === 'farmer' || look === 'ucc' ? await uploadHintFrame(job.product, dir, log) : null;
    await log(
      look === 'ucc'
        ? 'UCC · 시니어 소개를 시댄스 2.5로 15초, 480p로 만들어요'
        : look === 'farmer'
        ? '농부 소개 · 시댄스 2.5로 말하고, 짧은 글자를 가운데 올려요'
        : look === 'origin'
          ? `상품 사진 → 영상 · ${placeName}에서 대본에 맞는 장면을 만들고, 글자 모션을 올려요`
          : mode === 'smart'
            ? `똑똑하게 채우기 · 키워드와 같은 품목만 쓰고, 없으면 상품 사진으로 AI 영상을 만들어요`
            : `이번 작업 시드 ${seed} · 장면·카메라가 달라져요`,
    );
    if (textOnly) {
      await log('말하기=자막+음악만 → TTS(음성) 없이 자막만 넣어요. 내레이션이 필요하면 ‘내레이션’으로 바꿔 주세요.');
    }

    if (look === 'ucc') {
      const script = segs
        .map((s) => speakable(String(s.say || s.text || '')))
        .filter(Boolean)
        .join(' ');
      const who: UccWho = fields.ucc_who === 'woman' ? 'woman' : 'man';
      const role = uccRoleOf(fields, product);
      const ucc = await generateUccVideo(product, job.product, photoBuf, script, who, role, log, uploadFrame);
      if (ucc) {
        const pan = path.join(dir, 'ucc.mp4');
        await fitClip(ucc.path, pan, ucc.seconds, seed, 0, true);
        let videoForMux = pan;
        const word = punchWord(script);
        if (word) {
          const punched = path.join(dir, 'ucc-punch.mp4');
          await burnPunch(pan, word, punched, ucc.seconds, true);
          videoForMux = punched;
          await log(`강조 글자: ${word}`);
        }
        const capText = speakable(script).slice(0, 22);
        const capBuf = capText ? await renderCaptionPng(capText, W) : null;
        const capPath = capBuf ? path.join(dir, 'ucc-cap.png') : null;
        if (capBuf && capPath) await writeFile(capPath, capBuf);
        const clip = path.join(dir, 'ucc-final.mp4');
        await muxVideoAudio(videoForMux, capPath, clip, ucc.seconds);
        const tight = path.join(dir, 'ucc-tight.mp4');
        await trimClipEdges(clip, tight);
        let finished = tight;
        if (isLocalDemo()) {
          const bed = path.join(dir, 'ucc-bed.mp4');
          try {
            if (await mixBed(tight, bed, [ucc.seconds], String(fields.music || ''), seed, log)) finished = bed;
          } catch (err) {
            await log(`효과음·배경음악은 건너뛰어요: ${err instanceof Error ? err.message : err}`);
          }
        }
        const { readFile } = await import('node:fs/promises');
        const mp4 = await readFile(finished);
        const fileName = `${String(product.name || job.product)}_${job.id}.mp4`.replace(/[\\/:*?"<>|]+/g, '_');
        const url = await saveOutputMp4(fileName, mp4);
        return {
          url,
          script,
          usedAi: true,
          sources: [{ scene: 1, label: 'UCC', attribution: `AI · Seedance 2.5 UCC ${ucc.seconds}초` }],
        };
      }
      await log(`UCC를 못 만들었어요. ${String(product.name || '상품')}은 ${placeName}에서, 대사에 맞는 장면으로 채워요`);
      look = 'origin';
    }

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!;
      const say = speakable(String(seg.say || seg.text || ''));
      const au = path.join(dir, `${String(i).padStart(2, '0')}_tts.wav`);
      let dur = 3;
      if (say && !textOnly && look !== 'farmer') {
        await ttsToFile(say, au, voice);
        const audioDur = await probeDuration(au);
        dur = speechSeconds(audioDur, say);
        scriptLines.push(say);
      } else {
        dur = Number(seg.dur || seg.target_dur) || Math.max(2.5, say ? say.length * 0.12 : 3);
        await silenceMp3(dur, au);
        if (say) scriptLines.push(say);
      }

      const pan = path.join(dir, `${String(i).padStart(2, '0')}_pan.mp4`);
      let visual = '상품사진';
      const source = String(seg.source || '');
      let filled = false;
      let attribution = '';
      let keepAudio = false;

      if (look === 'farmer') {
        const farm = await generateFarmerScene(product, job.product, photoBuf, say, dur, i, log, uploadFrame);
        if (farm) {
          dur = farm.seconds;
          await fitClip(farm.path, pan, dur, seed, i, true);
          keepAudio = true;
          filled = true;
          usedAi = true;
          visual = '농부소개';
          attribution = 'AI · Seedance 2.5 농부 소개';
        } else {
          await log(`장면${i + 1} 농부 소개 실패 → ${placeName} 영상으로`);
          if (say && !textOnly) {
            await ttsToFile(say, au, voice);
            const audioDur = await probeDuration(au);
            dur = speechSeconds(audioDur, say);
          }
        }
      }
      if (!filled && (look === 'origin' || look === 'farmer')) {
        const plan = planShot(say, i, segs.length, place, takenShots);
        const shot = plan.shot;
        await log(`장면${i + 1} 구도 · ${shot} · ${plan.angle}`);
        const ai = await generateAiSceneVisual(`ai:${shot}`, product, job.product, photoBuf, log, {
          script: say,
          seconds: dur,
          sceneIndex: i,
          visual: String(seg.visual || ''),
          style: 'origin',
          extraImages: uploadFrame ? [uploadFrame] : [],
          angle: plan.angle,
          ban: plan.ban,
        });
        if (ai?.kind === 'video') {
          usedVisuals.add(ai.path);
          await fitClip(ai.path, pan, dur, seed, i);
          usedAi = true;
          visual = place === 'sea' ? '수산영상' : place === 'meat' ? '정육영상' : '산지영상';
          filled = true;
          attribution = `AI · ${placeName}에서 만든 영상`;
        } else if (ai?.kind === 'image') {
          usedVisuals.add(ai.path);
          await panPhoto(ai.path, pan, dur, seed, i);
          usedAi = true;
          visual = place === 'sea' ? '수산사진' : place === 'meat' ? '정육사진' : '산지사진';
          filled = true;
          attribution = `AI · ${placeName} 사진 패닝`;
        }
      }

      if (!filled && (mode === 'smart' || source.startsWith('upload:')) && source) {
        const refCtx = refContextForScene(analysis, i, seg, say);
        const smart = await resolveSmartVisual(
          source,
          product,
          job.product,
          photoBuf,
          log,
          job.id,
          refCtx,
          { sceneIndex: i, avoidPaths: usedVisuals, seconds: dur },
        );
        if (smart?.kind === 'video') {
          usedVisuals.add(smart.path);
          await fitClip(smart.path, pan, dur, seed, i);
          visual = smart.label;
          usedAi = usedAi || smart.usedAi;
          filled = true;
          attribution = smart.attribution || '';
        } else if (smart?.kind === 'image') {
          usedVisuals.add(smart.path);
          await panPhoto(smart.path, pan, dur, seed, i);
          visual = smart.label;
          filled = true;
          attribution = smart.attribution || '';
        }
      } else if (!filled && mode === 'ai' && source.startsWith('ai:') && hasAiSceneProvider()) {
        const ai = await generateAiSceneVisual(source, product, job.product, photoBuf, log, {
          script: say,
          seconds: dur,
          sceneIndex: i,
        });
        if (ai?.kind === 'video') {
          usedVisuals.add(ai.path);
          await fitClip(ai.path, pan, dur, seed, i);
          usedAi = true;
          visual = `AI영상:${source.slice(3)}`;
          filled = true;
          attribution = `AI 생성 영상 · 예상 ${ai.seconds}s`;
        } else if (ai?.kind === 'image') {
          usedVisuals.add(ai.path);
          await panPhoto(ai.path, pan, dur, seed, i);
          usedAi = true;
          visual = `AI사진:${source.slice(3)}`;
          filled = true;
          attribution = `AI 이미지 · ${dur.toFixed(1)}초 패닝`;
        }
      }

      if (!filled) {
        const kf = seg.ref_frame ? keyframeAbsPath(String(seg.ref_frame)) : null;
        if (seg.clone_visual) {
          const frameJpg = path.join(dir, `${String(i).padStart(2, '0')}_frame.jpg`);
          await compositeSceneFrame(photoBuf, kf, frameJpg);
          await panPhoto(frameJpg, pan, dur, seed, i);
          visual = kf ? '캡처+상품' : '상품';
          attribution = '상품 사진' + (kf ? ' + 레퍼런스 구도' : '');
        } else {
          await panPhoto(photoPath, pan, dur, seed, i);
          attribution = '상품 사진';
        }
      }
      sources.push({
        scene: i + 1,
        label: visual,
        attribution: attribution || undefined,
      });
      let videoForMux = pan;
      const word = look === 'origin' || look === 'farmer' ? punchWord(say) : '';
      if (word) {
        const punched = path.join(dir, `${String(i).padStart(2, '0')}_punch.mp4`);
        await burnPunch(pan, word, punched, dur, keepAudio);
        videoForMux = punched;
        await log(`강조 글자: ${word}`);
      }
      if (attribution && filled && !word) {
        const credited = path.join(dir, `${String(i).padStart(2, '0')}_credited.mp4`);
        await burnAttribution(videoForMux, attribution, credited, dur);
        await log(`출처 표시: ${attribution.slice(0, 80)}`);
        videoForMux = credited;
      }
      const capText = speakable(seg.say || seg.text || '');
      const capBuf = capText ? await renderCaptionPng(capText.slice(0, 22), W) : null;
      const capPath = capBuf ? path.join(dir, `${String(i).padStart(2, '0')}_cap.png`) : null;
      if (capBuf && capPath) await writeFile(capPath, capBuf);
      const clip = path.join(dir, `${String(i).padStart(2, '0')}.mp4`);
      if (keepAudio) {
        try {
          await muxVideoAudio(videoForMux, capPath, clip, dur);
        } catch (err) {
          await log(`농부 목소리를 붙이지 못해 내레이션으로 바꿔요: ${err instanceof Error ? err.message : err}`);
          if (!existsSync(au)) await silenceMp3(dur, au);
          await muxClip(videoForMux, au, capPath, clip, dur);
        }
      } else {
        await muxClip(videoForMux, au, capPath, clip, dur);
      }
      const tight = path.join(dir, `${String(i).padStart(2, '0')}_tight.mp4`);
      await trimClipEdges(clip, tight);
      const tightDur = (await probeDuration(tight)) || dur;
      sceneDurs.push(tightDur);
      clips.push(tight);
      if (wantOverlay && !keepAudio && say && existsSync(pan)) {
        motionScenes.push({
          video: pan,
          audioFrom: tight,
          say,
          kind: String(seg.kind || 'TIP'),
          seconds: tightDur,
          label: /손질|씻|썰|자르/.test(say) ? '손질' : undefined,
        });
      }
      await log(`[${seg.kind || 'TIP'}] ${dur.toFixed(1)}s ${visual} · ${say || seg.text || '(무음)'}`);
    }

    const list = path.join(dir, 'list.txt');
    const outLocal = path.join(dir, 'out.mp4');
    await concatClips(clips, list, outLocal, sceneDurs);
    let finished = outLocal;
    if (wantOverlay && motionScenes.length === segs.length) {
      const motionOut = path.join(dir, 'motion.mp4');
      if (await overlayMotion(
        job.id,
        motionScenes,
        {
          title1: String(fields.title1 || product.name || ''),
          title2: String(fields.title2 || ''),
          info: String(fields.info || ''),
          aiLabel: fields.ai_label !== false,
          music: String(fields.music || ''),
          motionStyle: String(fields.motion_style || 'clean'),
        },
        motionOut,
        log,
      )) {
        finished = motionOut;
      }
    }
    if (finished === outLocal && isLocalDemo()) {
      const bed = path.join(dir, 'bed.mp4');
      try {
        if (await mixBed(outLocal, bed, sceneDurs, String(fields.music || ''), seed, log)) finished = bed;
      } catch (err) {
        await log(`효과음·배경음악은 건너뛰어요: ${err instanceof Error ? err.message : err}`);
      }
    }
    const { readFile } = await import('node:fs/promises');
    const mp4 = await readFile(finished);
    const fileName = `${String(product.name || job.product)}_${job.id}.mp4`.replace(/[\\/:*?"<>|]+/g, '_');
    const url = await saveOutputMp4(fileName, mp4);
    return { url, script: scriptLines.join('\n'), usedAi, sources };
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
    if (fields.motion && !isLocalDemo()) {
      await log('웹 서버에서는 모션그래픽 대신 기본 자막으로 만들어요');
      delete fields.motion;
    } else if (isLocalDemo() && fields.motion !== false) {
      const lookNow = String(fields.look || '');
      await log(
        lookNow === 'ucc' || lookNow === 'farmer' || lookNow === 'origin'
          ? '장면 영상을 만든 뒤 그 위에 글자 모션을 올려요. 장면 끝 효과음은 넣지 않아요'
          : '이 PC에서 모션그래픽을 먼저 시도해요. 장면 끝 효과음은 넣지 않아요',
      );
    }
    if (mode === 'ai' && !hasAiSceneProvider()) {
      await log('REPLICATE/FAL 키가 없어 사진만 모드로 만들어요');
      mode = 'photo';
    } else if (mode === 'ai') {
      await log('AI 장면 모드 (Replicate)');
    } else if (mode === 'smart') {
      await log('똑똑하게 채우기 · 내 업로드 → 스톡 → 사진 → AI → 상품 순');
    }

    let tpl = templates[job.template] as Template | undefined;
    let analysis: Record<string, unknown> | null = job.ref ? loadAnalysisJson(job.ref) : null;

    if (job.template === 'clone') {
      tpl = buildCloneTemplate(analysis, fields);
      await log(
        analysis?.capture
          ? `장면 ${tpl.segments?.length ?? 0}개 · 레퍼런스 캡처 초수에 맞춰 상품 영상 생성`
          : `장면 ${tpl.segments?.length ?? 0}개 · 상품 사진으로 복제 렌더`,
      );
      if (mode === 'smart') {
        await log('레퍼런스 장면(자르기·클로즈업 등)과 비슷한 무료 스톡을 상품명으로 검색해요');
      }
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

    if (isLocalDemo() && fields.motion !== false) {
      const py = await renderPythonMotion(job, tpl, log);
      if (py) {
        const { readFile } = await import('node:fs/promises');
        const mp4 = await readFile(py);
        const fileName = `${String(product.name || job.product)}_${job.id}.mp4`.replace(/[\\/:*?"<>|]+/g, '_');
        const url = await saveOutputMp4(fileName, mp4);
        await patchJob(jobId, {
          status: 'done',
          finished: new Date().toISOString().slice(0, 16).replace('T', ' '),
          result: { type: 'video', file: url, script: '' },
          fidelity: null,
          used_ai: mode === 'ai',
        });
        return;
      }
    }

    const { url, script, usedAi, sources } = await renderVideo(
      tpl,
      product as unknown as Record<string, unknown>,
      fields,
      photo,
      { ...job, fields },
      log,
      mode,
      analysis,
    );
    await patchJob(jobId, {
      status: 'done',
      finished: new Date().toISOString().slice(0, 16).replace('T', ' '),
      result: { type: 'video', file: url, script, sources },
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
