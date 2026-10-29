import {
  completedWeeksRange,
  datalabBreakdown,
  datalabKeywords,
  errorMessage,
  openApiCredentials,
  searchAdCredentials,
  searchAdKeywordTool,
  type OpenApiCredentials,
  type SearchAdKeyword,
} from "@/lib/server/naver";
import { titleWordsFromRelated, type KeywordReport, type SearchVolume } from "@/lib/keyword";

const CACHE_MS = 6 * 60 * 60 * 1000;
/** 일부 API가 빠진 결과는 키·권한 설정 후 곧 다시 조회되도록 짧게 캐시 */
const PARTIAL_CACHE_MS = 5 * 60 * 1000;
const CACHE_LIMIT = 300;
const RELATED_LIMIT = 50;

const cache = new Map<string, { data: KeywordReport; expires: number }>();

type Notices = KeywordReport["notices"];

const MISSING: Record<Notices[number]["service"], string> = {
  searchad: "월간 검색수·연관 키워드를 보려면 네이버 검색광고 API 키가 필요합니다.",
  datalab: "검색 추이·성별·연령을 보려면 네이버 개발자센터 키가 필요합니다.",
};

/** 실패한 데이터는 null로 두고 안내문만 남겨, 나머지 분석은 계속 보여준다 */
async function attempt<T>(service: Notices[number]["service"], notices: Notices, task: (() => Promise<T>) | null): Promise<T | null> {
  if (!task) {
    notices.push({ service, message: MISSING[service] });
    return null;
  }
  try {
    return await task();
  } catch (err) {
    console.error(`[keyword:${service}]`, err);
    const message = errorMessage(err);
    if (!notices.some((n) => n.message === message)) notices.push({ service, message });
    return null;
  }
}

const task = <C, T>(creds: C | null, fn: (creds: C) => Promise<T>) => (creds ? () => fn(creds) : null);

const count = (v: number | string) => (typeof v === "number" ? v : 0);

function toVolume(k: SearchAdKeyword): SearchVolume {
  const pc = count(k.monthlyPcQcCnt);
  const mobile = count(k.monthlyMobileQcCnt);
  const clicks = count(k.monthlyAvePcClkCnt) + count(k.monthlyAveMobileClkCnt);
  return { pc, mobile, total: pc + mobile, clicks: Math.round(clicks), ctr: pc + mobile > 0 ? clicks / (pc + mobile) : 0, adCompetition: k.compIdx };
}

/** 월별 클릭 비중을 그룹별로 합산해 전체 기간 비율로 만든다 */
function shares(points: { group: string; ratio: number }[]) {
  const totals = new Map<string, number>();
  points.forEach((p) => totals.set(p.group, (totals.get(p.group) ?? 0) + p.ratio));
  const sum = [...totals.values()].reduce((a, b) => a + b, 0) || 1;
  return new Map([...totals].map(([g, v]) => [g, v / sum]));
}

async function audience(creds: OpenApiCredentials, keyword: string, today: Date) {
  const range = completedWeeksRange(today, 52);
  const [age, gender, device] = await Promise.all(
    (["age", "gender", "device"] as const).map((kind) => datalabBreakdown(creds, range, kind, keyword).then(shares)),
  );
  return {
    gender: { female: gender.get("f") ?? 0, male: gender.get("m") ?? 0 },
    device: { mobile: device.get("mo") ?? 0, pc: device.get("pc") ?? 0 },
    age: ["10", "20", "30", "40", "50", "60"].map((group) => ({ group, share: age.get(group) ?? 0 })),
  };
}

async function trend(creds: OpenApiCredentials, keyword: string, today: Date) {
  const [series] = await datalabKeywords(creds, completedWeeksRange(today, 52), "week", [{ name: keyword, query: keyword }]);
  if (!series || series.data.length === 0) return null;
  return { periods: series.data.map((d) => d.period), values: series.data.map((d) => d.ratio) };
}

async function buildReport(keyword: string): Promise<KeywordReport> {
  const today = new Date();
  const notices: Notices = [];
  const datalab = openApiCredentials();

  const [adList, trendData, audienceData] = await Promise.all([
    attempt("searchad", notices, task(searchAdCredentials(), (c) => searchAdKeywordTool(c, keyword))),
    attempt("datalab", notices, task(datalab, (c) => trend(c, keyword, today))),
    attempt("datalab", notices, task(datalab, (c) => audience(c, keyword, today))),
  ]);

  const compact = keyword.replace(/\s+/g, "").toLowerCase();
  const self = adList?.find((k) => k.relKeyword.toLowerCase() === compact);
  const related = (adList ?? [])
    .filter((k) => k !== self)
    .map((k) => ({ keyword: k.relKeyword, volume: toVolume(k) }))
    .sort((a, b) => b.volume.total - a.volume.total);

  return {
    keyword,
    updatedAt: today.toISOString(),
    volume: self ? toVolume(self) : null,
    related: related.slice(0, RELATED_LIMIT),
    titleWords: titleWordsFromRelated(keyword, related),
    trend: trendData,
    audience: audienceData,
    notices,
  };
}

/** 키워드 분석 리포트 (분석 화면과 AI 분석이 같은 캐시를 공유) */
export async function getKeywordReport(keyword: string): Promise<KeywordReport> {
  const cached = cache.get(keyword);
  if (cached && cached.expires > Date.now()) return cached.data;

  const data = await buildReport(keyword);
  // 한 곳도 성공하지 못했으면 키 설정 후 바로 다시 시도할 수 있게 캐시하지 않는다
  if (data.volume || data.trend || data.audience) {
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(keyword, { data, expires: Date.now() + (data.notices.length > 0 ? PARTIAL_CACHE_MS : CACHE_MS) });
  }
  return data;
}
