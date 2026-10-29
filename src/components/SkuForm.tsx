"use client";

import { useState } from "react";
import type { SeasonCategory, Sku } from "@/types";
import { Button, Field, NumberInput, Select, TextInput, Toggle } from "@/components/ui";
import { uid } from "@/lib/format";
import { useAppStore, withPrice } from "@/store/useAppStore";

const CATEGORIES: SeasonCategory[] = ["과일", "채소", "수산", "축산", "가공"];

export function createEmptySku(supplierId: string): Sku {
  return {
    id: uid(),
    code: "",
    productName: "",
    optionName: "",
    category: "과일",
    supplierId,
    supplyPrice: 0,
    extraShippingCost: 0,
    packagingCost: 0,
    taxFree: true,
    fresh: false,
    listings: {},
    aliases: [],
    priceHistory: [],
  };
}

export function SkuForm({ initial, onDone }: { initial: Sku; onDone: () => void }) {
  const { suppliers, channels, upsertSku } = useAppStore();
  const [sku, setSku] = useState(initial);
  const set = <K extends keyof Sku>(key: K) => (value: Sku[K]) => setSku((s) => ({ ...s, [key]: value }));
  const setListing = (channelId: string, price: number) =>
    setSku((s) => {
      const listings = { ...s.listings };
      if (price > 0) listings[channelId] = price;
      else delete listings[channelId];
      return { ...s, listings };
    });

  const save = () => {
    const priceChanged = initial.supplyPrice !== sku.supplyPrice || initial.priceHistory.length === 0;
    upsertSku(priceChanged ? withPrice(sku, sku.supplyPrice) : sku);
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="상품명">
          <TextInput value={sku.productName} onChange={(e) => set("productName")(e.target.value)} placeholder="청송 꿀사과" />
        </Field>
        <Field label="옵션" hint="주문 파일 매칭에 사용">
          <TextInput value={sku.optionName} onChange={(e) => set("optionName")(e.target.value)} placeholder="5kg" />
        </Field>
        <Field label="SKU 코드">
          <TextInput value={sku.code} onChange={(e) => set("code")(e.target.value)} placeholder="AP-5K" />
        </Field>
        <Field label="분류">
          <Select value={sku.category} onChange={(e) => set("category")(e.target.value as SeasonCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="공급처">
          <Select value={sku.supplierId} onChange={(e) => set("supplierId")(e.target.value)}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="공급가">
          <NumberInput value={sku.supplyPrice} onValueChange={set("supplyPrice")} suffix="원" />
        </Field>
        <Field label="셀러부담 택배비">
          <NumberInput value={sku.extraShippingCost} onValueChange={set("extraShippingCost")} suffix="원" />
        </Field>
        <Field label="포장비">
          <NumberInput value={sku.packagingCost} onValueChange={set("packagingCost")} suffix="원" />
        </Field>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-stone-600">채널별 판매가</p>
        <p className="mb-2 text-[11px] text-stone-400">판매 중인 채널만 입력하세요(0 = 미판매). 가격·마진의 &quot;전체 상품&quot; 탭에서 역마진을 자동 점검합니다.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {channels.map((ch) => (
            <Field key={ch.id} label={ch.name}>
              <NumberInput value={sku.listings[ch.id] ?? 0} onValueChange={(v) => setListing(ch.id, v)} suffix="원" />
            </Field>
          ))}
        </div>
      </div>
      <div className="flex gap-6">
        <Toggle checked={sku.taxFree} onChange={set("taxFree")} label="면세(미가공)" />
        <Toggle checked={sku.fresh} onChange={set("fresh")} label="신선상품(출고요일 제한)" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>
          취소
        </Button>
        <Button onClick={save} disabled={!sku.productName || suppliers.length === 0}>
          저장
        </Button>
      </div>
    </div>
  );
}
