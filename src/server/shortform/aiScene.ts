/**
 * Replicate(또는 FAL)로 상품 사진 → AI 장면 이미지 → 5초 영상.
 * Python sources.ai_clip 과 같은 모델·프롬프트를 Node에서 호출한다.
 */
import 'server-only';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const REPLICATE_IMAGE = 'google/nano-banana-pro';
const REPLICATE_VIDEO = 'kwaivgi/kling-v2.5-turbo-pro';

const STYLE =
  'photorealistic vertical 9:16 food commercial shot, natural daylight, appetizing, shallow depth of field, ' +
  'no text, no logos, no watermark. Keep the product looking exactly like the reference image.';

type ShotPair = [string, string];

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
  },
};

const EN_NAMES: Record<string, string> = {
  참외: 'Korean melon (chamoe)',
  사과: 'Korean apple',
  배: 'Korean pear',
  감귤: 'Jeju mandarin orange',
  귤: 'Jeju mandarin orange',
  수박: 'watermelon',
  딸기: 'fresh strawberry',
  토마토: 'tomato',
  한우: 'Korean Hanwoo beef',
  삼겹살: 'Korean pork belly',
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

function enName(product: Record<string, unknown>) {
  if (product.en_name) return String(product.en_name);
  const name = String(product.name || '');
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

async function replicatePredict(model: string, input: Record<string, unknown>): Promise<unknown> {
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
  while (pred.status && !['succeeded', 'failed', 'canceled'].includes(pred.status)) {
    await sleep(5000);
    const getUrl = pred.urls?.get;
    if (!getUrl) break;
    const r = await fetch(getUrl, { headers: { Authorization: `Bearer ${tok}` } });
    pred = (await r.json()) as typeof pred;
  }
  if (pred.status !== 'succeeded') throw new Error(`Replicate ${pred.status}: ${pred.error || ''}`);
  const out = pred.output;
  return Array.isArray(out) ? out[0] : out;
}

async function toDataUri(photo: Buffer) {
  // 过大 입력 방지 — JPEG 그대로 data URI (이미 상품 사진은 작음)
  return `data:image/jpeg;base64,${photo.toString('base64')}`;
}

async function downloadTo(url: string, dest: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`다운로드 실패 ${r.status}`);
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}

function clipCacheDir(productFolder: string) {
  // 웹 상품도 로컬 캐시 폴더를 씀 (재생성 비용 절약)
  return path.join(process.cwd(), 'shortform', 'products', productFolder, '_clips');
}

/**
 * ai:hook 등 → 로컬 mp4 경로. 캐시 있으면 재사용. 실패 시 null.
 */
export async function generateAiClip(
  source: string,
  product: Record<string, unknown>,
  productFolder: string,
  photo: Buffer,
  log?: (m: string) => Promise<void> | void,
): Promise<string | null> {
  if (!source.startsWith('ai:')) return null;
  if (!hasAiSceneProvider()) return null;
  const shot = source.slice(3) || 'hero';
  const dir = clipCacheDir(productFolder);
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `ai_${shot}.mp4`);
  const frame = path.join(dir, `ai_${shot}.jpg`);
  if (existsSync(out)) {
    await log?.(`AI 장면 캐시 사용: ${shot}`);
    return out;
  }

  const en = enName(product);
  const [imgPrompt, motion] = shotSpec(product, shot).map((s) => s.replace(/\{en\}/g, en));
  const tok = replicateToken();

  try {
    if (!existsSync(frame)) {
      await log?.(`AI 장면 사진 생성: ${shot} (replicate)`);
      if (!tok) throw new Error('REPLICATE_API_TOKEN 필요');
      const url = String(
        await replicatePredict(REPLICATE_IMAGE, {
          prompt: `${imgPrompt}. ${STYLE}`,
          image_input: [await toDataUri(photo)],
          aspect_ratio: '9:16',
          resolution: '2K',
          output_format: 'jpg',
        }),
      );
      await downloadTo(url, frame);
    }

    await log?.(`AI 영상 생성: ${shot} (replicate, 1~3분)`);
    const startImage = existsSync(frame)
      ? `data:image/jpeg;base64,${(await readFile(frame)).toString('base64')}`
      : await toDataUri(photo);
    const vidUrl = String(
      await replicatePredict(REPLICATE_VIDEO, {
        prompt: motion,
        start_image: startImage,
        duration: 5,
        aspect_ratio: '9:16',
        negative_prompt: 'text, watermark, distorted',
      }),
    );
    await downloadTo(vidUrl, out);
    return out;
  } catch (err) {
    await log?.(`AI 장면 실패(${shot}): ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
