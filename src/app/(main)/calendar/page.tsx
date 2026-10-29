"use client";

import Link from "next/link";
import { useState } from "react";
import type { Supplier } from "@/types";
import { Badge, Button, Card, CopyButton, EmptyState, Field, Notice, NumberInput, PageHeader, Select, TextInput, Toggle } from "@/components/ui";
import { emptySupplier } from "@/lib/data/defaults";
import { WEEKDAYS, formatDate } from "@/lib/format";
import { holidayShipPlan } from "@/lib/holidayPlan";
import { GIFT_CHECKLIST, HOLIDAY_PREP_STEPS, addDays, dateKey, daysBetween, deliveryDate, nextShipDate, parseDateKey, upcomingMajorHolidays, type MajorHoliday } from "@/lib/shipping";
import { useAppStore } from "@/store/useAppStore";

const GRID_DAYS = 14;

/** datetime-local 입력값 (로컬 시각) */
const toLocalInput = (d: Date) => `${dateKey(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function blockReason(date: Date, rule: Supplier, holidays: Record<string, string>, fresh: boolean) {
  if (holidays[dateKey(date)]) return holidays[dateKey(date)];
  if (!rule.shipWeekdays.includes(date.getDay())) return "출고 안 함";
  if (fresh && rule.freshBlockedWeekdays.includes(date.getDay())) return "신선 금지";
  return "";
}

function ArrivalCalculator({ supplier, fresh }: { supplier: Supplier; fresh: boolean }) {
  const holidays = useAppStore((s) => s.holidays);
  const [orderAt, setOrderAt] = useState(() => toLocalInput(new Date()));
  const at = new Date(orderAt);
  const valid = !Number.isNaN(at.getTime());
  const ship = valid ? nextShipDate(at, supplier, holidays, fresh) : null;
  const arrive = ship ? deliveryDate(ship, holidays) : null;
  const today = new Date();

  return (
    <Card title="주문하면 언제 도착하나요?">
      <Field label="주문 일시">
        <TextInput type="datetime-local" value={orderAt} onChange={(e) => setOrderAt(e.target.value)} />
      </Field>
      {ship && arrive ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-stone-50 p-3">
            <div className="text-xs text-stone-500">출고</div>
            <div className="text-lg font-bold">{formatDate(ship)}</div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="text-xs text-emerald-700">도착 예상</div>
            <div className="text-lg font-bold text-emerald-700">{formatDate(arrive)}</div>
          </div>
        </div>
      ) : (
        <Notice tone="loss" className="mt-3">
          60일 안에 출고할 수 있는 날이 없어요. 공급처 출고 요일을 확인하세요.
        </Notice>
      )}
      <p className="mt-3 text-xs text-stone-500">
        {supplier.cutoffTime} 마감 · 택배는 일요일·공휴일에 배송하지 않는다고 보고 다음 날 도착(1일 배송)으로 계산해요. 제주·도서산간은 1~2일 더 걸려요.
      </p>
      <div className="mt-4 grid grid-cols-7 gap-1">
        {Array.from({ length: GRID_DAYS }, (_, i) => addDays(today, i)).map((d) => {
          const reason = blockReason(d, supplier, holidays, fresh);
          return (
            <div key={dateKey(d)} className={`rounded-lg p-1.5 text-center text-xs ${reason ? "bg-stone-100 text-stone-400" : "bg-emerald-50 text-emerald-800"}`} title={reason || "출고 가능"}>
              <div className={d.getDay() === 0 ? "text-rose-500" : ""}>
                {d.getMonth() + 1}/{d.getDate()}({WEEKDAYS[d.getDay()]})
              </div>
              <div className="truncate font-medium">{reason || "출고"}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function HolidayPlanCard({ holiday, supplier, fresh }: { holiday: MajorHoliday; supplier: Supplier; fresh: boolean }) {
  const { holidays, opsChecks, toggleOpsCheck } = useAppStore();
  const [buffer, setBuffer] = useState(2);
  const plan = holidayShipPlan(holiday, supplier, holidays, fresh, buffer);
  const today = new Date();
  const dDay = daysBetween(today, holiday.first);
  const key = (id: string) => `gift:${holiday.mainDay}:${id}`;

  const notice = plan.lastShip
    ? `[${holiday.name} 연휴 배송 안내]\n${formatDate(plan.lastShip)} ${supplier.cutoffTime}까지 주문하시면 연휴 전(${formatDate(plan.lastArrive!)}경) 받아보실 수 있어요.\n이후 주문은 연휴가 끝난 ${plan.resumeShip ? formatDate(plan.resumeShip) : "연휴 뒤"}부터 순서대로 보내드립니다.\n신선식품 특성상 연휴 중에는 발송하지 않는 점 양해 부탁드립니다.`
    : "";

  return (
    <Card
      title={
        <>
          {holiday.name} 연휴 {formatDate(holiday.first)}~{formatDate(holiday.last)} <Badge tone={dDay <= 21 ? "loss" : dDay <= 45 ? "warn" : "default"}>D-{dDay}</Badge>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-rose-50 p-3">
              <div className="text-xs text-rose-700">연휴 전 마지막 출고</div>
              <div className="font-bold text-rose-700">{plan.lastShip ? formatDate(plan.lastShip) : "-"}</div>
              <div className="text-xs text-rose-600">{supplier.cutoffTime} 마감</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-3">
              <div className="text-xs text-stone-500">그 주문 도착</div>
              <div className="font-bold">{plan.lastArrive ? formatDate(plan.lastArrive) : "-"}</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-3">
              <div className="text-xs text-stone-500">연휴 뒤 첫 출고</div>
              <div className="font-bold">{plan.resumeShip ? formatDate(plan.resumeShip) : "-"}</div>
            </div>
          </div>
          <Field label="연휴 첫날보다 며칠 먼저 도착해야 안전한가요?" hint="명절 직전엔 택배 물량이 몰려 1~3일 늦어지는 일이 흔해요. 택배사 집하 마감 공지를 보고 조정하세요.">
            <NumberInput value={buffer} min={0} max={10} onValueChange={(v) => setBuffer(Math.min(10, Math.max(0, Math.round(v))))} suffix="일" />
          </Field>
          {notice && (
            <div className="rounded-xl bg-stone-50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500">상세 상단·톡톡 공지 문구</span>
                <CopyButton text={notice} />
              </div>
              <p className="whitespace-pre-wrap text-sm text-stone-700">{notice}</p>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-stone-700">준비 일정 (연휴 첫날 기준)</p>
          <ul className="space-y-1.5">
            {HOLIDAY_PREP_STEPS.map((step) => {
              const due = addDays(holiday.first, -step.daysBefore);
              const left = daysBetween(today, due);
              const done = Boolean(opsChecks[key(step.id)]);
              return (
                <li key={step.id} className={`flex items-start gap-2 rounded-lg p-2 ${!done && left < 0 ? "bg-rose-50" : !done && left <= 3 ? "bg-amber-50" : ""}`}>
                  <input type="checkbox" checked={done} onChange={() => toggleOpsCheck(key(step.id))} className="mt-1 size-4 accent-emerald-600" aria-label={step.title} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm ${done ? "text-stone-400 line-through" : "text-stone-800"}`}>
                      <span className="mr-1.5 text-xs tabular-nums text-stone-500">{formatDate(due)}</span>
                      {step.href ? (
                        <Link href={step.href} className="hover:text-emerald-700 hover:underline">
                          {step.title}
                        </Link>
                      ) : (
                        step.title
                      )}
                    </div>
                    <p className="text-xs text-stone-500">{step.hint}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-stone-200 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-stone-700">
          선물세트 점검표 ({GIFT_CHECKLIST.filter((_, i) => opsChecks[key(`list${i}`)]).length}/{GIFT_CHECKLIST.length})
        </summary>
        <ul className="mt-2 space-y-1">
          {GIFT_CHECKLIST.map((item, i) => (
            <li key={item}>
              <Toggle checked={Boolean(opsChecks[key(`list${i}`)])} onChange={() => toggleOpsCheck(key(`list${i}`))} label={item} />
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function HolidayEditor() {
  const { holidays, setHoliday } = useAppStore();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const today = dateKey(new Date());
  const upcoming = Object.entries(holidays)
    .filter(([d]) => d >= today)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <Card title="공휴일·택배 휴무일">
      <p className="mb-3 text-xs text-stone-500">택배 없는 날(택배 쉬는 날, 임시공휴일)을 추가하면 모든 출고·도착 계산에 반영돼요.</p>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <TextInput type="date" className="w-auto!" value={date} onChange={(e) => setDate(e.target.value)} aria-label="날짜" />
        <TextInput className="w-40!" value={name} onChange={(e) => setName(e.target.value)} placeholder="택배 없는 날" aria-label="이름" />
        <Button
          variant="secondary"
          disabled={!date || !name.trim()}
          onClick={() => {
            setHoliday(date, name.trim());
            setDate("");
            setName("");
          }}
        >
          추가
        </Button>
      </div>
      <ul className="max-h-64 divide-y divide-stone-100 overflow-y-auto text-sm">
        {upcoming.map(([d, n]) => (
          <li key={d} className="flex items-center justify-between py-1.5">
            <span>
              <span className="mr-2 tabular-nums text-stone-500">{formatDate(parseDateKey(d))}</span>
              {n}
            </span>
            <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => setHoliday(d, null)}>
              삭제
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function CalendarPage() {
  const { suppliers, holidays } = useAppStore();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [fresh, setFresh] = useState(true);
  const supplier = suppliers.find((s) => s.id === supplierId) ?? suppliers[0] ?? emptySupplier("default");
  const majors = upcomingMajorHolidays(holidays, new Date());

  return (
    <>
      <PageHeader
        title="명절·택배 일정"
        description="공급처 마감 시각·출고 요일·공휴일로 도착일과 명절 전 마지막 출고일을 계산해요. 선물 시즌 준비 일정도 함께 챙겨 드려요."
        actions={
          <>
            {suppliers.length > 0 && (
              <Select className="w-auto!" value={supplier.id} onChange={(e) => setSupplierId(e.target.value)} aria-label="공급처">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
            <div className="flex items-center rounded-lg border border-stone-200 bg-white px-3">
              <Toggle checked={fresh} onChange={setFresh} label="신선상품" />
            </div>
          </>
        }
      />
      {suppliers.length === 0 && (
        <Notice tone="info" className="mb-5">
          공급처가 없어 기본 규칙(14:00 마감 · 월~금 출고 · 신선품 금요일 제외)으로 계산해요.{" "}
          <Link href="/settings" className="font-medium underline">
            설정
          </Link>
          에서 공급처별 마감·출고 요일을 넣으면 더 정확해져요.
        </Notice>
      )}

      <div className="space-y-5">
        {majors.length === 0 ? (
          <EmptyState>다가오는 설날·추석이 공휴일 목록에 없어요. 아래에서 추가해 주세요.</EmptyState>
        ) : (
          majors.map((h) => <HolidayPlanCard key={h.mainDay} holiday={h} supplier={supplier} fresh={fresh} />)
        )}
        <div className="grid gap-5 lg:grid-cols-2">
          <ArrivalCalculator supplier={supplier} fresh={fresh} />
          <HolidayEditor />
        </div>
      </div>
    </>
  );
}
