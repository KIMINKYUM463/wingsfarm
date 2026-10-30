import 'server-only';
import { ApiError } from '../http';
import { pixabayClipSource, pixabayToStock, preferOrientation, type PixabayVideo, type StockProvider } from './stockSources';

/**
 * Pixabay 무료 영상 (https://pixabay.com/api/docs/#api_search_videos)
 * - 키: .env.local의 PIXABAY_API_KEY (무료, 1분에 100회)
 * - 조건: 검색 결과에 출처 표시, 같은 요청은 24시간 캐시(stock.ts), 영상은 서버에 내려받아 쓴다
 * - 키가 주소(?key=)에 들어가므로 요청 주소는 로그에 남기지 않는다
 */
const API = 'https://pixabay.com/api/videos/';

const pixabayKey = () => process.env.PIXABAY_API_KEY?.trim() ?? '';

async function pixabay(params: Record<string, string>): Promise<PixabayVideo[]> {
  const key = pixabayKey();
  if (!key) throw new ApiError(400, 'Pixabay API 키가 없어요. .env.local에 PIXABAY_API_KEY=키 를 넣고 서버를 다시 켜 주세요.');
  const url = new URL(API);
  url.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (res.status === 429) throw new ApiError(429, 'Pixabay 검색 한도(1분에 100회)를 넘었어요. 잠시 뒤 다시 시도해 주세요.');
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403 || /api key/i.test(text)) {
      throw new ApiError(400, 'Pixabay API 키가 올바르지 않아요. .env.local의 PIXABAY_API_KEY를 확인해 주세요.');
    }
    throw new ApiError(502, `Pixabay 응답 오류 (${res.status})`);
  }
  const { hits = [] } = (await res.json()) as { hits?: PixabayVideo[] };
  return hits;
}

export const pixabayProvider: StockProvider = {
  hosts: ['pixabay.com'],
  hasKey: () => Boolean(pixabayKey()),
  search: async (query, orientation) => {
    const hits = await pixabay({ q: query.slice(0, 100), lang: 'ko', video_type: 'film', safesearch: 'true', per_page: '15' });
    const videos = hits.map(pixabayToStock).filter((v) => v !== null);
    return preferOrientation(videos, orientation);
  },
  clipSource: async (id) => {
    const [video] = await pixabay({ id: String(id) });
    if (!video) throw new ApiError(404, 'Pixabay에서 이 영상을 찾을 수 없어요. 다른 영상을 골라 주세요.');
    return pixabayClipSource(video);
  },
};
