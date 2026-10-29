import { errorResponse } from "@/lib/server/openai";

export type AiUsage = "text" | "image";

/**
 * IP별 AI 호출 횟수 제한 (서버 메모리 기준 · 서버 1대 운영 가정).
 * 여러 대로 늘리면 Redis 같은 공용 저장소로 바꿔야 한다.
 */
const RULES: Record<AiUsage, { limit: number; windowMs: number; label: string }> = {
  text: { limit: Number(process.env.AI_TEXT_LIMIT) || 60, windowMs: 10 * 60_000, label: "10분" },
  image: { limit: Number(process.env.AI_IMAGE_LIMIT) || 40, windowMs: 60 * 60_000, label: "1시간" },
};

const hits = new Map<string, number[]>();
const MAX_KEYS = 5_000;

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

/** 한도를 넘으면 429 응답을, 아니면 null을 돌려준다 */
export function rateLimit(request: Request, usage: AiUsage): Response | null {
  const rule = RULES[usage];
  const key = `${usage}:${clientIp(request)}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < rule.windowMs);

  if (recent.length >= rule.limit) {
    const retrySec = Math.ceil((rule.windowMs - (now - recent[0])) / 1000);
    const res = errorResponse(
      `AI 사용량 보호: ${rule.label}에 ${rule.limit}회까지 쓸 수 있어요. 약 ${Math.ceil(retrySec / 60)}분 뒤 다시 시도해 주세요.`,
      429,
    );
    res.headers.set("Retry-After", String(retrySec));
    return res;
  }

  if (!hits.has(key) && hits.size >= MAX_KEYS) hits.delete(hits.keys().next().value!);
  hits.set(key, [...recent, now]);
  return null;
}
