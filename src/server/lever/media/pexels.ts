import 'server-only';
import { ApiError } from '../http';
import { toStockVideo, type PexelsVideo, type StockOrientation } from './motion';

/**
 * Pexels 무료 영상 (https://www.pexels.com/api)
 * - 키: .env.local의 PEXELS_API_KEY (무료, 시간당 200회)
 * - 라이선스: 상업적 사용 가능·출처 표시 권장 → 화면에 작가·Pexels 링크를 보여준다
 */
const API = 'https://api.pexels.com/videos';
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
const VIDEO_HOSTS = ['pexels.com', 'vimeo.com'];

export const hasPexelsKey = () => Boolean(process.env.PEXELS_API_KEY?.trim());

function pexelsKey() {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) throw new ApiError(400, '무료 영상을 쓰려면 Pexels API 키(무료)가 필요해요. .env.local에 PEXELS_API_KEY=키 를 넣고 서버를 다시 켜 주세요.');
  return key;
}

async function pexels<T>(pathname: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API}${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: pexelsKey() }, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (res.status === 429) throw new ApiError(429, '무료 영상 검색 한도(시간당 200회)를 넘었어요. 잠시 뒤 다시 시도해 주세요.');
  if (res.status === 401 || res.status === 403) throw new ApiError(400, 'Pexels API 키가 올바르지 않아요. .env.local의 PEXELS_API_KEY를 확인해 주세요.');
  if (!res.ok) throw new ApiError(502, `무료 영상 서버 응답 오류 (${res.status})`);
  return (await res.json()) as T;
}

export async function searchPexelsVideos(query: string, orientation: StockOrientation) {
  const { videos = [] } = await pexels<{ videos?: PexelsVideo[] }>('/search', {
    query,
    orientation,
    size: 'medium',
    locale: 'ko-KR',
    per_page: '15',
  });
  return videos.map(toStockVideo);
}

export const getPexelsVideo = (id: number) => pexels<PexelsVideo>(`/videos/${id}`);

/** Pexels가 준 영상 파일 주소만 받는다 (용량 제한) */
export async function downloadPexelsFile(link: string) {
  const url = new URL(link);
  const allowed = url.protocol === 'https:' && VIDEO_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  if (!allowed) throw new ApiError(502, '영상 파일 주소가 올바르지 않아요.');
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new ApiError(502, `영상 파일을 받지 못했어요. (${res.status})`);
  if (Number(res.headers.get('content-length')) > MAX_VIDEO_BYTES) throw new ApiError(413, '영상 파일이 너무 커요. 다른 영상을 골라 주세요.');
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length > MAX_VIDEO_BYTES) throw new ApiError(413, '영상 파일이 너무 커요. 다른 영상을 골라 주세요.');
  return data;
}
