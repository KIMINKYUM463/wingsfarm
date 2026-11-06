/**
 * SerpAPI로 유튜브·구글 영상 **검색 결과(링크·썸네일)** 만 가져온다.
 * 영상 파일을 내려받아 숏폼에 합성하지 않는다. (참고용)
 */
import 'server-only';

export type SerpRefHit = {
  title: string;
  link: string;
  thumbnail?: string;
  channel?: string;
  source: 'youtube' | 'google_videos';
  duration?: string;
};

function apiKey() {
  return process.env.SERPAPI_API_KEY?.trim() || '';
}

export function hasSerpApi() {
  return Boolean(apiKey());
}

async function serpGet(params: Record<string, string>) {
  const key = apiKey();
  if (!key) throw new Error('SERPAPI_API_KEY가 .env.local에 없어요');
  const url = new URL('https://serpapi.com/search.json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('api_key', key);
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SerpAPI 오류 (${res.status}) ${text.slice(0, 120)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

function buildQuery(productName: string, shot?: string, extra?: string) {
  const shotKo: Record<string, string> = {
    origin: '산지 수확',
    crave: '먹는 시식',
    hook: '자르기 손질',
    detail: '클로즈업',
    prep: '손질법',
    pack: '포장 박스',
    hold: '손에 들기',
    hero: '시장 진열',
    store: '보관법',
  };
  const parts = [productName.trim(), shot ? shotKo[shot] || '' : '', '농수산물 숏폼', extra || '']
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.join(' ');
}

async function searchYoutube(q: string): Promise<SerpRefHit[]> {
  const data = await serpGet({
    engine: 'youtube',
    search_query: q,
    hl: 'ko',
    gl: 'kr',
  });
  const results = (data.video_results as Array<Record<string, unknown>> | undefined) || [];
  return results.slice(0, 8).map((r) => ({
    title: String(r.title || ''),
    link: String(r.link || ''),
    thumbnail: r.thumbnail ? String(r.thumbnail) : undefined,
    channel: r.channel ? String((r.channel as { name?: string }).name || r.channel) : undefined,
    source: 'youtube' as const,
    duration: r.length ? String(r.length) : undefined,
  })).filter((h) => h.title && h.link);
}

async function searchGoogleVideos(q: string): Promise<SerpRefHit[]> {
  const data = await serpGet({
    engine: 'google_videos',
    q,
    hl: 'ko',
    gl: 'kr',
  });
  const results = (data.video_results as Array<Record<string, unknown>> | undefined) || [];
  return results.slice(0, 8).map((r) => ({
    title: String(r.title || ''),
    link: String(r.link || ''),
    thumbnail: r.thumbnail ? String(r.thumbnail) : undefined,
    channel: r.source ? String(r.source) : undefined,
    source: 'google_videos' as const,
    duration: r.duration ? String(r.duration) : undefined,
  })).filter((h) => h.title && h.link);
}

/** 상품·장면 유형으로 참고 영상 링크를 찾는다 (다운로드 없음) */
export async function searchReferenceVideos(opts: {
  productName: string;
  shot?: string;
  extra?: string;
}): Promise<{ query: string; hits: SerpRefHit[]; notice: string }> {
  const query = buildQuery(opts.productName, opts.shot, opts.extra);
  if (!query.trim()) throw new Error('상품명을 먼저 넣어 주세요');

  const settled = await Promise.allSettled([searchYoutube(query), searchGoogleVideos(query)]);
  const hits: SerpRefHit[] = [];
  const seen = new Set<string>();
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const h of s.value) {
      if (seen.has(h.link)) continue;
      seen.add(h.link);
      hits.push(h);
    }
  }
  if (!hits.length) {
    const err = settled.find((s) => s.status === 'rejected') as PromiseRejectedResult | undefined;
    if (err) throw err.reason instanceof Error ? err.reason : new Error(String(err.reason));
  }
  return {
    query,
    hits: hits.slice(0, 12),
    notice: '참고용 링크만 보여 줘요. 영상 파일은 받지 않으며 숏폼에 자동으로 넣지 않아요.',
  };
}
