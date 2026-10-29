"use client";

import { useState } from "react";
import type { OrderField, Supplier, TemplateColumn } from "@/types";
import { Button, Field, Select, TextInput } from "@/components/ui";
import { WEEKDAYS } from "@/lib/format";
import { DEFAULT_TEMPLATE, TEMPLATE_FIELD_LABEL, TEMPLATE_PRESETS } from "@/lib/orders";
import { useAppStore } from "@/store/useAppStore";

const FIELDS = Object.keys(TEMPLATE_FIELD_LABEL) as OrderField[];

function WeekdayPicker({ value, onChange, tone }: { value: number[]; onChange: (days: number[]) => void; tone: "good" | "loss" }) {
  const toggle = (day: number) => onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort());
  const on = tone === "good" ? "bg-emerald-600 text-white" : "bg-rose-500 text-white";
  return (
    <div className="flex gap-1">
      {WEEKDAYS.map((label, day) => (
        <button
          key={label}
          type="button"
          aria-pressed={value.includes(day)}
          onClick={() => toggle(day)}
          className={`size-8 rounded-lg text-xs font-semibold transition ${value.includes(day) ? on : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function SupplierForm({ initial, onDone }: { initial: Supplier; onDone: () => void }) {
  const upsertSupplier = useAppStore((s) => s.upsertSupplier);
  const [supplier, setSupplier] = useState<Supplier>({ ...initial, template: initial.template.length ? initial.template : DEFAULT_TEMPLATE });
  const set = <K extends keyof Supplier>(key: K, value: Supplier[K]) => setSupplier((s) => ({ ...s, [key]: value }));
  const setColumn = (index: number, patch: Partial<TemplateColumn>) =>
    set(
      "template",
      supplier.template.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  const moveColumn = (index: number, delta: number) => {
    const next = [...supplier.template];
    const [col] = next.splice(index, 1);
    next.splice(index + delta, 0, col);
    set("template", next);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="공급처명">
          <TextInput value={supplier.name} onChange={(e) => set("name", e.target.value)} placeholder="예: OO농장" />
        </Field>
        <Field label="발주 연락처·메일 (선택)">
          <TextInput value={supplier.contact ?? ""} onChange={(e) => set("contact", e.target.value)} placeholder="010-… / 카톡 / 메일" />
        </Field>
        <Field label="발주 마감 시각" hint="이 시각 이후 주문은 다음 출고일로">
          <TextInput type="time" value={supplier.cutoffTime} onChange={(e) => set("cutoffTime", e.target.value || "14:00")} />
        </Field>
      </div>
      <Field label="출고 요일">
        <WeekdayPicker value={supplier.shipWeekdays} onChange={(days) => set("shipWeekdays", days)} tone="good" />
      </Field>
      <Field label="신선상품 출고 금지 요일" hint="주말에 택배 창고에 묵으면 상하기 쉬워 보통 금요일(·토요일)은 신선품을 보내지 않아요">
        <WeekdayPicker value={supplier.freshBlockedWeekdays} onChange={(days) => set("freshBlockedWeekdays", days)} tone="loss" />
      </Field>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-stone-600">발주서 양식 (공급처가 받는 엑셀의 열 순서)</p>
          <Select className="w-auto! py-1 text-xs" value="" onChange={(e) => e.target.value && set("template", TEMPLATE_PRESETS.find((p) => p.id === e.target.value)!.columns)}>
            <option value="">기본 양식 불러오기…</option>
            {TEMPLATE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <ul className="space-y-1.5">
          {supplier.template.map((col, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="w-5 text-right text-xs tabular-nums text-stone-400">{i + 1}</span>
              <TextInput className="py-1.5 text-xs" value={col.header} onChange={(e) => setColumn(i, { header: e.target.value })} aria-label={`${i + 1}번째 열 이름`} />
              <Select className="py-1.5 text-xs" value={col.field} onChange={(e) => setColumn(i, { field: e.target.value as OrderField })} aria-label={`${i + 1}번째 열 내용`}>
                {FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {TEMPLATE_FIELD_LABEL[f]}
                  </option>
                ))}
              </Select>
              {col.field === "constant" && (
                <TextInput className="py-1.5 text-xs" value={col.value ?? ""} onChange={(e) => setColumn(i, { value: e.target.value })} placeholder="고정값" aria-label="고정 문구" />
              )}
              <Button variant="ghost" className="px-1.5 py-1" disabled={i === 0} onClick={() => moveColumn(i, -1)} aria-label="위로">
                ↑
              </Button>
              <Button variant="ghost" className="px-1.5 py-1" disabled={i === supplier.template.length - 1} onClick={() => moveColumn(i, 1)} aria-label="아래로">
                ↓
              </Button>
              <Button variant="danger" className="px-1.5 py-1" onClick={() => set("template", supplier.template.filter((_, j) => j !== i))} aria-label="열 삭제">
                ✕
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" className="mt-2 py-1 text-xs" onClick={() => set("template", [...supplier.template, { header: "새 열", field: "constant", value: "" }])}>
          + 열 추가
        </Button>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          취소
        </Button>
        <Button
          onClick={() => {
            upsertSupplier({ ...supplier, name: supplier.name.trim(), contact: supplier.contact?.trim() });
            onDone();
          }}
          disabled={!supplier.name.trim() || supplier.shipWeekdays.length === 0}
        >
          저장
        </Button>
      </div>
    </div>
  );
}
