"use client";

import { useMemo, useState } from "react";
import { Card, CopyButton, Field, NumberInput, Select, TextInput } from "@/components/ui";
import { COMPENSATIONS, DELAY_REASONS, DELAY_TODOS, buildDelayNotices, type Compensation, type DelayReason } from "@/lib/delayNotice";
import { toDateKey } from "@/lib/format";
import { useStoreName } from "@/lib/useStoreName";
import { useAppStore } from "@/store/useAppStore";

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toDateKey(d);
};

export function DelayNotice() {
  const { skus, workingProduct } = useAppStore();
  const [storeName, saveStoreName] = useStoreName();
  const [product, setProduct] = useState(workingProduct);
  const [reason, setReason] = useState<DelayReason>("weather");
  const [newDate, setNewDate] = useState(() => inDays(2));
  const [compensation, setCompensation] = useState<Compensation>("none");
  const [couponAmount, setCouponAmount] = useState(1000);
  const [extraItem, setExtraItem] = useState("");

  const notices = useMemo(
    () => buildDelayNotices({ storeName, product, reason, newDate, compensation, couponAmount, extraItem }),
    [storeName, product, reason, newDate, compensation, couponAmount, extraItem],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card title="지연 상황">
        <div className="space-y-3">
          <Field label="스토어 이름" hint="한 번 입력하면 기억합니다">
            <TextInput value={storeName} onChange={(e) => saveStoreName(e.target.value)} placeholder="예: 윙스팜 산지직송" />
          </Field>
          <Field label="상품">
            <TextInput value={product} onChange={(e) => setProduct(e.target.value)} placeholder="예: 제주 감귤 5kg" list="delay-skus" />
            <datalist id="delay-skus">
              {skus.map((s) => (
                <option key={s.id} value={`${s.productName} ${s.optionName}`.trim()} />
              ))}
            </datalist>
          </Field>
          <div>
            <p className="mb-1 text-xs font-medium text-stone-600">지연 사유</p>
            <div className="flex flex-wrap gap-1.5">
              {DELAY_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReason(r.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${reason === r.id ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="새 출고 예정일">
            <TextInput type="date" value={newDate} min={inDays(0)} onChange={(e) => setNewDate(e.target.value)} />
          </Field>
          <Field label="보상">
            <Select value={compensation} onChange={(e) => setCompensation(e.target.value as Compensation)}>
              {COMPENSATIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          {compensation === "coupon" && (
            <Field label="적립금·쿠폰 금액">
              <NumberInput value={couponAmount} onValueChange={setCouponAmount} suffix="원" />
            </Field>
          )}
          {compensation === "extra" && (
            <Field label="덤 상품">
              <TextInput value={extraItem} onChange={(e) => setExtraItem(e.target.value)} placeholder="예: 감귤 500g" />
            </Field>
          )}
        </div>
      </Card>

      <div className="space-y-4">
        {notices.map((n) => (
          <Card key={n.channel} title={<span className="flex items-center gap-2">{n.label} <span className="text-xs font-normal text-stone-400">{n.title}</span></span>} actions={<CopyButton text={n.text} />}>
            <pre className="whitespace-pre-wrap rounded-xl bg-stone-50 p-4 font-sans text-sm leading-relaxed text-stone-700">{n.text}</pre>
          </Card>
        ))}
        <Card title="보낸 뒤 할 일">
          <ul className="space-y-1.5 text-sm text-stone-600">
            {DELAY_TODOS.map((t) => (
              <li key={t}>☐ {t}</li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-stone-400">지연이 확정된 순간 먼저 알리면 &quot;왜 안 와요&quot; 문의와 취소·저평점이 크게 줄어듭니다.</p>
        </Card>
      </div>
    </div>
  );
}
