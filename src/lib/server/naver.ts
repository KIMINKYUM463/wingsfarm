import { createHmac } from "node:crypto";
import { toDateKey } from "@/lib/format";

/** 식품 분야 (쇼핑인사이트 카테고리 코드) */
export const FOOD_CATEGORY = "50000006";

export type NaverService = "datalab" | "searchad";

const SERVICE_LABEL: Record<NaverService, string> = {
  datalab: "데이터랩(쇼핑인사이트)",
  searchad: "검색광고",
};

export class NaverApiError extends Error {
  constructor(
    readonly service: NaverService,
    readonly status: number,
    readonly body: string,
  ) {
    super(`네이버 ${SERVICE_LABEL[service]} API ${status}: ${body}`);
  }

  get userMessage() {
    if (this.service === "datalab" && this.body.includes('"024"')) {
      return `네이버 애플리케이션에 '${SERVICE_LABEL[this.service]}' API 권한이 없습니다. 개발자센터 > 내 애플리케이션 > API 설정에서 추가해 주세요.`;
    }
    if (this.status === 401 || this.status === 403) {
      return this.service === "searchad" ? "네이버 검색광고 API 키(액세스 라이선스·비밀키·고객 ID)를 확인해 주세요." : "네이버 Client ID/Secret이 올바르지 않습니다.";
    }
    if (this.status === 429) return `네이버 ${SERVICE_LABEL[this.service]} API 호출 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.`;
    const detail = this.detail;
    return `네이버 ${SERVICE_LABEL[this.service]} API 오류(${this.status})${detail ? `: ${detail}` : ""}`;
  }

  /** 네이버가 준 오류 설명 (errorMessage 또는 검색광고의 title) */
  private get detail() {
    try {
      const json = JSON.parse(this.body) as { errorMessage?: string; title?: string; message?: string };
      return json.errorMessage ?? json.title ?? json.message ?? "";
    } catch {
      return this.body.slice(0, 120);
    }
  }
}

export const errorMessage = (err: unknown) => (err instanceof NaverApiError ? err.userMessage : "네트워크 오류로 네이버 데이터를 불러오지 못했습니다.");

export interface OpenApiCredentials {
  id: string;
  secret: string;
}

export interface SearchAdCredentials {
  apiKey: string;
  secretKey: string;
  customerId: string;
}

export function openApiCredentials(): OpenApiCredentials | null {
  const { NAVER_CLIENT_ID: id, NAVER_CLIENT_SECRET: secret } = process.env;
  return id && secret ? { id, secret } : null;
}

export function searchAdCredentials(): SearchAdCredentials | null {
  const { NAVER_AD_API_KEY: apiKey, NAVER_AD_SECRET_KEY: secretKey, NAVER_AD_CUSTOMER_ID: customerId } = process.env;
  return apiKey && secretKey && customerId ? { apiKey, secretKey, customerId } : null;
}

async function request<T>(service: NaverService, url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) throw new NaverApiError(service, res.status, await res.text());
  return res.json() as Promise<T>;
}

const openApiHeaders = ({ id, secret }: OpenApiCredentials) => ({ "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret });

export interface DateRange {
  startDate: string;
  endDate: string;
}

/** 진행 중인 주는 클릭이 덜 쌓여 하락처럼 보이므로 지난주 일요일까지의 완결된 주만 조회 */
export function completedWeeksRange(today: Date, weeks: number): DateRange {
  const end = new Date(today);
  end.setDate(end.getDate() - (end.getDay() === 0 ? 7 : end.getDay()));
  const start = new Date(end);
  start.setDate(start.getDate() - weeks * 7 + 1);
  return { startDate: toDateKey(start), endDate: toDateKey(end) };
}

/** 이번 달은 아직 덜 쌓였으므로 지난달까지 완결된 months개월 (각 달 1일 목록 포함) */
export function completedMonthsRange(today: Date, months: number): DateRange & { monthStarts: string[] } {
  const end = new Date(today.getFullYear(), today.getMonth(), 0);
  const monthStarts = Array.from({ length: months }, (_, i) => toDateKey(new Date(end.getFullYear(), end.getMonth() - months + 1 + i, 1)));
  return { startDate: monthStarts[0], endDate: toDateKey(end), monthStarts };
}

export interface DatalabPoint {
  period: string;
  ratio: number;
}

/** 쇼핑인사이트: 키워드별 클릭 추이 (요청당 최대 5개, 값은 요청 안에서의 상대값) */
export async function datalabKeywords(creds: OpenApiCredentials, range: DateRange, timeUnit: "week" | "month", keywords: { name: string; query: string }[]) {
  const json = await request<{ results: { title: string; data: DatalabPoint[] }[] }>("datalab", "https://openapi.naver.com/v1/datalab/shopping/category/keywords", {
    method: "POST",
    headers: { ...openApiHeaders(creds), "Content-Type": "application/json" },
    body: JSON.stringify({ ...range, timeUnit, category: FOOD_CATEGORY, keyword: keywords.map((k) => ({ name: k.name, param: [k.query] })) }),
  });
  return json.results.map((r) => ({ name: r.title, data: r.data }));
}

/** 쇼핑인사이트: 한 키워드의 성별·연령·기기별 클릭 추이 */
export async function datalabBreakdown(creds: OpenApiCredentials, range: DateRange, kind: "age" | "gender" | "device", keyword: string) {
  const json = await request<{ results: { data: (DatalabPoint & { group: string })[] }[] }>(
    "datalab",
    `https://openapi.naver.com/v1/datalab/shopping/category/keyword/${kind}`,
    {
      method: "POST",
      headers: { ...openApiHeaders(creds), "Content-Type": "application/json" },
      body: JSON.stringify({ ...range, timeUnit: "month", category: FOOD_CATEGORY, keyword }),
    },
  );
  return json.results[0]?.data ?? [];
}

export interface SearchAdKeyword {
  relKeyword: string;
  /** 10 미만이면 "< 10" 문자열로 온다 */
  monthlyPcQcCnt: number | string;
  monthlyMobileQcCnt: number | string;
  monthlyAvePcClkCnt: number | string;
  monthlyAveMobileClkCnt: number | string;
  monthlyAvePcCtr: number | string;
  monthlyAveMobileCtr: number | string;
  plAvgDepth: number | string;
  compIdx: string;
}

/** 검색광고 API 키워드 도구: 월간 검색수 + 연관 키워드 (공백 없는 키워드만 허용) */
export async function searchAdKeywordTool({ apiKey, secretKey, customerId }: SearchAdCredentials, hint: string) {
  const uri = "/keywordstool";
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", secretKey).update(`${timestamp}.GET.${uri}`).digest("base64");
  const params = new URLSearchParams({ hintKeywords: hint.replace(/\s+/g, ""), showDetail: "1" });
  const json = await request<{ keywordList: SearchAdKeyword[] }>("searchad", `https://api.searchad.naver.com${uri}?${params}`, {
    headers: { "X-Timestamp": timestamp, "X-API-KEY": apiKey, "X-Customer": customerId, "X-Signature": signature },
  });
  return json.keywordList;
}
