/** 명절 연휴 날짜 계산 (콘텐츠 캘린더의 선물세트 글 일정에 쓴다) */

/** 로컬 날짜 기준 YYYY-MM-DD (format.ts와 같은 규칙, 테스트에서 의존 없이 쓰려고 따로 둔다) */
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const parseDateKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** 명절 본날(설날·추석)이 포함된 연휴의 첫날·마지막 날 */
export function holidayBlock(holidays: Record<string, string>, mainDay: string) {
  let first = parseDateKey(mainDay);
  let last = first;
  while (holidays[dateKey(addDays(first, -1))]) first = addDays(first, -1);
  while (holidays[dateKey(addDays(last, 1))]) last = addDays(last, 1);
  return { first, last };
}

export interface MajorHoliday {
  name: "설날" | "추석";
  mainDay: string;
  first: Date;
  last: Date;
}

export function upcomingMajorHolidays(holidays: Record<string, string>, from: Date, limit = 2): MajorHoliday[] {
  const today = dateKey(from);
  return Object.entries(holidays)
    .filter(([date, name]) => (name === "설날" || name === "추석") && date >= today)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, limit)
    .map(([mainDay, name]) => ({ name: name as MajorHoliday["name"], mainDay, ...holidayBlock(holidays, mainDay) }));
}
