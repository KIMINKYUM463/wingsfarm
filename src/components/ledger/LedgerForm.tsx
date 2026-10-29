"use client";

import { useState } from "react";
import type { LedgerEntry } from "@/types";
import { Button, Field, NumberInput, Select, Tabs, TextInput, Toggle } from "@/components/ui";
import { toDateKey, uid } from "@/lib/format";
import { estimateFee, skuUnitCost } from "@/lib/ledger";
import { useAppStore } from "@/store/useAppStore";

const MODES = [
  { id: "sale", label: "판매" },
  { id: "expense", label: "지출만 (광고비·포장재 등)" },
] as const;
type Mode = (typeof MODES)[number]["id"];

const blankEntry = (channelId: string): LedgerEntry => ({
  id: uid(),
  date: toDateKey(new Date()),
  channelId,
  skuId: null,
  label: "",
  qty: 1,
  revenue: 0,
  cost: 0,
  fee: 0,
  ad: 0,
  other: 0,
  taxFree: true,
  source: "manual",
});

export function LedgerForm({ initial, onDone }: { initial?: LedgerEntry; onDone: () => void }) {
  const channels = useAppStore((s) => s.channels);
  const skus = useAppStore((s) => s.skus);
  const addLedgerEntries = useAppStore((s) => s.addLedgerEntries);
  const updateLedgerEntry = useAppStore((s) => s.updateLedgerEntry);
  const [entry, setEntry] = useState<LedgerEntry>(initial ?? blankEntry(channels[0]?.id ?? ""));
  const [mode, setMode] = useState<Mode>(initial && initial.revenue === 0 && initial.qty === 0 ? "expense" : "sale");
  const set = <K extends keyof LedgerEntry>(key: K, value: LedgerEntry[K]) => setEntry((e) => ({ ...e, [key]: value }));
  const channel = channels.find((c) => c.id === entry.channelId);

  /** 상품·수량·채널을 바꾸면 판매가·원가·수수료를 다시 채운다 (직접 고친 값은 그 뒤에 다시 고치면 된다) */
  const fillFromSku = (skuId: string | null, qty: number, channelId: string) => {
    const sku = skus.find((s) => s.id === skuId);
    if (!sku) return setEntry((e) => ({ ...e, skuId: null, qty, channelId }));
    const revenue = (sku.listings[channelId] ?? 0) * qty;
    setEntry((e) => ({
      ...e,
      skuId,
      qty,
      channelId,
      label: `${sku.productName} ${sku.optionName}`.trim(),
      revenue,
      cost: skuUnitCost(sku) * qty,
      fee: estimateFee(revenue, channels.find((c) => c.id === channelId)),
      taxFree: sku.taxFree,
    }));
  };

  const save = () => {
    const final = mode === "expense" ? { ...entry, qty: 0, revenue: 0, cost: 0, fee: 0, skuId: null } : entry;
    if (initial) updateLedgerEntry(final);
    else addLedgerEntries([final]);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Tabs tabs={MODES} value={mode} onChange={setMode} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="날짜">
          <TextInput type="date" value={entry.date} onChange={(e) => e.target.value && set("date", e.target.value)} />
        </Field>
        <Field label="채널">
          <Select value={entry.channelId} onChange={(e) => (mode === "sale" ? fillFromSku(entry.skuId, entry.qty, e.target.value) : set("channelId", e.target.value))}>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        {mode === "sale" && (
          <>
            <Field label="상품 (등록 상품이면 금액 자동)">
              <Select value={entry.skuId ?? ""} onChange={(e) => fillFromSku(e.target.value || null, entry.qty, entry.channelId)}>
                <option value="">직접 입력</option>
                {skus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.productName} {s.optionName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="수량">
              <NumberInput value={entry.qty} min={1} onValueChange={(v) => fillFromSku(entry.skuId, Math.max(1, Math.round(v)), entry.channelId)} suffix="개" />
            </Field>
          </>
        )}
        <Field label={mode === "sale" ? "내용" : "지출 내용"}>
          <TextInput value={entry.label} onChange={(e) => set("label", e.target.value)} placeholder={mode === "sale" ? "성주 참외 2kg" : "네이버 광고비 10월분"} />
        </Field>
        {mode === "sale" && (
          <>
            <Field label="매출 (고객 결제금액)">
              <NumberInput value={entry.revenue} onValueChange={(v) => setEntry((e) => ({ ...e, revenue: v, fee: estimateFee(v, channel) }))} suffix="원" />
            </Field>
            <Field label="원가 (공급가·택배·포장)">
              <NumberInput value={entry.cost} onValueChange={(v) => set("cost", v)} suffix="원" />
            </Field>
            <Field label="채널 수수료" hint="매출을 바꾸면 채널 수수료율로 다시 계산돼요">
              <NumberInput value={entry.fee} onValueChange={(v) => set("fee", v)} suffix="원" />
            </Field>
          </>
        )}
        <Field label="광고비">
          <NumberInput value={entry.ad} onValueChange={(v) => set("ad", v)} suffix="원" />
        </Field>
        <Field label="기타 (환불·재발송·포장재 등)">
          <NumberInput value={entry.other} onValueChange={(v) => set("other", v)} suffix="원" />
        </Field>
      </div>
      {mode === "sale" && <Toggle checked={entry.taxFree} onChange={(v) => set("taxFree", v)} label="면세 상품 (가공하지 않은 농·수산물)" />}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          취소
        </Button>
        <Button onClick={save} disabled={!entry.label.trim() || !entry.channelId}>
          저장
        </Button>
      </div>
    </div>
  );
}
