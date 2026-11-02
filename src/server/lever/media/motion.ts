/**
 * 맨 위 움직이는 컷 — 순수 함수 (요청·응답 해석, ffmpeg 인자)
 *
 * 흐름: 맨 위 사진 → 클립(사진 자리 크기, 무음 MP4) → 다운로드할 때 섹션 문구와 합성해 GIF
 * - pan: 사진을 천천히 확대하며 옆으로 이동 (ffmpeg, 무료)
 * - video: Gemini Omni 이미지→영상 (유료) 후 사진 자리 크기로 자르기
 * - stock: 무료 영상(Pexels·Pixabay) 최대 3개를 AI가 고른 장면으로 컷 편집해 사진 자리 크기로
 */

export const VIDEO_MODEL = 'gemini-omni-1.1-flash';
export const CLIP_FPS = 24;
export const CLIP_SECONDS = 5;

export type VideoAspect = '9:16' | '16:9';

/** Omni는 세로(9:16)·가로(16:9)만 지원 — 사진 자리 모양에 가까운 쪽 */
export const videoAspect = (width: number, height: number): VideoAspect => (width / height < 1 ? '9:16' : '16:9');

/** H.264는 짝수 크기만 받는다 */
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export const VIDEO_PROMPT_RULES = [
  'Animate this exact product photo into a short, calm commercial shot (about 5 seconds).',
  'Keep the product identical: same color, shape, size, count and packaging. Do not add text, logos, people or hands.',
  'Use one slow camera move (gentle push-in or slide) with subtle natural motion such as light, steam, water droplets or leaves.',
  'No cuts, no scene changes. Quiet ambience only.',
].join(' ');

export function videoRequestBody(image: { data: string; mimeType: string }, prompt: string, aspect: VideoAspect) {
  return {
    model: VIDEO_MODEL,
    input: [
      { type: 'image', data: image.data, mime_type: image.mimeType },
      { type: 'text', text: prompt },
    ],
    generation_config: { video_config: { task: 'image_to_video' } },
    response_format: { type: 'video', aspect_ratio: aspect, resolution: '720p' },
    background: false,
    store: false,
  };
}

interface VideoContent {
  type?: string;
  mime_type?: string;
  data?: string;
  uri?: string;
}

interface InteractionResponse {
  status?: string;
  steps?: { type?: string; content?: VideoContent[] }[];
  output_video?: VideoContent;
  error?: { message?: string };
}

export type ParsedVideo = { kind: 'data'; data: string } | { kind: 'uri'; uri: string };

/** Interactions 응답 → 영상 (base64 또는 다운로드 주소). 영상이 없으면 이유와 함께 에러 */
export function parseVideoResponse(body: unknown): ParsedVideo {
  const res = (body ?? {}) as InteractionResponse;
  if (res.error?.message) throw new Error(res.error.message);
  const outputs = (res.steps ?? []).filter((s) => s.type === 'model_output').flatMap((s) => s.content ?? []);
  const video = [res.output_video, ...outputs].find((c) => c?.type === 'video' || c?.mime_type?.startsWith('video/'));
  if (video?.data) return { kind: 'data', data: video.data };
  if (video?.uri) return { kind: 'uri', uri: video.uri };
  throw new Error(res.status === 'failed' ? '영상 생성이 거절되었어요' : '영상이 만들어지지 않았어요');
}

const encodeArgs = ['-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

/** 정지 사진 → 천천히 확대(1.0→1.12)하며 왼쪽에서 오른쪽으로 흐르는 클립 */
export function panClipArgs(input: string, output: string, width: number, height: number) {
  const w = even(width);
  const h = even(height);
  const frames = CLIP_FPS * CLIP_SECONDS;
  // 2배로 키운 뒤 확대해야 zoompan의 계단 떨림이 줄어든다
  const filter = [
    `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase`,
    `crop=${w * 2}:${h * 2}`,
    `zoompan=z='1+0.12*on/${frames}':x='(iw-iw/zoom)*on/${frames}':y='(ih-ih/zoom)/2':d=${frames}:s=${w}x${h}:fps=${CLIP_FPS}`,
  ].join(',');
  return ['-y', '-i', input, '-vf', filter, '-frames:v', String(frames), ...encodeArgs, output];
}

/** 영상을 사진 자리 크기로 채우고 가운데를 잘라낸다 */
const fitFilter = (width: number, height: number) => {
  const w = even(width);
  const h = even(height);
  return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=${CLIP_FPS}`;
};

/** AI 영상 → 사진 자리 크기로 가운데 자르고 소리 제거 */
export function videoClipArgs(input: string, output: string, width: number, height: number) {
  return ['-y', '-i', input, '-t', String(CLIP_SECONDS + 3), '-vf', fitFilter(width, height), ...encodeArgs, output];
}

// ===== 무료 영상 (Pexels·Pixabay) — 최대 3개를 컷 편집 =====

export const MONTAGE = {
  cutMin: 0.8,
  cutMax: 2.5,
  totalMin: 4,
  totalMax: 8,
  maxCuts: 8,
  /** AI가 보는 영상별 장면 수와 크기 */
  framesPerClip: 6,
  frameWidth: 320,
} as const;

/** 고른 영상 하나 (index = 고른 순서) */
export interface MontageClip {
  duration: number;
}

/** 컷 하나 — clip은 0부터 */
export interface MontageCut {
  clip: number;
  start: number;
  duration: number;
}

const floor1 = (n: number) => Math.floor(n * 10) / 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** 영상 끝에 걸리지 않게 0.1초 여유 */
const usableLength = (clip: MontageClip) => Math.max(0, clip.duration - 0.1);

/** AI에게 보여줄 장면 시각 — 앞뒤 5%는 화면 전환이 많아 빼고 고르게 */
export const sampleTimes = (duration: number, count: number = MONTAGE.framesPerClip) =>
  Array.from({ length: count }, (_, i) => floor1(duration * (0.05 + (0.9 * (i + 0.5)) / count)));

/** 영상 안에 들어가게 맞춘 컷 (너무 짧은 영상이면 null) */
function fitCut(clips: MontageClip[], clip: number, start: number, duration: number): MontageCut | null {
  const length = clips[clip] && usableLength(clips[clip]);
  if (!length || length < MONTAGE.cutMin || !Number.isFinite(start) || !Number.isFinite(duration)) return null;
  const d = floor1(clamp(duration, MONTAGE.cutMin, Math.min(MONTAGE.cutMax, length)));
  return { clip, start: floor1(clamp(start, 0, length - d)), duration: d };
}

/** 고른 개수별 컷 순서 — 영상을 번갈아 짧게 이어 붙인다 */
const FALLBACK_ORDER: Record<number, number[]> = { 1: [0, 0, 0, 0], 2: [0, 1, 0, 1], 3: [0, 1, 2, 0, 1, 2] };

/** AI 없이 만드는 기본 컷 편집: 각 영상을 고르게 나눈 지점에서 같은 길이로 */
export function fallbackPlan(clips: MontageClip[]): MontageCut[] {
  const order = FALLBACK_ORDER[clips.length] ?? clips.map((_, i) => i);
  const cutLength = clamp(6 / order.length, MONTAGE.cutMin, MONTAGE.cutMax);
  const uses = clips.map((_, i) => order.filter((c) => c === i).length);
  const seen = clips.map(() => 0);
  return order.flatMap((clip) => {
    const position = ++seen[clip] / (uses[clip] + 1);
    const cut = fitCut(clips, clip, clips[clip].duration * position - cutLength / 2, cutLength);
    return cut ? [cut] : [];
  });
}

/** AI 답(clip은 1부터) → 검사·보정한 컷 목록. 규칙을 못 지키면 null (기본 편집으로 대신) */
export function normalizePlan(raw: unknown, clips: MontageClip[]): MontageCut[] | null {
  const list = (raw as { cuts?: unknown })?.cuts;
  if (!Array.isArray(list)) return null;
  const cuts: MontageCut[] = [];
  let total = 0;
  for (const item of list.slice(0, MONTAGE.maxCuts) as { clip?: unknown; start?: unknown; duration?: unknown }[]) {
    const cut = fitCut(clips, Number(item?.clip) - 1, Number(item?.start), Number(item?.duration));
    if (!cut) continue;
    if (total + cut.duration > MONTAGE.totalMax) break;
    cuts.push(cut);
    total += cut.duration;
  }
  const usesEveryClip = clips.every((clip, i) => usableLength(clip) < MONTAGE.cutMin || cuts.some((c) => c.clip === i));
  return total >= MONTAGE.totalMin && usesEveryClip ? cuts : null;
}

export const totalSeconds = (cuts: MontageCut[]) => floor1(cuts.reduce((sum, c) => sum + c.duration, 0) + 1e-9);

/** AI 편집 지시 — 이미지는 영상 순서·시각 순서로 함께 보낸다 */
export function montagePrompt(productName: string, clips: MontageClip[], times: number[][]) {
  const frames = times.flatMap((list, clip) => list.map((t) => `clip ${clip + 1} at ${t}s`));
  return [
    'You are a video editor making a short, punchy jump-cut montage for the top banner of a Korean online product detail page.',
    `Product: ${productName || 'farm produce'}.`,
    `There are ${clips.length} stock clip(s): ${clips.map((c, i) => `clip ${i + 1} is ${c.duration}s long`).join(', ')}.`,
    `The attached images are frames in this order: ${frames.map((f, i) => `image ${i + 1} = ${f}`).join('; ')}.`,
    'Pick the best moments: sharp, well lit, appetizing and related to the product. Avoid blurry frames, text, watermarks and close-up faces.',
    'Open with the most eye-catching shot and alternate clips for a lively rhythm. Do not reuse the same moment twice.',
    `Rules: 3-${MONTAGE.maxCuts} cuts, each ${MONTAGE.cutMin}-${MONTAGE.cutMax} seconds, total ${MONTAGE.totalMin + 1}-${MONTAGE.totalMax} seconds, use every clip at least once, start + duration must be within the clip.`,
    'Answer JSON only: {"cuts":[{"clip":1,"start":1.5,"duration":1.2}],"summary":"편집 의도를 한국어 한 문장으로"}',
  ].join('\n');
}

/** 영상 한 개에서 정해진 시각의 장면을 작은 JPG로 (한 번에) */
export function frameGrabArgs(input: string, times: number[], outputs: string[]) {
  return [
    '-y',
    ...times.flatMap((t) => ['-ss', String(t), '-i', input]),
    ...times.flatMap((_, i) => ['-map', `${i}:v:0`, '-frames:v', '1', '-vf', `scale=${MONTAGE.frameWidth}:-2`, '-q:v', '5', outputs[i]]),
  ];
}

/** 컷들을 사진 자리 크기로 맞춰 순서대로 이어 붙인다 (장면이 바로 바뀌는 컷 편집, 소리 없음) */
export function montageArgs(cuts: { path: string; start: number; duration: number }[], output: string, width: number, height: number) {
  const inputs = cuts.flatMap((c) => ['-ss', String(c.start), '-t', String(c.duration), '-i', c.path]);
  const parts = cuts.map((_, i) => `[${i}:v]${fitFilter(width, height)},setsar=1,setpts=PTS-STARTPTS[v${i}]`);
  const filter = `${parts.join(';')};${cuts.map((_, i) => `[v${i}]`).join('')}concat=n=${cuts.length}:v=1:a=0[out]`;
  return ['-y', ...inputs, '-filter_complex', filter, '-map', '[out]', ...encodeArgs, output];
}

export type StockOrientation = 'landscape' | 'portrait' | 'square';

export const stockOrientation = (width: number, height: number): StockOrientation => {
  const ratio = width / height;
  return ratio > 1.2 ? 'landscape' : ratio < 0.83 ? 'portrait' : 'square';
};

export interface GifLayers {
  /** 사진 자리 아래 레이어(배경 포함, 불투명 PNG) */
  below: string;
  clip: string;
  /** 사진 자리 위 레이어(어두운 막·문구, 투명 PNG) */
  above: string;
  output: string;
  /** 섹션 안 사진 자리 위치 (PNG 픽셀 기준) */
  rect: { x: number; y: number; width: number; height: number };
  outWidth: number;
}

/** 용량이 크면 프레임 수 → 폭 → 색 수 순서로 줄인다 */
export const GIF_STEPS = [
  { fps: 12, scale: 1, colors: 256 },
  { fps: 10, scale: 1, colors: 192 },
  { fps: 10, scale: 0.8, colors: 160 },
  { fps: 8, scale: 0.65, colors: 128 },
] as const;

export { GIF_MAX_BYTES } from '@/shared/lib/draftMedia';

export function heroGifArgs(layers: GifLayers, step: (typeof GIF_STEPS)[number]) {
  const { x, y, width, height } = layers.rect;
  const outWidth = even(layers.outWidth * step.scale);
  const filter = [
    `[1:v]fps=${step.fps},scale=${Math.round(width)}:${Math.round(height)}[clip]`,
    `[0:v][clip]overlay=${Math.round(x)}:${Math.round(y)}:shortest=1[base]`,
    `[base][2:v]overlay=0:0:shortest=1,scale=${outWidth}:-2:flags=lanczos,split[a][b]`,
    `[a]palettegen=max_colors=${step.colors}:stats_mode=diff[p]`,
    `[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
  ].join(';');
  const still = (file: string) => ['-framerate', String(step.fps), '-loop', '1', '-i', file];
  return ['-y', ...still(layers.below), '-i', layers.clip, ...still(layers.above), '-filter_complex', filter, '-loop', '0', layers.output];
}
