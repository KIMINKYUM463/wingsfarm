import { rateLimit } from "@/lib/server/rateLimit";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { normalizeKeyword } from "@/lib/keyword";
import { KeywordInsightSchema, SYSTEM_PROMPT, buildInsightPrompt, type KeywordInsight } from "@/lib/keywordAi";
import { getKeywordReport } from "@/lib/server/keywordReport";
import { OPENAI_MODEL, errorResponse, missingKeyResponse, openaiClient, openaiErrorResponse } from "@/lib/server/openai";

const CACHE_MS = 6 * 60 * 60 * 1000;
const CACHE_LIMIT = 200;

const cache = new Map<string, { data: KeywordInsight; expires: number }>();

const RequestSchema = z.object({
  keyword: z.string().min(1).max(40),
  /** 대시보드 팝업처럼 추가로 알고 있는 정보 (작년 흐름·소싱 판단 등) */
  context: z.string().max(1000).default(""),
  /** 캐시를 무시하고 다시 분석 */
  refresh: z.boolean().default(false),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  const keyword = parsed.success ? normalizeKeyword(parsed.data.keyword) : "";
  if (!parsed.success || !keyword) return errorResponse("분석할 키워드가 없습니다.", 400);
  const { context, refresh } = parsed.data;

  const cacheKey = `${keyword}|${context}`;
  const cached = cache.get(cacheKey);
  if (!refresh && cached && cached.expires > Date.now()) return Response.json(cached.data);

  const report = await getKeywordReport(keyword);
  if (!report.volume && !report.trend) {
    return errorResponse("분석할 데이터가 없습니다. 네이버 검색광고·데이터랩 연결을 확인해 주세요.", 422);
  }

  try {
    const response = await client.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildInsightPrompt(report, context, new Date()) },
      ],
      text: { format: zodTextFormat(KeywordInsightSchema, "keyword_insight") },
    });

    const data = response.output_parsed;
    if (!data) return errorResponse("AI가 분석을 완성하지 못했습니다. 다시 시도해 주세요.", 502);
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { data, expires: Date.now() + CACHE_MS });
    return Response.json(data);
  } catch (err) {
    return openaiErrorResponse(err, "keyword-ai", "AI 분석 중 오류가 발생했습니다.");
  }
}
