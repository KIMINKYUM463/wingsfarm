/**
 * 맨 위 움직이는 컷 — 순수 함수 (요청·응답 해석, ffmpeg 인자)
 *
 * 흐름: 맨 위 사진 → 클립(사진 자리 크기, 무음 MP4) → 다운로드할 때 섹션 문구와 합성해 GIF
 * - pan: 사진을 천천히 확대하며 옆으로 이동 (ffmpeg, 무료)
 * - video: Gemini Omni 이미지→영상 (유료) 후 사진 자리 크기로 자르기
 * - stock: Pexels 무료 영상의 가운데 구간을 사진 자리 크기로 자르기
 */
import type { StockVideo } from '@/shared/types/heroMotion';

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

// ===== 무료 영상 (Pexels) =====

/** 앞뒤는 장면 전환·흔들림이 많아 가운데 구간을 쓴다 (0.1초 단위) */
export const stockClipStart = (duration: number) => Math.max(0, Math.floor(((duration - CLIP_SECONDS) / 2) * 10) / 10);

/** 무료 영상 → 가운데 CLIP_SECONDS초를 사진 자리 크기로 자르고 소리 제거 */
export function stockClipArgs(input: string, output: string, width: number, height: number, duration: number) {
  return ['-y', '-ss', String(stockClipStart(duration)), '-i', input, '-t', String(CLIP_SECONDS), '-vf', fitFilter(width, height), ...encodeArgs, output];
}

export type StockOrientation = 'landscape' | 'portrait' | 'square';

export const stockOrientation = (width: number, height: number): StockOrientation => {
  const ratio = width / height;
  return ratio > 1.2 ? 'landscape' : ratio < 0.83 ? 'portrait' : 'square';
};

export interface PexelsVideoFile {
  link: string;
  file_type: string;
  width: number | null;
  height: number | null;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string;
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
}

/** GIF는 최대 1080px까지 키우므로 사진 자리보다 1.25배 넉넉한 파일이 필요하다 */
const STOCK_UPSCALE = 1.25;
/** 4K 원본은 받을 필요가 없다 */
const STOCK_MAX_SIDE = 2560;

/** 사진 자리를 흐리지 않게 덮는 가장 작은 MP4 (없으면 받을 수 있는 가장 큰 것) */
export function pickVideoFile(files: PexelsVideoFile[], width: number, height: number) {
  const mp4 = files
    .filter((f): f is PexelsVideoFile & { width: number; height: number } => f.file_type === 'video/mp4' && Boolean(f.width && f.height))
    .filter((f) => Math.max(f.width, f.height) <= STOCK_MAX_SIDE)
    .sort((a, b) => a.width * a.height - b.width * b.height);
  const covers = (f: { width: number; height: number }) => Math.max((width * STOCK_UPSCALE) / f.width, (height * STOCK_UPSCALE) / f.height) <= 1;
  return mp4.find(covers) ?? mp4.at(-1) ?? null;
}

export const toStockVideo = (v: PexelsVideo): StockVideo => ({
  id: v.id,
  thumbnail: v.image,
  duration: v.duration,
  width: v.width,
  height: v.height,
  author: v.user?.name ?? 'Pexels',
  pageUrl: v.url,
});

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
