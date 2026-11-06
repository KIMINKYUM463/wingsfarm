/**
 * Replicate로 상품 사진 → AI 장면 이미지 → (대본 길이에 맞춘) 영상.
 * 영상 생성 실패 시 이미지만 반환해 호출측이 초 단위로 패닝한다.
 */
import 'server-only';
import { createHash } from 'node:crypto';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { produceIdentity, producePlace, type ProducePlace } from '@/server/lever/media/stockQuery';

export const REPLICATE_IMAGE = 'google/nano-banana-pro';
const REPLICATE_VIDEO = 'kwaivgi/kling-v2.5-turbo-pro';

const STYLE =
  'photorealistic vertical 9:16 food commercial shot, natural daylight, appetizing, shallow depth of field, ' +
  'no text, no logos, no watermark. Keep the product looking exactly like the reference image.';

type ShotPair = [string, string];

type PlaceLook = { style: string; negative: string; shots: Record<string, ShotPair>; label: string };

/** 품목이 나와야 할 장소. 수산물은 배·어시장·손질대이고, 과수원 문구는 과일만 쓴다. */
function placeLook(place: ProducePlace): PlaceLook {
  if (place === 'sea') {
    return {
      label: '수산 현장',
      style:
        'Casual vertical 9:16 smartphone photo at a Korean fishing boat, wet fish market, or home kitchen. ' +
        'Blue fish boxes, wet deck, crushed ice, stainless prep table, running water. ' +
        'NOT an orchard, NOT a mountain, NOT a dirt field, NOT yellow farm crates, NOT fruit trees. ' +
        'No text, no logo, no watermark. The seafood must match the reference photo exactly.',
      negative: 'orchard, mountain, fruit tree, yellow crate, soil field, farm, cantaloupe, melon, text, watermark, price tag, won, currency, distorted',
      shots: {
        hook: [
          'Top-down photo of a knife cutting this {en} into bite-size pieces on a wooden board, pieces already cut beside the knife',
          'The knife finishes one cut, pieces separate, slow push-in, no faucet',
        ],
        origin: [
          'This {en} in a blue fish box on a fishing boat deck, sea and ropes behind, morning light',
          'Slow handheld push-in on the wet deck, no mountains and no trees',
        ],
        hero: [
          'A pile of this {en} on crushed ice at a Korean fish market stall',
          'Slow push-in across the market display, no orchard',
        ],
        hold: [
          'A fisherman hand holding this {en} up, boat or market blurred behind',
          'The hand turns it slightly, phone camera drifts',
        ],
        crave: [
          'Cooked pieces of this {en} on a small plate with chopsticks, kitchen table, light steam',
          'Chopsticks lift one piece toward the camera',
        ],
        detail: [
          'Macro photo of kitchen shears cutting one leg of this {en} on a dry steel table, no faucet in frame',
          'The shears close through the leg, tight close-up, no sink basin',
        ],
        pack: [
          'Hands placing this {en} into a styrofoam seafood box with ice',
          'The lid starts to close, slow push-in',
        ],
        prep: [
          'Close-up of hands rinsing only this {en} under a running tap, water and shell fill the frame',
          'Water keeps running over the shell, slow push-in, no knife and no shears',
        ],
        store: [
          'This {en} in a refrigerator drawer, cool kitchen light',
          'The drawer slides open slowly',
        ],
        photo: [
          'One {en} on a wet market table, smartphone photo, no farm background',
          'Slight handheld sway, the seafood stays sharp',
        ],
      },
    };
  }
  if (place === 'meat') {
    return {
      label: '정육',
      style:
        'Casual vertical 9:16 smartphone photo in a Korean butcher shop or home kitchen. Steel counter, warm light. ' +
        'NOT an orchard, NOT a mountain. No text, no logo. The meat must match the reference photo exactly.',
      negative: 'orchard, mountain, fruit tree, seafood, crab, text, watermark, distorted',
      shots: {
        hook: ['Close photo of this {en} on a butcher block', 'A hand tilts the cut toward the camera'],
        prep: ['Hands slicing this {en} on a wooden board', 'The knife moves, slow handheld'],
        hero: ['This {en} arranged on a butcher counter', 'Slow push-in'],
        crave: ['Grilled pieces of this {en} on a plate', 'Chopsticks lift one piece'],
        photo: ['One cut of this {en} on butcher paper', 'Slight handheld sway'],
      },
    };
  }
  return {
    label: '산지',
    style:
      'Casual vertical 9:16 smartphone photo at a real Korean farm or orchard in daylight. ' +
      'Soil, leaves, yellow plastic crates, weathered hands. Not a studio, no text, no logo. ' +
      'The produce must match the reference photo exactly.',
    negative: 'text, watermark, distorted, flower bouquet, fashion, handbag, cantaloupe, honeydew',
    shots: {
      hook: [
        'Close smartphone photo of this {en} cut open on a farm crate, fresh flesh, outdoor light',
        'A hand tilts the cut fruit toward the camera, slight handheld shake',
      ],
      origin: [
        'This {en} on the tree or in the field at a Korean farm, morning light',
        'Slow handheld push-in toward the produce',
      ],
      hero: [
        'Yellow farm crate half full of this {en}, trees behind',
        'Slow handheld move toward the crate',
      ],
      hold: [
        'A farmer hand holding one {en}, orchard blurred behind',
        'The hand turns the fruit a little',
      ],
      crave: [
        'A bite of this {en} lifted above a farm table',
        'The bite lifts toward the camera',
      ],
      detail: [
        'Macro photo of the skin of this {en} with water droplets',
        'Tiny camera drift across the skin',
      ],
      pack: [
        'Hands placing this {en} into a cardboard box at the farm',
        'Slow push-in as the last one is set in',
      ],
      prep: [
        'This {en} rinsed under running water in a farm sink',
        'Water runs over the fruit, handheld camera',
      ],
      store: [
        'This {en} in a farm cooler drawer',
        'The drawer slides open slowly',
      ],
      photo: [
        'One {en} in a farmer hand, orchard background',
        'Slight handheld sway',
      ],
    },
  };
}

const AI_SHOTS: Record<string, Record<string, ShotPair>> = {
  과일: {
    hook: [
      'This {en} cut in half on a rustic wooden cutting board, fresh juicy flesh glistening, water droplets',
      'A knife finishes slicing through and the halves fall open, juice glistens, slow push-in, slow motion',
    ],
    detail: [
      'Macro close-up of the skin of this {en} covered in fresh water droplets',
      'Slow camera orbit, water droplets slide down the skin, soft light flicker',
    ],
    crave: [
      'A hand holding a bite-sized slice of this {en} toward the camera, juicy flesh',
      'The hand slowly lifts the slice toward the camera, a drop of juice falls, slight handheld motion',
    ],
    hero: [
      'A wooden crate full of fresh {en} on a farm table, warm sunlight, green leaves around',
      'Slow dolly-in toward the crate, sunlight flares gently, leaves sway',
    ],
    hold: [
      'A hand picking up one whole {en} from a pile and weighing it in the palm',
      'The hand lifts and turns it slightly, slow push-in',
    ],
    pack: [
      'Top view of hands placing whole {en} one by one into a brown delivery box, neat rows',
      'The hands place the last one into the box, slow push-in',
    ],
    store: [
      'Whole {en} placed neatly in the vegetable drawer of a clean refrigerator',
      'The drawer slides open slowly, cool light, gentle push-in',
    ],
    prep: [
      'Hands peeling or cutting this {en} with a knife on a wooden cutting board',
      'The knife moves smoothly, peel curls away, slow motion',
    ],
    origin: [
      'Farmer harvesting fresh {en} in an orchard field at golden hour, crates nearby',
      'Slow pan across trees and hands picking fruit, warm sunlight, gentle breeze',
    ],
  },
};

const EN_NAMES: Record<string, string> = {
  참외: 'Korean melon (chamoe)',
  사과: 'Korean apple',
  배: 'Korean pear',
  감귤: 'Jeju mandarin orange',
  귤: 'Jeju mandarin orange',
  오렌지: 'navel orange fruit',
  수박: 'watermelon',
  딸기: 'fresh strawberry',
  토마토: 'tomato',
  한우: 'Korean Hanwoo beef',
  삼겹살: 'Korean pork belly',
};

export type AiSceneOpts = {
  script?: string;
  /** 나레이션 길이에 맞출 초 (예상) */
  seconds?: number;
  sceneIndex?: number;
  visual?: string;
  /** origin = 산지에서 찍은 휴대폰 사진처럼 */
  style?: 'commercial' | 'origin';
  /** 올린 참고 영상에서 뽑은 프레임. 구도·빛만 참고하고 상품은 상품 사진을 따른다 */
  extraImages?: Buffer[];
  /** 같은 손질이라도 장면마다 다른 구도 */
  angle?: string;
  /** 이 장면에 나오면 안 되는 것 */
  ban?: string;
};

export type AiSceneResult = {
  kind: 'video' | 'image';
  path: string;
  seconds: number;
};

export function replicateToken(): string | undefined {
  return (
    process.env.REPLICATE_API_TOKEN ||
    process.env.REPLICATE_API_KEY ||
    process.env.REPLICATE_TOKEN ||
    undefined
  );
}

export function hasAiSceneProvider() {
  return Boolean(process.env.FAL_KEY || replicateToken());
}

/** 대본 글자 수로 TTS 길이 대략 추정 (초) */
export function estimateSceneSeconds(script: string, fallback = 4): number {
  const t = script.replace(/\*/g, '').trim();
  if (!t) return fallback;
  const byLen = Math.max(2.5, Math.min(12, t.length * 0.12 + 0.8));
  return Math.round(byLen * 10) / 10;
}

function enName(product: Record<string, unknown>) {
  const name = String(product.name || '');
  const ident = produceIdentity(name);
  if (ident) return ident.look;
  if (product.en_name && !/^(melon|orange|pear)$/i.test(String(product.en_name).trim())) {
    return String(product.en_name);
  }
  for (const [ko, en] of Object.entries(EN_NAMES)) {
    if (name.includes(ko)) return en;
  }
  return name || 'fresh produce';
}

function shotSpec(product: Record<string, unknown>, shot: string): ShotPair {
  const cat = String(product.category || '과일');
  const custom = (product.shots as Record<string, ShotPair> | undefined)?.[shot];
  if (custom) return custom;
  const fromCat = AI_SHOTS[cat]?.[shot] || AI_SHOTS.과일?.[shot];
  if (fromCat) return fromCat;
  return [
    `Appetizing commercial photo of this {en}, vertical 9:16`,
    `Slow cinematic push-in, gentle camera move, appetizing`,
  ];
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function runReplicate(
  model: string,
  input: Record<string, unknown>,
  waitRounds = 90,
): Promise<unknown> {
  const tok = replicateToken();
  if (!tok) throw new Error('REPLICATE_API_TOKEN 이 없어요');
  const auth = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'wait=60' };
  const create = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ input }),
  });
  let pred = (await create.json()) as {
    status?: string;
    error?: string;
    output?: unknown;
    urls?: { get?: string };
  };
  if (!create.ok) throw new Error(pred.error || `Replicate ${create.status}`);
  for (let i = 0; i < waitRounds && pred.status !== 'succeeded' && pred.status !== 'failed'; i++) {
    if (!pred.urls?.get) break;
    await sleep(2000);
    const r = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${tok}` } });
    pred = (await r.json()) as typeof pred;
  }
  if (pred.status === 'failed' || pred.error) throw new Error(pred.error || 'Replicate 실패');
  const out = pred.output;
  if (Array.isArray(out)) return out[0];
  return out;
}

async function toDataUri(photo: Buffer) {
  return `data:image/jpeg;base64,${photo.toString('base64')}`;
}

async function downloadTo(url: string, dest: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`다운로드 실패 ${r.status}`);
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}

function clipCacheDir(productFolder: string) {
  return path.join(process.cwd(), 'shortform', 'products', productFolder, '_clips');
}

/** Kling 등은 보통 5 또는 10초만 받음 */
function videoModelDuration(seconds: number): 5 | 10 {
  return seconds > 6.5 ? 10 : 5;
}

/**
 * 대본에 맞는 AI 이미지 생성 → 예상 초로 영상화.
 * 영상 실패 시 kind:'image' (호출측이 초만큼 패닝).
 */
export async function generateAiSceneVisual(
  source: string,
  product: Record<string, unknown>,
  productFolder: string,
  photo: Buffer,
  log?: (m: string) => Promise<void> | void,
  opts?: AiSceneOpts,
): Promise<AiSceneResult | null> {
  const shot = (source.includes(':') ? source.split(':')[1] : source) || 'hero';
  if (!hasAiSceneProvider()) return null;
  const tok = replicateToken();
  if (!tok) {
    await log?.('REPLICATE_API_TOKEN이 없어 AI 장면을 만들 수 없어요');
    return null;
  }

  const script = (opts?.script || '').replace(/\*/g, '').trim();
  const seconds = Math.max(2.5, opts?.seconds || estimateSceneSeconds(script, 4));
  const sceneIndex = opts?.sceneIndex ?? 0;
  const dir = clipCacheDir(productFolder);
  await mkdir(dir, { recursive: true });

  const origin = opts?.style === 'origin';
  const place = producePlace(String(product.name || ''), String(product.category || ''));
  const look = placeLook(place);
  const sig = createHash('sha1')
    .update(`${origin ? 'origin' : 'ad'}|${place}|${shot}|${script}|${opts?.visual || ''}|${opts?.angle || ''}|${opts?.ban || ''}`)
    .digest('hex')
    .slice(0, 8);
  // 장소(배/밭)가 바뀌면 예전 과수원 영상을 다시 쓰지 않는다.
  const tag = origin ? `place_${place}_s${sceneIndex}_${shot}_${sig}` : `ai_${place}_s${sceneIndex}_${shot}`;
  const out = path.join(dir, `${tag}.mp4`);
  const frame = path.join(dir, `${tag}.jpg`);
  if (existsSync(out)) {
    await log?.(`AI 영상 캐시: 장면${sceneIndex + 1} · ${shot} · ~${seconds}s`);
    return { kind: 'video', path: out, seconds };
  }

  const en = enName(product);
  const pair = origin ? look.shots[shot] || look.shots.photo || look.shots.hero! : shotSpec(product, shot);
  const [baseImg, baseMotion] = pair.map((s) => s.replace(/\{en\}/g, en));
  const scriptHint = script
    ? `The action must match this narration: "${script.slice(0, 80)}".`
    : '';
  const angleHint = opts?.angle ? `Camera and action, different from other scenes: ${opts.angle}.` : '';
  const banHint = opts?.ban ? `Do not show: ${opts.ban}.` : '';
  const visualHint = opts?.visual ? `Visual cue: ${opts.visual}.` : '';
  const setting = origin ? look.style : `${STYLE} ${place === 'sea' ? 'Setting is a fish market, boat, or kitchen, never an orchard or mountain.' : ''}`;
  const imgPrompt = `${baseImg}. ${angleHint} ${banHint} ${scriptHint} ${visualHint} ${setting}`.replace(/\s+/g, ' ').trim();
  const motion = `${baseMotion}. ${angleHint} ${banHint} ${scriptHint} Duration feel about ${Math.round(seconds)} seconds.`.replace(
    /\s+/g,
    ' ',
  );
  const refs = [await toDataUri(photo)];
  for (const extra of opts?.extraImages || []) {
    if (extra?.length) refs.push(await toDataUri(extra));
  }

  try {
    if (!existsSync(frame)) {
      await log?.(
        `${origin ? look.label : 'AI 이미지'} 생성 (장면${sceneIndex + 1} · ${shot}${script ? ` · “${script.slice(0, 20)}…”` : ''})`,
      );
      const url = String(
        await runReplicate(REPLICATE_IMAGE, {
          prompt: imgPrompt,
          image_input: refs.slice(0, 3),
          aspect_ratio: '9:16',
          resolution: '2K',
          output_format: 'jpg',
        }),
      );
      await downloadTo(url, frame);
    } else {
      await log?.(`AI 이미지 캐시 사용: 장면${sceneIndex + 1}`);
    }

    const dur = videoModelDuration(seconds);
    await log?.(
      `${origin ? look.label : 'AI 이미지'} → ${dur}초 영상 (대본 예상 ${seconds.toFixed(1)}초, 1~3분)`,
    );
    const startImage = `data:image/jpeg;base64,${(await readFile(frame)).toString('base64')}`;
    try {
      const vidUrl = String(
        await runReplicate(REPLICATE_VIDEO, {
          prompt: motion,
          start_image: startImage,
          duration: dur,
          aspect_ratio: '9:16',
          negative_prompt: look.negative,
        }),
      );
      await downloadTo(vidUrl, out);
      return { kind: 'video', path: out, seconds };
    } catch (vidErr) {
      await log?.(
        `AI 영상 변환 실패 → 이미지로 ${seconds.toFixed(1)}초 패닝: ${vidErr instanceof Error ? vidErr.message : vidErr}`,
      );
      return { kind: 'image', path: frame, seconds };
    }
  } catch (err) {
    await log?.(`AI 장면 실패(${shot}): ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * 하위 호환: ai:hook → mp4 경로만. 실패 시 null.
 */
export async function generateAiClip(
  source: string,
  product: Record<string, unknown>,
  productFolder: string,
  photo: Buffer,
  log?: (m: string) => Promise<void> | void,
  opts?: AiSceneOpts,
): Promise<string | null> {
  if (!source.startsWith('ai:') && opts === undefined) {
    // 예전 호출: ai: 만
  }
  const src = source.startsWith('ai:') ? source : `ai:${source}`;
  const r = await generateAiSceneVisual(src, product, productFolder, photo, log, opts);
  if (r?.kind === 'video') return r.path;
  return null;
}
