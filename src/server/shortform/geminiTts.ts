/**
 * Google Gemini TTS — Python voice_gemini.py 와 같은 API·모델·캐시 규칙.
 */
import 'server-only';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ffmpeg } from '@/server/lever/media/ffmpeg';

const API = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent';
const MODELS = ['gemini-3.8-flash-tts', 'gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-preview-tts'];
const RATE = 24_000;

/** UI 라벨 → Gemini prebuilt voiceName */
export const GEMINI_VOICE_MAP: Record<string, string> = {
  'Gemini 여성 · 또렷한': 'Kore',
  'Gemini 여성 · 밝은': 'Zephyr',
  'Gemini 남성 · 활기찬': 'Puck',
  'Gemini 남성 · 차분한': 'Charon',
};

export function geminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export function isGeminiVoiceLabel(label: string) {
  return label.startsWith('Gemini') || label.startsWith('gemini:');
}

export function resolveGeminiVoice(label: string): string | null {
  if (GEMINI_VOICE_MAP[label]) return GEMINI_VOICE_MAP[label];
  if (label.startsWith('gemini:')) return label.slice('gemini:'.length);
  return null;
}

function syllables(text: string) {
  let n = 0;
  for (const c of text) {
    if ((c >= '가' && c <= '힣') || (c >= '0' && c <= '9')) n += 1;
  }
  return n || 1;
}

function sane(pcm: Buffer, text: string) {
  const sec = pcm.length / (RATE * 2);
  const n = syllables(text);
  return n / 14 <= sec && sec <= n / 2.5 + 1.5;
}

function cacheDir() {
  return path.join(process.cwd(), 'shortform', 'studio', 'data', 'tts_cache');
}

async function requestPcm(text: string, voice: string): Promise<{ pcm: Buffer; model: string }> {
  const key = geminiApiKey();
  if (!key) throw new Error('GEMINI_API_KEY 가 없어요. .env.local에 넣어 주세요.');

  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };

  let last: unknown;
  const attempts = [MODELS[0]!, ...MODELS];
  for (const model of attempts) {
    try {
      const res = await fetch(API.replace('{model}', model), {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = (await res.json()) as {
        error?: { message?: string };
        candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
      };
      if (!res.ok) throw new Error(d.error?.message || `Gemini TTS ${res.status}`);
      const b64 = d.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64) throw new Error('오디오 데이터가 비었어요');
      const pcm = Buffer.from(b64, 'base64');
      if (sane(pcm, text)) return { pcm, model };
      last = `${model} 결과 길이가 이상해요(${(pcm.length / (RATE * 2)).toFixed(1)}초)`;
      console.warn('[shortform:geminiTts]', last);
    } catch (e) {
      last = e;
      console.warn('[shortform:geminiTts]', model, e);
    }
  }
  throw new Error(`Gemini 목소리를 만들지 못했어요: ${last instanceof Error ? last.message : String(last)}`);
}

/** text → outPath(mp3). Gemini 캐시 재사용. */
export async function synthesizeGeminiMp3(text: string, voiceName: string, outPath: string) {
  const payload = JSON.stringify([MODELS[0], voiceName, text, 1.0, 'v3']);
  const key = createHash('sha1').update(payload).digest('hex').slice(0, 20);
  const dir = cacheDir();
  await mkdir(dir, { recursive: true });
  const mp3 = path.join(dir, `${key}.mp3`);

  if (!existsSync(mp3)) {
    const { pcm, model } = await requestPcm(text.slice(0, 900), voiceName);
    const raw = path.join(dir, `${key}.pcm`);
    await writeFile(raw, pcm);
    // 앞뒤 무음만 자름 (끝음절 보호)
    const trim = 'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.12';
    const af = `${trim},areverse,${trim},areverse`;
    try {
      await ffmpeg(
        ['-y', '-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', raw, '-af', af, '-ar', '44100', '-b:a', '160k', mp3],
        60_000,
      );
    } finally {
      await unlink(raw).catch(() => null);
    }
    console.log(`[shortform:geminiTts] ${voiceName} (${model})`);
  }

  await copyFile(mp3, outPath);
  // 캐시가 깨진 경우 대비
  if (!existsSync(outPath)) {
    const buf = await readFile(mp3);
    await writeFile(outPath, buf);
  }
}
