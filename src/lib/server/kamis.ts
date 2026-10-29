/**
 * KAMIS(농산물유통정보) Open API — "최근일자 도·소매가격정보(dailySalesList)" 한 번 호출로 전 품목 시세를 받는다.
 * 키 발급: kamis.or.kr → 고객센터 → Open-API 신청 (무료). 환경변수 KAMIS_CERT_KEY, KAMIS_CERT_ID.
 * 응답 필드(product_cls_code 01 소매·02 도매, item_name, unit, lastest_date, dpr1 최근·dpr2 1일전·dpr3 1개월전·dpr4 1년전)는
 * KAMIS Open-API 이용안내(boardno=6) 기준이며, 형식이 바뀌면 빈 목록과 안내를 돌려준다.
 */
import type { KamisPrice, KamisResponse } from "@/lib/kamis";

const ENDPOINT = "https://www.kamis.or.kr/service/price/xml.do";
const CACHE_MS = 3 * 60 * 60 * 1000;

let cache: { at: number; body: KamisResponse } | null = null;

export const kamisConfigured = () => Boolean(process.env.KAMIS_CERT_KEY?.trim() && process.env.KAMIS_CERT_ID?.trim());

/** "12,340" → 12340, "-"·빈값 → null */
const price = (value: unknown) => {
  const n = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function toPrice(row: Record<string, unknown>): KamisPrice | null {
  const name = text(row.item_name) || text(row.productName);
  if (!name) return null;
  return {
    cls: text(row.product_cls_code) === "02" ? "도매" : "소매",
    category: text(row.category_name),
    name,
    unit: text(row.unit),
    latestDate: text(row.lastest_date) || text(row.day1),
    today: price(row.dpr1),
    dayAgo: price(row.dpr2),
    monthAgo: price(row.dpr3),
    yearAgo: price(row.dpr4),
  };
}

export async function getKamisPrices(): Promise<KamisResponse> {
  if (!kamisConfigured()) return { items: [], updatedAt: "", error: "KAMIS_CERT_KEY / KAMIS_CERT_ID가 설정되지 않았습니다.", missingKey: true };
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.body;

  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    action: "dailySalesList",
    p_cert_key: process.env.KAMIS_CERT_KEY!.trim(),
    p_cert_id: process.env.KAMIS_CERT_ID!.trim(),
    p_returntype: "json",
  }).toString();

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) return { items: [], updatedAt: "", error: `KAMIS 응답 오류(${res.status})` };
    const json = (await res.json()) as { error_code?: string; price?: unknown };
    if (json.error_code && json.error_code !== "000") return { items: [], updatedAt: "", error: `KAMIS 오류 코드 ${json.error_code} — 인증키·ID를 확인하세요.` };
    const rows = (Array.isArray(json.price) ? json.price : json.price && typeof json.price === "object" ? [json.price] : []) as Record<string, unknown>[];
    if (rows[0]?.result_code === "900") return { items: [], updatedAt: "", error: "KAMIS 인증 실패 — 인증키·ID를 확인하세요." };
    const items = rows.map(toPrice).filter((x): x is KamisPrice => x !== null);
    if (items.length === 0) return { items: [], updatedAt: "", error: "KAMIS에서 받은 시세가 없습니다. 잠시 후 다시 시도하세요." };
    const body: KamisResponse = { items, updatedAt: new Date().toISOString() };
    cache = { at: Date.now(), body };
    return body;
  } catch (err) {
    console.error("[kamis]", err);
    return { items: [], updatedAt: "", error: "KAMIS 서버에 연결하지 못했습니다." };
  }
}
