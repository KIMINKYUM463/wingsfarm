/** 명절 전 마지막 출고일·연휴 뒤 첫 출고일 계산 (순수 함수) */
import { addDays, deliveryDate, lastShipDayBefore, nextShipDate, type MajorHoliday, type ShipRule } from "./shipping.ts";

export interface HolidayShipPlan {
  /** 이날 마감 전 주문까지 연휴 전 도착 (null이면 60일 안에 출고일 없음) */
  lastShip: Date | null;
  lastArrive: Date | null;
  /** 연휴 뒤 첫 출고일 */
  resumeShip: Date | null;
}

/**
 * bufferDays: 택배사 명절 특수기 여유 — 연휴 첫날보다 며칠 먼저 도착해야 안전한지.
 * 도착 예정일이 (연휴 첫날 − bufferDays) 이전인 가장 늦은 출고일을 찾는다.
 */
export function holidayShipPlan(holiday: Pick<MajorHoliday, "first" | "last">, rule: ShipRule, holidays: Record<string, string>, fresh: boolean, bufferDays = 2): HolidayShipPlan {
  const arriveBy = addDays(holiday.first, -bufferDays);
  let ship = lastShipDayBefore(holiday.first, rule, holidays, fresh);
  while (ship && deliveryDate(ship, holidays) > arriveBy) ship = lastShipDayBefore(ship, rule, holidays, fresh);
  const resumeAt = addDays(holiday.last, 1);
  return {
    lastShip: ship,
    lastArrive: ship ? deliveryDate(ship, holidays) : null,
    resumeShip: nextShipDate(new Date(resumeAt.getFullYear(), resumeAt.getMonth(), resumeAt.getDate(), 0, 0), rule, holidays, fresh),
  };
}
