"use client";

import { useState } from "react";
import type { ClaimRecord, ClaimResolution, ClaimType } from "@/types";
import { Button, Field, Notice, NumberInput, Select, TextArea, TextInput, Toggle } from "@/components/ui";
import { RESOLUTION_LABEL, claimLedgerId } from "@/lib/claims";
import { CLAIM_TYPES, CS_GUIDES } from "@/lib/data/cs";
import { toDateKey, uid } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

export const emptyClaim = (supplierId: string): ClaimRecord => ({
  id: uid(),
  date: toDateKey(new Date()),
  supplierId,
  skuId: null,
  type: "damage",
  orderNo: "",
  resolution: "partial",
  loss: 0,
  evidence: [],
  note: "",
});

export function ClaimForm({ initial, onDone }: { initial: ClaimRecord; onDone: () => void }) {
  const suppliers = useAppStore((s) => s.suppliers);
  const skus = useAppStore((s) => s.skus);
  const channels = useAppStore((s) => s.channels);
  const ledger = useAppStore((s) => s.ledger);
  const upsertClaim = useAppStore((s) => s.upsertClaim);
  const updateLedgerEntry = useAppStore((s) => s.updateLedgerEntry);
  const removeLedgerEntry = useAppStore((s) => s.removeLedgerEntry);
  const linked = ledger.find((e) => e.id === claimLedgerId(initial.id));
  const [claim, setClaim] = useState(initial);
  const [toLedger, setToLedger] = useState(linked !== undefined || initial.loss === 0);
  const [channelId, setChannelId] = useState(linked?.channelId ?? channels[0]?.id ?? "");
  const set = <K extends keyof ClaimRecord>(key: K, value: ClaimRecord[K]) => setClaim((c) => ({ ...c, [key]: value }));
  const guide = CS_GUIDES[claim.type];

  const save = () => {
    upsertClaim({ ...claim, orderNo: claim.orderNo.trim(), note: claim.note.trim() });
    const ledgerId = claimLedgerId(claim.id);
    if (toLedger && claim.loss > 0 && channelId) {
      updateLedgerEntry({
        id: ledgerId,
        date: claim.date,
        channelId,
        skuId: null,
        label: `클레임 손실 · ${guide.label}${claim.orderNo ? ` (${claim.orderNo.trim()})` : ""}`,
        qty: 0,
        revenue: 0,
        cost: 0,
        fee: 0,
        ad: 0,
        other: claim.loss,
        taxFree: true,
        source: "manual",
      });
    } else removeLedgerEntry(ledgerId);
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="접수일">
          <TextInput type="date" value={claim.date} onChange={(e) => e.target.value && set("date", e.target.value)} />
        </Field>
        <Field label="주문번호 (선택)">
          <TextInput value={claim.orderNo} onChange={(e) => set("orderNo", e.target.value)} />
        </Field>
        <Field label="상품 (고르면 공급처 자동)">
          <Select
            value={claim.skuId ?? ""}
            onChange={(e) => {
              const sku = skus.find((s) => s.id === e.target.value);
              setClaim((c) => ({ ...c, skuId: sku?.id ?? null, supplierId: sku?.supplierId ?? c.supplierId }));
            }}
          >
            <option value="">선택 안 함</option>
            {skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.productName} {s.optionName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="공급처">
          <Select value={claim.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="유형">
          <Select value={claim.type} onChange={(e) => setClaim((c) => ({ ...c, type: e.target.value as ClaimType, evidence: [] }))}>
            {CLAIM_TYPES.map((t) => (
              <option key={t} value={t}>
                {CS_GUIDES[t].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="처리">
          <Select value={claim.resolution} onChange={(e) => set("resolution", e.target.value as ClaimResolution)}>
            {(Object.keys(RESOLUTION_LABEL) as ClaimResolution[]).map((r) => (
              <option key={r} value={r}>
                {RESOLUTION_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="손실 금액" hint="환불액·재발송 원가·적립금">
          <NumberInput value={claim.loss} onValueChange={(v) => set("loss", Math.max(0, v))} suffix="원" />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-stone-600">받은 증빙 (공급처에 비용 청구할 때 필요)</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {guide.evidence.map((ev) => (
            <Toggle key={ev} label={ev} checked={claim.evidence.includes(ev)} onChange={(on) => set("evidence", on ? [...claim.evidence, ev] : claim.evidence.filter((x) => x !== ev))} />
          ))}
        </div>
      </fieldset>
      <Notice className="text-xs">
        <b>{guide.label} 처리 순서</b>: {guide.actions.join(" → ")}
      </Notice>
      <Field label="메모">
        <TextArea rows={2} value={claim.note} onChange={(e) => set("note", e.target.value)} placeholder="고객 요청, 공급처 답변, 택배사 사고접수 번호 등" />
      </Field>

      {claim.loss > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-stone-50 p-3">
          <Toggle checked={toLedger} onChange={setToLedger} label="손실을 매출 장부에도 기록 (순이익에 반영)" />
          {toLedger && (
            <Select className="w-auto! py-1 text-xs" value={channelId} onChange={(e) => setChannelId(e.target.value)} aria-label="판매채널">
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          취소
        </Button>
        <Button onClick={save} disabled={!claim.supplierId}>
          저장
        </Button>
      </div>
    </div>
  );
}
