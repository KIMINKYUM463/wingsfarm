import type { NextRequest } from "next/server";
import { normalizeKeyword, type KeywordTrends } from "@/lib/keyword";
import { completedMonthsRange, datalabKeywords, errorMessage, openApiCredentials } from "@/lib/server/naver";

const MONTHS = 12;
/** 한 번에 받는 키워드 수 상한 (데이터랩 하루 호출 한도 보호) */
const MAX_KEYWORDS = 20;
/** 데이터랩 요청당 최대 키워드 수 */
const BATCH = 5;
const CACHE_MS = 24 * 60 * 60 * 1000;

const cache = new Map<string, { values: number[] | null; periods: string[]; expires: number }>();

/** 요청 안에서의 상대값을 키워드마다 자기 최고점 = 100으로 바꿔 모양(시즌성)만 비교한다 */
function toShape(data: { period: string; ratio: number }[], monthStarts: string[]) {
  const byPeriod = new Map(data.map((d) => [d.period, d.ratio]));
  const values = monthStarts.map((m) => byPeriod.get(m) ?? 0);
  const peak = Math.max(...values);
  return peak > 0 ? values.map((v) => (v / peak) * 100) : null;
}

export async function GET(req: NextRequest) {
  const keywords = [...new Set(req.nextUrl.searchParams.getAll("k").map(normalizeKeyword).filter(Boolean))].slice(0, MAX_KEYWORDS);
  if (keywords.length === 0) return Response.json({ error: "키워드가 없습니다." }, { status: 400 });

  const creds = openApiCredentials();
  if (!creds) return Response.json({ error: "검색 추이를 보려면 네이버 개발자센터 키가 필요합니다." }, { status: 503 });

  const range = completedMonthsRange(new Date(), MONTHS);
  const now = Date.now();
  const missing = keywords.filter((k) => {
    const hit = cache.get(k);
    return !hit || hit.expires < now || hit.periods[0] !== range.monthStarts[0];
  });

  let error: string | undefined;
  const chunks = Array.from({ length: Math.ceil(missing.length / BATCH) }, (_, i) => missing.slice(i * BATCH, (i + 1) * BATCH));
  const results = await Promise.allSettled(chunks.map((chunk) => datalabKeywords(creds, range, "month", chunk.map((k) => ({ name: k, query: k })))));
  results.forEach((r) => {
    if (r.status === "fulfilled") {
      r.value.forEach((s) => cache.set(s.name, { values: toShape(s.data, range.monthStarts), periods: range.monthStarts, expires: now + CACHE_MS }));
    } else {
      console.error("[keyword-trends]", r.reason);
      error = errorMessage(r.reason);
    }
  });

  const result: KeywordTrends = {
    periods: range.monthStarts,
    series: Object.fromEntries(keywords.map((k) => [k, cache.get(k)?.values ?? null])),
    error,
  };
  return Response.json(result);
}
