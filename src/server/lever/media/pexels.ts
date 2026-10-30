import 'server-only';
import { ApiError } from '../http';
import { pexelsClipSource, pexelsToStock, type PexelsVideo, type StockProvider } from './stockSources';

/**
 * Pexels 무료 영상 (https://www.pexels.com/api)
 * - 키: .env.local의 PEXELS_API_KEY (무료, 시간당 200회)
 * - 라이선스: 상업적 사용 가능·출처 표시 권장 → 화면에 작가·Pexels 링크를 보여준다
 */
const API = 'https://api.pexels.com/videos';

const pexelsKey = () => process.env.PEXELS_API_KEY?.trim() ?? '';

async function pexels<T>(pathname: string, params: Record<string, string> = {}): Promise<T> {
  const key = pexelsKey();
  if (!key) throw new ApiError(400, 'Pexels API 키가 없어요. .env.local에 PEXELS_API_KEY=키 를 넣고 서버를 다시 켜 주세요.');
  const url = new URL(`${API}${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: key }, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (res.status === 429) throw new ApiError(429, 'Pexels 검색 한도(시간당 200회)를 넘었어요. 잠시 뒤 다시 시도해 주세요.');
  if (res.status === 401 || res.status === 403) throw new ApiError(400, 'Pexels API 키가 올바르지 않아요. .env.local의 PEXELS_API_KEY를 확인해 주세요.');
  if (!res.ok) throw new ApiError(502, `Pexels 응답 오류 (${res.status})`);
  return (await res.json()) as T;
}

export const pexelsProvider: StockProvider = {
  hosts: ['pexels.com', 'vimeo.com'],
  hasKey: () => Boolean(pexelsKey()),
  search: async (query, orientation) => {
    const { videos = [] } = await pexels<{ videos?: PexelsVideo[] }>('/search', {
      query,
      orientation,
      size: 'medium',
      locale: 'ko-KR',
      per_page: '15',
    });
    return videos.map(pexelsToStock);
  },
  clipSource: async (id) => pexelsClipSource(await pexels<PexelsVideo>(`/videos/${id}`)),
};
