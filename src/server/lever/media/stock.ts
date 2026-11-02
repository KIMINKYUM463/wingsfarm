import 'server-only';
import type { StockSource, StockVideo } from '@/shared/types/heroMotion';
import { ApiError } from '../http';
import type { StockOrientation } from './motion';
import { pexelsProvider } from './pexels';
import { pixabayProvider } from './pixabay';
import { interleave, type StockProvider } from './stockSources';

/**
 * 무료 영상 — 키가 있는 사이트(Pexels·Pixabay)를 함께 검색하고, 고른 영상 파일을 안전하게 내려받는다
 */
const PROVIDERS: Record<StockSource, StockProvider> = { pexels: pexelsProvider, pixabay: pixabayProvider };
const SOURCES = Object.keys(PROVIDERS) as StockSource[];

const NO_KEY =
  '무료 영상을 쓰려면 Pexels 또는 Pixabay API 키(무료)가 필요해요. .env.local에 PEXELS_API_KEY=키 또는 PIXABAY_API_KEY=키 를 넣고 서버를 다시 켜 주세요.';

/** 같은 검색은 24시간 다시 묻지 않는다 (Pixabay 이용 조건 · 한도 절약) */
const CACHE_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 200;
const searchCache = new Map<string, { at: number; videos: StockVideo[] }>();

async function cachedSearch(source: StockSource, query: string, orientation: StockOrientation) {
  const key = `${source}:${orientation}:${query.toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.videos;
  const videos = await PROVIDERS[source].search(query, orientation);
  if (searchCache.size >= CACHE_MAX) searchCache.delete(searchCache.keys().next().value!);
  searchCache.set(key, { at: Date.now(), videos });
  return videos;
}

/** 한 사이트가 실패해도 다른 사이트 결과는 보여주고, 실패 이유는 notices로 알린다 */
export async function searchStockVideos(query: string, orientation: StockOrientation) {
  const sources = SOURCES.filter((source) => PROVIDERS[source].hasKey());
  if (!sources.length) throw new ApiError(400, NO_KEY);
  const results = await Promise.allSettled(sources.map((source) => cachedSearch(source, query, orientation)));
  const lists = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const errors = results.flatMap((r) => (r.status === 'rejected' ? [r.reason as unknown] : []));
  if (!lists.length) throw errors[0];
  return {
    videos: interleave(lists),
    notices: errors.map((err) => (err instanceof ApiError ? err.message : '영상 사이트 한 곳이 응답하지 않았어요.')),
  };
}

export const getStockClipSource = (source: StockSource, id: number) => PROVIDERS[source].clipSource(id);

const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
const TOO_BIG = '영상 파일이 너무 커요. 다른 영상을 골라 주세요.';

/** 그 사이트가 준 https 영상 주소만 받는다 (용량 제한) */
export async function downloadStockFile(source: StockSource, link: string) {
  const url = new URL(link);
  const allowed = url.protocol === 'https:' && PROVIDERS[source].hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  if (!allowed) throw new ApiError(502, '영상 파일 주소가 올바르지 않아요.');
  const data = await fetchVideo(url);
  if (data.length > MAX_VIDEO_BYTES) throw new ApiError(413, TOO_BIG);
  return data;
}

async function fetchVideo(url: URL) {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new ApiError(502, `영상 파일을 받지 못했어요. (${res.status})`);
    if (Number(res.headers.get('content-length')) > MAX_VIDEO_BYTES) throw new ApiError(413, TOO_BIG);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error('[lever] stock download failed', err);
    throw new ApiError(504, '영상 파일을 받는 중 연결이 끊기거나 너무 오래 걸렸어요. 잠시 뒤 다시 시도하거나 다른 영상을 골라 주세요.');
  }
}
