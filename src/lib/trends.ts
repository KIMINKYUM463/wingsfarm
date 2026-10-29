import type { SeasonCategory } from "@/types";
import { SEASON_ITEMS } from "@/lib/data/season";
import { seasonStatus } from "@/lib/season";
import { toDateKey } from "@/lib/format";

export interface TrendItem {
  name: string;
  category: SeasonCategory;
  /** 전체 조회기간 주간 관심도 (전 품목·전 기간 최고 주간값 = 100) */
  series: number[];
  inSeason: boolean;
  daysUntilStart: number;
  tip: string;
}

export interface TrendsResponse {
  source: "naver" | "season";
  updatedAt: string;
  /** 각 주의 시작일 (series와 같은 길이) */
  periods: string[];
  items: TrendItem[];
  /** 네이버 호출 실패 시 제철 정보로 대체하면서 보여줄 안내 */
  warning?: string;
}

/** 연중 검색량이 꾸준해 배치 간 환산 기준으로 쓰는 키워드 */
export const ANCHOR_KEYWORD = "사과";
/** "요즘 뜨는" 판단에 쓰는 최근 주 수 */
export const RECENT_WEEKS = 12;
/** 검색량이 이보다 적으면 증감률이 튀므로 순위·판단에서 제외 */
export const MIN_SCORE = 3;
/** 작년 이맘때 직전 기준구간 주 수 */
const BASELINE_WEEKS = 4;

export interface RawSeries {
  name: string;
  data: { period: string; ratio: number }[];
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const ratioChange = (current: number, base: number) => (base > 0 ? current / base - 1 : current > 0 ? 1 : 0);

function withSeason(name: string, series: number[], today: Date): TrendItem {
  const meta = SEASON_ITEMS.find((i) => i.name === name)!;
  const status = seasonStatus(meta, today);
  return { name, category: meta.category, series, inSeason: status.inSeason, daysUntilStart: status.daysUntilStart, tip: meta.tip };
}

/**
 * 배치마다 따로 0~100으로 정규화된 값을 기준 키워드(사과)의 합계로 환산해
 * 전 품목을 같은 잣대로 비교할 수 있게 만든다.
 */
export function combineBatches(batches: RawSeries[][], periods: string[], today: Date): TrendItem[] {
  const align = (s: RawSeries) => {
    const byPeriod = new Map(s.data.map((d) => [d.period, d.ratio]));
    return periods.map((p) => byPeriod.get(p) ?? 0);
  };

  const anchorTotals = batches.map((batch) => {
    const anchor = batch.find((s) => s.name === ANCHOR_KEYWORD);
    return anchor ? align(anchor).reduce((a, b) => a + b, 0) : 0;
  });
  const reference = anchorTotals.find((t) => t > 0) ?? 1;

  const merged = new Map<string, number[]>();
  batches.forEach((batch, i) => {
    const factor = anchorTotals[i] > 0 ? reference / anchorTotals[i] : 1;
    batch.forEach((s) => {
      if (!merged.has(s.name)) merged.set(s.name, align(s).map((v) => v * factor));
    });
  });

  const peak = Math.max(1, ...[...merged.values()].flat());
  return [...merged.entries()].map(([name, series]) =>
    withSeason(
      name,
      series.map((v) => (v / peak) * 100),
      today,
    ),
  );
}

/** 네이버 API 키가 없을 때: 실제 검색량 없이 제철 정보만 (series는 비워 둔다) */
export function seasonOnlyTrends(today: Date): TrendItem[] {
  return SEASON_ITEMS.map((meta) => withSeason(meta.name, [], today));
}

export interface CurrentTrend {
  /** 최근 12주 주간 관심도 */
  recent: number[];
  /** 최근 2주 평균 관심도 */
  score: number;
  /** 최근 2주 평균 ÷ 직전 4주 평균 − 1 */
  growth: number;
}

export function currentTrend(item: TrendItem): CurrentTrend {
  const recent = item.series.slice(-RECENT_WEEKS);
  const score = avg(recent.slice(-2));
  return { recent, score, growth: ratioChange(score, avg(recent.slice(-6, -2))) };
}

export interface SourcingOutlook {
  /** 작년 [기준구간 + 앞으로 horizon주] 관심도 */
  window: number[];
  /** window 안에서 "작년 이맘때" 위치 */
  nowIndex: number;
  /** 작년 이맘때 이후 horizon주 평균이 직전 4주 평균보다 얼마나 올랐는지 */
  rise: number;
  /** 작년 horizon 기간 중 최고점 상승률과 그 주 */
  peakGain: number;
  peakPeriod: string;
  /** 작년 이맘때 직전 4주 평균 관심도 */
  lastYearScore: number;
  /** 작년 같은 4주 대비 올해 최근 4주 증감 (식품 전체 검색 증감을 걷어낸 값) */
  yoy: number;
}

/** 주별 전 품목 관심도 합계 — 식품 쇼핑 검색 자체가 늘거나 준 효과를 보정할 때 쓴다 */
export function marketSeries(items: TrendItem[]): number[] {
  const length = items[0]?.series.length ?? 0;
  return Array.from({ length }, (_, k) => items.reduce((sum, i) => sum + i.series[k], 0));
}

/** 52주(364일) 전 = 요일까지 같은 "작년 이맘때" 주의 위치 */
export function lastYearIndex(periods: string[], today: Date) {
  const lastYear = new Date(today);
  lastYear.setDate(lastYear.getDate() - 364);
  const key = toDateKey(lastYear);
  return periods.findLastIndex((p) => p <= key);
}

/** 작년 같은 주를 찾아, 그 뒤 horizon주 동안의 흐름으로 지금 소싱할 가치를 본다 */
export function sourcingOutlook(
  item: TrendItem,
  market: number[],
  periods: string[],
  today: Date,
  horizonWeeks: number,
): SourcingOutlook | null {
  const nowIdx = lastYearIndex(periods, today);
  if (nowIdx < BASELINE_WEEKS - 1 || nowIdx + horizonWeeks >= periods.length) return null;

  const lastYearRange = [nowIdx - BASELINE_WEEKS + 1, nowIdx + 1] as const;
  const baseline = item.series.slice(...lastYearRange);
  const forward = item.series.slice(nowIdx + 1, nowIdx + 1 + horizonWeeks);
  const baseAvg = avg(baseline);
  const peakOffset = forward.indexOf(Math.max(...forward));
  const itemYoy = ratioChange(avg(item.series.slice(-BASELINE_WEEKS)), baseAvg);
  const marketYoy = ratioChange(avg(market.slice(-BASELINE_WEEKS)), avg(market.slice(...lastYearRange)));

  return {
    window: [...baseline, ...forward],
    nowIndex: BASELINE_WEEKS - 1,
    rise: ratioChange(avg(forward), baseAvg),
    peakGain: ratioChange(forward[peakOffset], baseAvg),
    peakPeriod: periods[nowIdx + 1 + peakOffset],
    lastYearScore: baseAvg,
    yoy: (1 + itemYoy) / (1 + marketYoy) - 1,
  };
}

export interface YearComparison {
  /** 작년 [이맘때 12주 전 ~ 이맘때 + aheadWeeks] */
  lastYear: number[];
  /** 올해 최근 12주 (식품 전체 증감을 보정해 작년과 같은 잣대) */
  thisYear: number[];
  nowIndex: number;
  startPeriod: string;
  endPeriod: string;
}

export function yearComparison(item: TrendItem, market: number[], periods: string[], today: Date, aheadWeeks = 8): YearComparison | null {
  const nowIdx = lastYearIndex(periods, today);
  const start = nowIdx - RECENT_WEEKS + 1;
  if (start < 0 || nowIdx + aheadWeeks >= periods.length) return null;
  const marketFactor = avg(market.slice(start, nowIdx + 1)) / (avg(market.slice(-RECENT_WEEKS)) || 1);
  return {
    lastYear: item.series.slice(start, nowIdx + 1 + aheadWeeks),
    thisYear: item.series.slice(-RECENT_WEEKS).map((v) => v * marketFactor),
    nowIndex: RECENT_WEEKS - 1,
    startPeriod: periods[start],
    endPeriod: periods[nowIdx + aheadWeeks],
  };
}

export type VerdictTone = "go" | "test" | "hold" | "clear" | "unknown";

export interface SourcingVerdict {
  tone: VerdictTone;
  title: string;
  message: string;
}

/** 작년 흐름(향후 상승)과 올해 인기(작년 대비)를 조합한 소싱 판단 */
export function sourcingVerdict(outlook: SourcingOutlook | null): SourcingVerdict {
  if (!outlook || outlook.lastYearScore < MIN_SCORE) {
    return { tone: "unknown", title: "판단 보류", message: "작년 이 시기 검색량이 적어 흐름을 판단하기 어렵습니다. 제철 정보를 참고하세요." };
  }
  const peak = `작년엔 ${weekLabel(outlook.peakPeriod)}에 정점(${Math.round(outlook.peakGain * 100)}%↑)을 찍었습니다.`;
  if (outlook.rise >= 0.3) {
    return outlook.yoy >= -0.1
      ? { tone: "go", title: "지금 소싱 적기", message: `${peak} 올해 관심도 작년 수준 이상이라, 지금 공급처와 물량을 잡아두세요.` }
      : { tone: "test", title: "소량 테스트 권장", message: `${peak} 다만 올해 관심이 작년보다 낮아 물량은 보수적으로 잡으세요.` };
  }
  if (outlook.rise <= -0.1) {
    return { tone: "clear", title: "재고 소진 시점", message: `작년엔 이 시기 이후 검색이 ${Math.round(-outlook.rise * 100)}% 줄었습니다. 신규 소싱보다 재고 정리에 집중하세요.` };
  }
  return { tone: "hold", title: "현상 유지", message: "작년 이 시기 이후 큰 변동이 없었습니다. 기존 물량을 유지하세요." };
}

/** "2025-10-13" → "10월 2주" */
export function weekLabel(period: string) {
  const [, m, d] = period.split("-").map(Number);
  return `${m}월 ${Math.ceil(d / 7)}주`;
}
