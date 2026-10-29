import type { SeasonItem } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** 상세페이지·상품등록 준비에 필요한 리드타임 */
export const PREP_LEAD_DAYS = 30;

export interface SeasonStatus {
  item: SeasonItem;
  inSeason: boolean;
  /** 다음 시즌 시작까지 남은 일수 (시즌 중이면 0) */
  daysUntilStart: number;
  /** 시즌 중일 때 이번 달이 마지막 제철 달인지 */
  endingThisMonth: boolean;
}

/** 시즌 시작월 = 제철 월이면서 직전 월은 제철이 아닌 달 (12→1월 연속 고려) */
const startMonths = (months: number[]) => months.filter((m) => !months.includes(m === 1 ? 12 : m - 1));

export function seasonStatus(item: SeasonItem, today: Date): SeasonStatus {
  const month = today.getMonth() + 1;
  const inSeason = item.months.includes(month);
  const nextMonth = month === 12 ? 1 : month + 1;
  const endingThisMonth = inSeason && !item.months.includes(nextMonth);

  if (inSeason) return { item, inSeason, daysUntilStart: 0, endingThisMonth };

  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntilStart = Math.min(
    ...startMonths(item.months).map((m) => {
      const year = m > month ? today.getFullYear() : today.getFullYear() + 1;
      return Math.round((new Date(year, m - 1, 1).getTime() - base.getTime()) / DAY_MS);
    }),
  );
  return { item, inSeason, daysUntilStart, endingThisMonth };
}

export function seasonStatuses(items: SeasonItem[], today: Date) {
  return items.map((item) => seasonStatus(item, today));
}
