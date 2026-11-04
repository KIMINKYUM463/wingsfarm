import { MAX_STOCK_PICKS, type HeroMotionCredit, type StockPick, type StockSource, type StockVideo } from '@/shared/types/heroMotion';
import { stockOrientation, type StockOrientation } from './motion';

/**
 * 무료 영상 사이트 응답 → 공통 모양 (네트워크 없이 테스트할 수 있게 순수 함수만 둔다)
 */

/** 내려받을 수 있는 MP4 한 개 */
export interface StockFile {
  link: string;
  width: number;
  height: number;
}

/** 고른 영상을 자르는 데 필요한 것 */
export interface StockClipSource {
  duration: number;
  files: StockFile[];
  credit: HeroMotionCredit;
}

export interface StockProvider {
  /** 영상 파일을 받아도 되는 도메인 */
  hosts: string[];
  hasKey: () => boolean;
  search: (query: string, orientation: StockOrientation) => Promise<StockVideo[]>;
  clipSource: (id: number) => Promise<StockClipSource>;
}

// ===== Pexels =====

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

const pexelsAuthor = (v: PexelsVideo) => v.user?.name || 'Pexels';

export const pexelsToStock = (v: PexelsVideo): StockVideo => ({
  source: 'pexels',
  id: v.id,
  thumbnail: v.image,
  duration: v.duration,
  width: v.width,
  height: v.height,
  author: pexelsAuthor(v),
  pageUrl: v.url,
});

export const pexelsClipSource = (v: PexelsVideo): StockClipSource => ({
  duration: v.duration,
  files: v.video_files.flatMap((f) => (f.file_type === 'video/mp4' && f.width && f.height ? [{ link: f.link, width: f.width, height: f.height }] : [])),
  credit: { source: 'pexels', author: pexelsAuthor(v), url: v.url },
});

// ===== Pixabay =====

export interface PixabayRendition {
  url: string;
  width: number;
  height: number;
  size: number;
  thumbnail?: string;
}

export interface PixabayVideo {
  id: number;
  pageURL: string;
  duration: number;
  user: string;
  videos: Partial<Record<'large' | 'medium' | 'small' | 'tiny', PixabayRendition>>;
}

/** 큰 것부터 — large는 없으면 빈 주소로 온다 */
const pixabayRenditions = (v: PixabayVideo) =>
  [v.videos?.large, v.videos?.medium, v.videos?.small, v.videos?.tiny].filter((r): r is PixabayRendition => Boolean(r?.url && r.width && r.height));

const pixabayAuthor = (v: PixabayVideo) => v.user || 'Pixabay';

export const pixabayToStock = (v: PixabayVideo): StockVideo | null => {
  const [biggest] = pixabayRenditions(v);
  const thumbnail = v.videos?.small?.thumbnail || v.videos?.tiny?.thumbnail || biggest?.thumbnail;
  if (!biggest || !thumbnail) return null;
  return { source: 'pixabay', id: v.id, thumbnail, duration: v.duration, width: biggest.width, height: biggest.height, author: pixabayAuthor(v), pageUrl: v.pageURL };
};

export const pixabayClipSource = (v: PixabayVideo): StockClipSource => ({
  duration: v.duration,
  files: pixabayRenditions(v).map((r) => ({ link: r.url, width: r.width, height: r.height })),
  credit: { source: 'pixabay', author: pixabayAuthor(v), url: v.pageURL },
});

// ===== 공통 =====

/** GIF는 최대 1080px까지 키우므로 사진 자리보다 1.25배 넉넉한 파일이 필요하다 */
const STOCK_UPSCALE = 1.25;
/** 4K·고해상도는 배포(서버리스)에서 메모리·시간 초과를 잘 일으켜 상한을 낮춘다 */
const STOCK_MAX_SIDE = 1920;

/** 사진 자리를 흐리지 않게 덮는 가장 작은 파일 (없으면 받을 수 있는 가장 큰 것) */
export function pickVideoFile(files: StockFile[], width: number, height: number) {
  const usable = files
    .filter((f) => f.width > 0 && f.height > 0 && Math.max(f.width, f.height) <= STOCK_MAX_SIDE)
    .sort((a, b) => a.width * a.height - b.width * b.height);
  const covers = (f: StockFile) => Math.max((width * STOCK_UPSCALE) / f.width, (height * STOCK_UPSCALE) / f.height) <= 1;
  return usable.find(covers) ?? usable.at(-1) ?? null;
}

/** 방향 필터가 없는 사이트(Pixabay)는 사진 자리와 같은 방향을 앞으로 */
export const preferOrientation = (videos: StockVideo[], orientation: StockOrientation) => [
  ...videos.filter((v) => stockOrientation(v.width, v.height) === orientation),
  ...videos.filter((v) => stockOrientation(v.width, v.height) !== orientation),
];

/** 사이트별 결과를 번갈아 섞는다 (한 사이트 결과만 위에 몰리지 않게) */
export function interleave<T>(lists: T[][]): T[] {
  const longest = Math.max(0, ...lists.map((list) => list.length));
  return Array.from({ length: longest }, (_, i) => lists.flatMap((list) => (i < list.length ? [list[i]] : []))).flat();
}

export const isStockSource = (value: unknown): value is StockSource =>
  value === 'pexels' || value === 'pixabay' || value === 'upload';

/** 요청에서 고른 영상 목록 검사 (1~3개, 같은 영상은 하나로) — 예전 형식 { source, videoId }도 받는다 */
export function parseStockPicks(body: { videos?: unknown; source?: unknown; videoId?: unknown }): StockPick[] | null {
  const items = (Array.isArray(body.videos) ? body.videos : [body]) as { source?: unknown; videoId?: unknown }[];
  const picks = new Map<string, StockPick>();
  for (const item of items) {
    const source = item?.source;
    const videoId = Number(item?.videoId);
    if (!isStockSource(source) || !Number.isInteger(videoId) || videoId <= 0) return null;
    picks.set(`${source}:${videoId}`, { source, videoId });
  }
  return picks.size >= 1 && picks.size <= MAX_STOCK_PICKS ? [...picks.values()] : null;
}

/** 프로젝트에 올린 내 영상 저장 경로 */
export const uploadVideoPath = (projectId: string, videoId: number) => `assets/hero-uploads/${projectId}/${videoId}.mp4`;
export const uploadMetaPath = (projectId: string, videoId: number) => `assets/hero-uploads/${projectId}/${videoId}.json`;
export const uploadThumbPath = (projectId: string, videoId: number) => `assets/hero-uploads/${projectId}/${videoId}.jpg`;
