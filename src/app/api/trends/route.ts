import { SEASON_ITEMS } from "@/lib/data/season";
import { completedWeeksRange, datalabKeywords, errorMessage, openApiCredentials } from "@/lib/server/naver";
import { ANCHOR_KEYWORD, RECENT_WEEKS, combineBatches, seasonOnlyTrends, type TrendsResponse } from "@/lib/trends";

/** 작년 이맘때 12주 전부터 지금까지 → 올해 흐름, 작년 같은 시기 흐름, 작년 이후 1~2개월 흐름을 한 번에 조회 */
const WEEKS = 52 + RECENT_WEEKS + 2;
/** 요청당 최대 5개 = 기준 키워드 1 + 품목 4 */
const ITEMS_PER_BATCH = 4;
const CACHE_MS = 6 * 60 * 60 * 1000;

let cache: { data: TrendsResponse; expires: number } | null = null;

const seasonResponse = (today: Date, warning?: string): TrendsResponse => ({
  source: "season",
  updatedAt: today.toISOString(),
  periods: [],
  items: seasonOnlyTrends(today),
  warning,
});

export async function GET() {
  const today = new Date();
  const creds = openApiCredentials();

  if (!creds) return Response.json(seasonResponse(today));
  if (cache && cache.expires > Date.now()) return Response.json(cache.data);

  try {
    const range = completedWeeksRange(today, WEEKS);
    const keywords = SEASON_ITEMS.filter((i) => i.name !== ANCHOR_KEYWORD).map((i) => ({ name: i.name, query: i.searchKeyword ?? i.name }));
    const anchor = { name: ANCHOR_KEYWORD, query: ANCHOR_KEYWORD };
    const chunks = Array.from({ length: Math.ceil(keywords.length / ITEMS_PER_BATCH) }, (_, i) =>
      keywords.slice(i * ITEMS_PER_BATCH, (i + 1) * ITEMS_PER_BATCH),
    );
    const batches = await Promise.all(chunks.map((chunk) => datalabKeywords(creds, range, "week", [anchor, ...chunk])));
    const periods = [...new Set(batches.flat().flatMap((s) => s.data.map((d) => d.period)))].sort();

    const data: TrendsResponse = {
      source: "naver",
      updatedAt: today.toISOString(),
      periods,
      items: combineBatches(batches, periods, today),
    };
    cache = { data, expires: Date.now() + CACHE_MS };
    return Response.json(data);
  } catch (err) {
    console.error("[trends]", err);
    return Response.json(seasonResponse(today, errorMessage(err)));
  }
}
