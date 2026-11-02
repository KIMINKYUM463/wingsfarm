/**
 * 출고·도착일 계산 — 공급처 마감시각·출고요일·신선 제한요일·공휴일을 반영한다.
 * 택배는 일요일·공휴일에 배송하지 않는다고 가정 (지역·택배사에 따라 다를 수 있음).
 */
import type { Supplier } from "@/types";

export type ShipRule = Pick<Supplier, "cutoffTime" | "shipWeekdays" | "freshBlockedWeekdays">;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 로컬 날짜 기준 YYYY-MM-DD (format.ts와 같은 규칙, 테스트에서 의존 없이 쓰려고 따로 둔다) */
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const parseDateKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const daysBetween = (from: Date, to: Date) => Math.round((addDays(to, 0).getTime() - addDays(from, 0).getTime()) / DAY_MS);

export function isShipDay(date: Date, rule: ShipRule, holidays: Record<string, string>, fresh: boolean) {
  const weekday = date.getDay();
  if (holidays[dateKey(date)]) return false;
  if (!rule.shipWeekdays.includes(weekday)) return false;
  return !(fresh && rule.freshBlockedWeekdays.includes(weekday));
}

const MAX_SCAN_DAYS = 60;

/** 주문 시각 기준 실제 출고일: 오늘이 출고일이고 마감 전이면 오늘, 아니면 다음 출고일 */
export function nextShipDate(orderAt: Date, rule: ShipRule, holidays: Record<string, string>, fresh: boolean): Date | null {
  const [h, m] = rule.cutoffTime.split(":").map(Number);
  const beforeCutoff = orderAt.getHours() * 60 + orderAt.getMinutes() < (h || 0) * 60 + (m || 0);
  for (let i = beforeCutoff ? 0 : 1; i <= MAX_SCAN_DAYS; i++) {
    const day = addDays(orderAt, i);
    if (isShipDay(day, rule, holidays, fresh)) return day;
  }
  return null;
}

/** 출고 다음 날부터 배송일(일요일·공휴일 제외)을 transitDays만큼 센 날 */
export function deliveryDate(shipDate: Date, holidays: Record<string, string>, transitDays = 1): Date {
  let day = shipDate;
  for (let counted = 0; counted < transitDays; ) {
    day = addDays(day, 1);
    if (day.getDay() !== 0 && !holidays[dateKey(day)]) counted++;
  }
  return day;
}

/** before 날짜(포함 안 함) 이전의 마지막 출고일 */
export function lastShipDayBefore(before: Date, rule: ShipRule, holidays: Record<string, string>, fresh: boolean): Date | null {
  for (let i = 1; i <= MAX_SCAN_DAYS; i++) {
    const day = addDays(before, -i);
    if (isShipDay(day, rule, holidays, fresh)) return day;
  }
  return null;
}

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

export interface PrepStep {
  id: string;
  /** 연휴 첫날 기준 며칠 전 */
  daysBefore: number;
  title: string;
  hint: string;
  href?: string;
}

/** 명절 선물 시즌 준비 일정 — 선물세트 상세페이지 가이드·택배 특수기 운영을 기준으로 정리 */
export const HOLIDAY_PREP_STEPS: PrepStep[] = [
  { id: "plan", daysBefore: 45, title: "선물세트 구성·공급 물량 확정", hint: "공급처와 명절 물량·단가·선물 포장 가능 여부를 먼저 확정" },
  { id: "price", daysBefore: 40, title: "선물세트 가격·옵션 설계", hint: "보자기·쇼핑백 등 포장비를 원가에 넣고 역마진 확인", href: "/margin?tab=options" },
  { id: "page", daysBefore: 35, title: "선물용 상세페이지·썸네일", hint: "전체 구성·수량·실제 포장 사진, 누구에게 좋은 선물인지 첫 화면에", href: "/detail-page" },
  { id: "check", daysBefore: 32, title: "등록 전 검수 (원산지·고시·과장 표현)", hint: "선물세트는 구성품별 원산지·소비기한을 빠짐없이", href: "/listing-check" },
  { id: "open", daysBefore: 30, title: "상품 등록·사전예약 오픈", hint: "도착일 지정 옵션, 주문 마감일을 상세 상단에 표시" },
  { id: "content", daysBefore: 25, title: "선물 추천 콘텐츠 발행", hint: "부모님·거래처 선물 추천 카드뉴스·숏폼", href: "/season?tab=content" },
  { id: "courier", daysBefore: 21, title: "택배사 명절 집하 마감일 확인", hint: "공급처에 택배사 특수기 집하 마감·물량 제한을 물어 아래 '마지막 출고일'을 조정" },
  { id: "notice", daysBefore: 14, title: "주문 마감 공지·지연 안내 준비", hint: "상세 상단·톡톡 공지, 마감 후 주문은 연휴 뒤 출고 안내", href: "/cs" },
  { id: "final", daysBefore: 7, title: "마감 주문 출고 점검", hint: "미출고·송장 누락 0건, 신선품은 금요일 출고 피하기", href: "/orders" },
];

/** 선물세트 상세페이지·출고 체크리스트 (소비자원 과일 선물세트 조사·상품정보 고시 기준) */
export const GIFT_CHECKLIST = [
  "세트 구성품 이름·수량·중량이 실제 옵션과 같다",
  "과일은 개당 중량(g) 또는 과수, 당도는 Brix 수치로 적었다 ('특대과·고당도'만 쓰지 않기)",
  "구성품별 원산지(시·군까지)·소비기한·보관 방법을 적었다",
  "실제 선물 포장·배송 포장(보냉재) 사진이 있다 — AI 연출 사진과 구분",
  "주문 마감일과 출고 예정일을 구분해 상단에 적었다",
  "도서산간 추가 비용·배송 제한 지역을 안내했다",
  "신선식품 교환·반품 조건을 적었다",
];
