/**
 * 쿠팡 윙 Open API 호출 (HMAC 서명). 키 발급: 윙 → 판매자정보 → 추가판매자정보 → OPEN API 키 발급.
 * 환경변수 COUPANG_VENDOR_ID(업체코드)·COUPANG_ACCESS_KEY·COUPANG_SECRET_KEY. 키는 180일마다 재발급.
 * 발주서에는 주문자·수취인 개인정보가 들어 있으므로 합계만 돌려주고 원본은 내보내지 않는다.
 */
import { createHmac } from "node:crypto";
import { ORDER_STATUSES, dateChunks, summarizeOrderSheets, type WingOrderSheet, type WingSales } from "../coupangWing.ts";

const HOST = "https://api-gateway.coupang.com";
const KEYS = ["COUPANG_VENDOR_ID", "COUPANG_ACCESS_KEY", "COUPANG_SECRET_KEY"] as const;
const PAGE_SIZE = 50;
/** 한 상태·기간에서 이보다 많이 넘기면 비정상으로 보고 멈춘다 (50 × 60 = 3,000건) */
const MAX_PAGES = 60;
const CACHE_MS = 10 * 60 * 1000;

const cache = new Map<string, { at: number; body: WingSales }>();

export const wingConfigured = () => KEYS.every((k) => Boolean(process.env[k]?.trim()));

/** UTC yyMMdd'T'HHmmss'Z' */
export const signedDate = (now: Date) => `${now.toISOString().slice(2, 19).replace(/[-:]/g, "")}Z`;

export function authorization(method: string, path: string, query: string, accessKey: string, secretKey: string, now = new Date()) {
  const datetime = signedDate(now);
  const signature = createHmac("sha256", secretKey).update(datetime + method + path + query).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

export class WingError extends Error {}

const friendly = (status: number, message: string) => {
  if (status === 401) return "쿠팡 API 인증에 실패했어요. ACCESS_KEY·SECRET_KEY가 맞는지, 180일 유효기간이 지나지 않았는지 확인해 주세요.";
  if (status === 403) return "쿠팡이 이 컴퓨터의 접속을 막았어요. 윙에서 API 키를 발급할 때 등록한 IP가 지금 이 PC(서버)의 공인 IP와 같은지 확인해 주세요.";
  if (status === 429) return "쿠팡 API 호출이 너무 많아요. 잠시 뒤 다시 시도해 주세요.";
  return `쿠팡 API 오류(${status})${message ? `: ${message}` : ""}`;
};

async function getOrderSheets(from: string, to: string, status: string, nextToken: string) {
  const vendorId = process.env.COUPANG_VENDOR_ID!.trim();
  const path = `/v2/providers/openapi/apis/api/v5/vendors/${encodeURIComponent(vendorId)}/ordersheets`;
  const query = `createdAtFrom=${from}%2B09:00&createdAtTo=${to}%2B09:00&status=${status}&maxPerPage=${PAGE_SIZE}${nextToken ? `&nextToken=${encodeURIComponent(nextToken)}` : ""}`;
  const res = await fetch(`${HOST}${path}?${query}`, {
    headers: {
      Authorization: authorization("GET", path, query, process.env.COUPANG_ACCESS_KEY!.trim(), process.env.COUPANG_SECRET_KEY!.trim()),
      "Content-Type": "application/json;charset=UTF-8",
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { message?: string; data?: WingOrderSheet[]; nextToken?: string };
  if (!res.ok) throw new WingError(friendly(res.status, json.message ?? ""));
  return { data: json.data ?? [], nextToken: json.nextToken ?? "" };
}

/** 기간(한국 날짜, 양 끝 포함)의 살아 있는 주문을 상태별·30일 단위로 모두 받아 합계를 낸다 */
export async function getWingSales(from: string, to: string): Promise<WingSales> {
  const key = `${from}~${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;

  const sheets: WingOrderSheet[] = [];
  for (const [start, end] of dateChunks(from, to)) {
    for (const status of ORDER_STATUSES) {
      let token = "";
      for (let page = 0; page < MAX_PAGES; page++) {
        const { data, nextToken } = await getOrderSheets(start, end, status, token);
        sheets.push(...data);
        if (!nextToken) break;
        token = nextToken;
      }
    }
  }

  const body = summarizeOrderSheets(sheets, from, to);
  cache.set(key, { at: Date.now(), body });
  return body;
}
