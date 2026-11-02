/**
 * 콘텐츠 캘린더 — 제철 시작·한창·막바지와 명절 일정을 주 단위 게시 계획으로 바꾼다.
 * 내 상품(등록 SKU)에 해당하는 품목을 먼저 배치하고, 형식은 짧은 것/긴 것을 번갈아 고른다.
 */
import type { SeasonItem } from "@/types";
import type { MarketingFormat } from "./marketingAi.ts";
import { seasonStatus } from "./season.ts";
import { addDays, dateKey, upcomingMajorHolidays } from "./holidays.ts";

export interface ContentPost {
  id: string;
  weekStart: string;
  item: string;
  format: MarketingFormat;
  angle: string;
  reason: string;
}

/** 짧은 형식(도달)과 긴 형식(검색·저장)을 한 주에 하나씩 */
const SHORT_FORMATS: MarketingFormat[] = ["shorts", "threads", "shorts", "chat"];
const LONG_FORMATS: MarketingFormat[] = ["carousel", "blog", "carousel", "blog"];

const IN_SEASON_ANGLES = ["산지 이야기 — 수확 현장", "잘 고르는 법", "보관법·손질법", "맛있게 먹는 법·레시피", "구매 후기 모음"];

function mondayOf(date: Date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

interface Candidate {
  item: string;
  angle: string;
  reason: string;
  priority: number;
}

function candidatesForWeek(week: Date, items: SeasonItem[], mine: Set<string>, holidays: Record<string, string>, weekIndex: number): Candidate[] {
  const list: Candidate[] = [];
  const boost = (name: string) => (mine.has(name) ? 10 : 0);

  for (const holiday of upcomingMajorHolidays(holidays, week, 1)) {
    const days = Math.round((holiday.first.getTime() - week.getTime()) / 86_400_000);
    if (days >= 7 && days <= 35) {
      list.push({ item: `${holiday.name} 선물세트`, angle: `${holiday.name} 선물 추천 — 받는 분별 구성`, reason: `${holiday.name} 연휴까지 ${days}일`, priority: 30 });
    }
  }

  for (const item of items) {
    const s = seasonStatus(item, week);
    if (!s.inSeason && s.daysUntilStart <= 21) {
      list.push({ item: item.name, angle: "시즌 오픈 예고 — 첫 수확 소식", reason: `시즌 D-${s.daysUntilStart}`, priority: 20 + boost(item.name) });
    } else if (s.endingThisMonth) {
      list.push({ item: item.name, angle: "막바지 — 올해 마지막 수확", reason: "이번 달 시즌 종료", priority: 12 + boost(item.name) });
    } else if (s.inSeason) {
      const angle = IN_SEASON_ANGLES[(weekIndex + item.name.length) % IN_SEASON_ANGLES.length];
      list.push({ item: item.name, angle, reason: "지금 제철", priority: 8 + boost(item.name) });
    }
  }
  return list.sort((a, b) => b.priority - a.priority);
}

export function buildContentPlan(items: SeasonItem[], myProducts: string[], holidays: Record<string, string>, today = new Date(), weeks = 8): ContentPost[] {
  const mine = new Set(items.filter((i) => myProducts.some((p) => p.includes(i.name))).map((i) => i.name));
  const start = mondayOf(today);
  const posts: ContentPost[] = [];
  const recent: string[] = [];

  for (let w = 0; w < weeks; w++) {
    const week = addDays(start, w * 7);
    const weekStart = dateKey(week);
    // 직전 2주에 다룬 품목은 뒤로 미뤄 같은 품목만 반복하지 않게
    const pool = candidatesForWeek(week, items, mine, holidays, w).sort((a, b) => Number(recent.includes(a.item)) - Number(recent.includes(b.item)));
    const picks = pool.slice(0, 2);
    picks.forEach((pick, i) => {
      const format = i === 0 ? SHORT_FORMATS[w % SHORT_FORMATS.length] : LONG_FORMATS[w % LONG_FORMATS.length];
      posts.push({ id: `${weekStart}:${i}`, weekStart, item: pick.item, format, angle: pick.angle, reason: pick.reason });
    });
    recent.push(...picks.map((p) => p.item));
    recent.splice(0, Math.max(0, recent.length - 4));
  }
  return posts;
}
