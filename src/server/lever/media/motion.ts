/**
 * 맨 위 움직이는 컷 — 순수 함수 (요청·응답 해석, ffmpeg 인자)
 *
 * 흐름: 클립(HERO_CLIP_SIZE, 무음 MP4) → 상세페이지 첫 섹션 위에 따로 들어가는 영상 → 다운로드는 GIF
 * - pan: 맨 위 사진을 천천히 확대하며 옆으로 이동 (ffmpeg, 무료)
 * - video: 상품명으로 찾은 무료 사진 → Gemini Omni 이미지→영상 (유료) 후 클립 크기로 자르기
 * - stock: 무료 영상(Pexels·Pixabay) 최대 3개를 AI가 고른 장면·자막으로 컷 편집 + 모션그래픽
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
  'Animate this stock photo into a short, calm commercial shot (about 5 seconds) for a Korean food product page.',
  'Keep the subject natural and appetizing. Do not add text, logos, people, hands or a different product.',
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
  /** 컷 길이 합 기준 (전환이 겹치는 만큼 실제 영상은 조금 짧다) */
  totalMin: 4,
  totalMax: 8,
  maxCuts: 8,
  /** 컷 사이 전환 길이(초) */
  transition: 0.3,
  /** 자막 최대 글자 수 (한 줄) */
  captionMax: 14,
  /** AI가 보는 영상별 장면 수와 크기 */
  framesPerClip: 6,
  frameWidth: 320,
} as const;

/** 고른 영상 하나 (index = 고른 순서) */
export interface MontageClip {
  duration: number;
}

/** 컷 하나 — clip은 0부터, caption은 그 컷에 나오는 자막 (없으면 null) */
export interface MontageCut {
  clip: number;
  start: number;
  duration: number;
  caption: string | null;
}

/** 자막·태그 글자 정리: 한 줄, 제어 문자 제거, 글자 수 제한 (이모지 등은 글꼴에 없어 뺀다) */
export function cleanCaption(raw: unknown, max: number = MONTAGE.captionMax): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw
    .replace(/[\p{Cc}\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(text).slice(0, max).join('').trim() || null;
}

const floor1 = (n: number) => Math.floor(n * 10) / 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** 영상 끝에 걸리지 않게 0.1초 여유 */
const usableLength = (clip: MontageClip) => Math.max(0, clip.duration - 0.1);

/** AI에게 보여줄 장면 시각 — 앞뒤 5%는 화면 전환이 많아 빼고 고르게 */
export const sampleTimes = (duration: number, count: number = MONTAGE.framesPerClip) =>
  Array.from({ length: count }, (_, i) => floor1(duration * (0.05 + (0.9 * (i + 0.5)) / count)));

/** 영상 안에 들어가게 맞춘 컷 (너무 짧은 영상이면 null) */
function fitCut(clips: MontageClip[], clip: number, start: number, duration: number, caption: string | null = null): MontageCut | null {
  const length = clips[clip] && usableLength(clips[clip]);
  if (!length || length < MONTAGE.cutMin || !Number.isFinite(start) || !Number.isFinite(duration)) return null;
  const d = floor1(clamp(duration, MONTAGE.cutMin, Math.min(MONTAGE.cutMax, length)));
  return { clip, start: floor1(clamp(start, 0, length - d)), duration: d, caption };
}

/** 고른 개수별 컷 순서 — 영상을 번갈아 짧게 이어 붙인다 */
const FALLBACK_ORDER: Record<number, number[]> = { 1: [0, 0, 0, 0], 2: [0, 1, 0, 1], 3: [0, 1, 2, 0, 1, 2] };

/** AI 없이 만드는 기본 컷 편집: 각 영상을 고르게 나눈 지점에서 같은 길이로, 첫 컷 자막은 상품명 */
export function fallbackPlan(clips: MontageClip[], productName = ''): MontageCut[] {
  const order = FALLBACK_ORDER[clips.length] ?? clips.map((_, i) => i);
  const cutLength = clamp(6 / order.length, MONTAGE.cutMin, MONTAGE.cutMax);
  const uses = clips.map((_, i) => order.filter((c) => c === i).length);
  const seen = clips.map(() => 0);
  const cuts = order.flatMap((clip) => {
    const position = ++seen[clip] / (uses[clip] + 1);
    const cut = fitCut(clips, clip, clips[clip].duration * position - cutLength / 2, cutLength);
    return cut ? [cut] : [];
  });
  if (cuts[0]) cuts[0].caption = cleanCaption(productName);
  return cuts;
}

/** AI 답(clip은 1부터) → 검사·보정한 컷 목록. 규칙을 못 지키면 null (기본 편집으로 대신) */
export function normalizePlan(raw: unknown, clips: MontageClip[]): MontageCut[] | null {
  const list = (raw as { cuts?: unknown })?.cuts;
  if (!Array.isArray(list)) return null;
  const cuts: MontageCut[] = [];
  let total = 0;
  for (const item of list.slice(0, MONTAGE.maxCuts) as { clip?: unknown; start?: unknown; duration?: unknown; caption?: unknown }[]) {
    const cut = fitCut(clips, Number(item?.clip) - 1, Number(item?.start), Number(item?.duration), cleanCaption(item?.caption));
    if (!cut) continue;
    if (total + cut.duration > MONTAGE.totalMax) break;
    cuts.push(cut);
    total += cut.duration;
  }
  const usesEveryClip = clips.every((clip, i) => usableLength(clip) < MONTAGE.cutMin || cuts.some((c) => c.clip === i));
  return total >= MONTAGE.totalMin && usesEveryClip ? cuts : null;
}

/** 완성 영상 길이 — 컷 사이 전환만큼 겹친다 */
export const totalSeconds = (cuts: Pick<MontageCut, 'duration'>[]) =>
  floor1(cuts.reduce((sum, c) => sum + c.duration, 0) - MONTAGE.transition * Math.max(0, cuts.length - 1) + 1e-9);

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
    'Cuts are joined with short animated transitions, and each cut gets a gentle zoom.',
    `Write a Korean subtitle ("caption") for each cut: max ${MONTAGE.captionMax} characters, one line, natural ad copy about this product (freshness, taste, origin, season, how to enjoy).`,
    'The first caption is a hook, the last invites the viewer (e.g. 지금 만나보세요). Leave caption "" for at most half of the cuts if the shot speaks for itself.',
    'No prices, discounts, health or medical claims, superlatives (최고, 1등) or facts you cannot see. No emoji, no quotes.',
    'Answer JSON only: {"cuts":[{"clip":1,"start":1.5,"duration":1.2,"caption":"산지에서 바로 온"}],"summary":"편집 의도를 한국어 한 문장으로"}',
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

/** 컷 사이 전환 효과 (차례로 돌려 쓴다) */
export const TRANSITIONS = ['fade', 'slideleft', 'circleopen', 'slideup', 'dissolve', 'wipeleft'] as const;

/**
 * 컷마다 1080p 디코더가 따로 뜨고, 디코더는 기본으로 CPU 코어 수만큼 프레임을 쌓는다.
 * 2개로 묶으면 컷 6개 편집 메모리가 약 1.1GB → 0.6GB (Vercel 함수 메모리 안에 들도록)
 */
const DECODE_THREADS = ['-threads', '2'];

/** 브랜드 포인트 색 (--color-point) */
const POINT_COLOR = '0x5DADEC';

/**
 * 컷 하나: 채우기 → 천천히 확대·축소(번갈아) → 비네팅
 * 자막은 drawtext 대신 PNG overlay(배포 ffmpeg에 libfreetype 없음)로 올린다.
 */
function cutFilter(cut: Pick<MontageCut, 'duration'>, i: number, width: number, height: number) {
  const w = even(width);
  const h = even(height);
  const frames = Math.max(1, Math.round(cut.duration * CLIP_FPS));
  const zoom = i % 2 === 0 ? `1+0.08*on/${frames}` : `1.08-0.08*on/${frames}`;
  return [
    // 2배로 키운 뒤 확대해야 zoompan의 계단 떨림이 줄어든다
    `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase`,
    `crop=${w * 2}:${h * 2}`,
    `fps=${CLIP_FPS}`,
    `zoompan=z='${zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${w}x${h}:fps=${CLIP_FPS}`,
    `trim=duration=${cut.duration}`,
    'setpts=PTS-STARTPTS',
    'setsar=1',
    'vignette=PI/6',
  ].join(',');
}

export interface MontageRender {
  cuts: (Pick<MontageCut, 'start' | 'duration' | 'caption'> & { path: string })[];
  output: string;
  width: number;
  height: number;
}

/**
 * 1단계: 컷 하나를 줌(+선택 자막 PNG overlay)까지 넣어 중간 MP4로 만든다.
 * 배포 ffmpeg에는 drawtext가 없어 captionPng가 있으면 overlay로 올린다.
 */
export function singleCutRenderArgs(
  cut: MontageRender['cuts'][number],
  index: number,
  output: string,
  width: number,
  height: number,
  captionPng: string | null = null,
) {
  const w = even(width);
  const h = even(height);
  const frames = Math.max(1, Math.round(cut.duration * CLIP_FPS));
  const base = [
    '-y',
    ...DECODE_THREADS,
    '-ss',
    String(cut.start),
    '-t',
    String(floor1(cut.duration + 0.1 + 1e-9)),
    '-i',
    cut.path,
  ];
  const motion = `${cutFilter(cut, index, w, h)},format=yuv420p`;
  if (!captionPng) {
    return [
      ...base,
      '-vf',
      `${motion},fps=${CLIP_FPS},settb=AVTB,setpts=PTS-STARTPTS`,
      '-frames:v',
      String(frames),
      ...encodeArgs,
      output,
    ];
  }
  const fadeStart = index === 0 ? 0.15 : MONTAGE.transition;
  const y = Math.round(h * 0.72);
  return [
    ...base,
    '-loop',
    '1',
    '-t',
    String(cut.duration),
    '-i',
    captionPng,
    '-filter_complex',
    [
      `[0:v]${motion}[base]`,
      `[1:v]format=rgba,fade=t=in:st=${fadeStart}:d=0.35:alpha=1[txt]`,
      `[base][txt]overlay=(W-w)/2:${y}:format=auto,fps=${CLIP_FPS},settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[out]`,
    ].join(';'),
    '-map',
    '[out]',
    '-frames:v',
    String(frames),
    ...encodeArgs,
    output,
  ];
}

/**
 * 2단계: 이미 같은 크기·프레임으로 맞춰 둔 컷들을 전환·태그 PNG·진행 막대로 잇는다.
 */
export function joinRenderedCutsArgs({
  cuts,
  output,
  width,
  height,
  tagPng,
}: {
  cuts: { path: string; duration: number }[];
  output: string;
  width: number;
  height: number;
  tagPng?: string | null;
}) {
  const w = even(width);
  const h = even(height);
  const total = totalSeconds(cuts);
  const inputs = cuts.flatMap((c) => [...DECODE_THREADS, '-i', c.path]);
  if (tagPng) inputs.push(...DECODE_THREADS, '-loop', '1', '-t', String(total), '-i', tagPng);
  const tagIndex = cuts.length;

  const chains = cuts.map(
    (_, i) => `[${i}:v]fps=${CLIP_FPS},format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS,setsar=1[v${i}]`,
  );

  let joined = 'v0';
  let length = cuts[0]?.duration ?? 0;
  for (let i = 1; i < cuts.length; i++) {
    const offset = floor1(length - MONTAGE.transition + 1e-9);
    const transition = TRANSITIONS[(i - 1) % TRANSITIONS.length];
    chains.push(`[${joined}][v${i}]xfade=transition=${transition}:duration=${MONTAGE.transition}:offset=${offset}[x${i}]`);
    joined = `x${i}`;
    length += cuts[i]!.duration - MONTAGE.transition;
  }

  if (tagPng) {
    const x = Math.round(w * 0.045);
    const y = Math.round(h * 0.06);
    chains.push(`[${tagIndex}:v]format=rgba,fade=t=in:st=0.3:d=0.5:alpha=1[tag]`);
    chains.push(`[${joined}][tag]overlay=x=${x}:y=${y}:format=auto[tagged]`);
    joined = 'tagged';
  }

  const barHeight = Math.max(4, Math.round(h * 0.008));
  chains.push(`color=c=${POINT_COLOR}:s=${w}x${barHeight}:r=${CLIP_FPS}[bar]`);
  chains.push(`[${joined}]null[base]`);
  chains.push(`[base][bar]overlay=x=-w+w*t/${total}:y=H-h:shortest=1,format=yuv420p[out]`);

  return ['-y', ...inputs, '-filter_complex', chains.join(';'), '-map', '[out]', '-t', String(total), ...encodeArgs, output];
}

/**
 * 한 번에 돌리는 고급 편집(테스트·로컬 참고용). 자막은 PNG overlay 경로를 쓰지 않고 모션만 넣는다.
 * 실제 생성은 singleCut + join 경로를 쓴다.
 */
export function montageArgs({ cuts, output, width, height }: MontageRender) {
  const w = even(width);
  const h = even(height);
  const total = totalSeconds(cuts);
  const inputs = cuts.flatMap((c) => [
    ...DECODE_THREADS,
    '-ss',
    String(c.start),
    '-t',
    String(floor1(c.duration + 0.1 + 1e-9)),
    '-i',
    c.path,
  ]);
  const chains = cuts.map(
    (cut, i) => `[${i}:v]${cutFilter(cut, i, w, h)},format=yuv420p,fps=${CLIP_FPS},settb=AVTB,setpts=PTS-STARTPTS[v${i}]`,
  );

  let joined = 'v0';
  let length = cuts[0]?.duration ?? 0;
  for (let i = 1; i < cuts.length; i++) {
    const offset = floor1(length - MONTAGE.transition + 1e-9);
    const transition = TRANSITIONS[(i - 1) % TRANSITIONS.length];
    chains.push(`[${joined}][v${i}]xfade=transition=${transition}:duration=${MONTAGE.transition}:offset=${offset}[x${i}]`);
    joined = `x${i}`;
    length += cuts[i]!.duration - MONTAGE.transition;
  }

  const barHeight = Math.max(4, Math.round(h * 0.008));
  chains.push(`color=c=${POINT_COLOR}:s=${w}x${barHeight}:r=${CLIP_FPS}[bar]`);
  chains.push(`[${joined}]null[base]`);
  chains.push(`[base][bar]overlay=x=-w+w*t/${total}:y=H-h:shortest=1,format=yuv420p[out]`);

  return ['-y', ...inputs, '-filter_complex', chains.join(';'), '-map', '[out]', '-t', String(total), ...encodeArgs, output];
}

export type StockOrientation = 'landscape' | 'portrait' | 'square';

export const stockOrientation = (width: number, height: number): StockOrientation => {
  const ratio = width / height;
  return ratio > 1.2 ? 'landscape' : ratio < 0.83 ? 'portrait' : 'square';
};

/** 용량이 크면 프레임 수 → 폭 → 색 수 순서로 줄인다 */
export const GIF_STEPS = [
  { fps: 12, scale: 1, colors: 256 },
  { fps: 10, scale: 1, colors: 192 },
  { fps: 10, scale: 0.8, colors: 160 },
  { fps: 8, scale: 0.65, colors: 128 },
] as const;

export { GIF_MAX_BYTES } from '@/shared/lib/draftMedia';

/** 클립 → 상세페이지 폭(outWidth)의 반복 GIF */
export function heroGifArgs(clip: string, output: string, outWidth: number, step: (typeof GIF_STEPS)[number]) {
  const width = even(outWidth * step.scale);
  const filter = [
    `[0:v]fps=${step.fps},scale=${width}:-2:flags=lanczos,split[a][b]`,
    `[a]palettegen=max_colors=${step.colors}:stats_mode=diff[p]`,
    `[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
  ].join(';');
  return ['-y', '-i', clip, '-filter_complex', filter, '-loop', '0', output];
}
