"use client";

import Link from "next/link";
import JSZip from "jszip";
import { useState } from "react";
import type { LedgerEntry, Supplier } from "@/types";
import { Badge, Button, Card, CopyButton, EmptyState, Field, Notice, Select, Stat, Table } from "@/components/ui";
import { downloadBlob } from "@/lib/file";
import { formatDate, toDateKey, uid, won } from "@/lib/format";
import { estimateFee, skuUnitCost } from "@/lib/ledger";
import { SOURCE_FIELDS, buildPurchaseSheet, groupBySupplier, missingRequired, orderLabel, type ColumnMapping, type MatchedOrder, type SupplierBatch } from "@/lib/orders";
import { dateKey, deliveryDate, nextShipDate } from "@/lib/shipping";
import { toTsv } from "@/lib/table";
import { writeXlsx } from "@/lib/xlsx";
import { useAppStore } from "@/store/useAppStore";

export interface OrderSource {
  name: string;
  headers: string[];
  body: string[][];
  mapping: ColumnMapping;
  warnings: string[];
}

const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, "_").trim() || "공급처";
const sheetFileName = (supplier: Supplier) => `발주서_${safeFileName(supplier.name)}_${toDateKey(new Date()).slice(5).replace("-", "")}.xlsx`;

function ColumnMappingCard({ source, onChange }: { source: OrderSource; onChange: (mapping: ColumnMapping) => void }) {
  const missing = missingRequired(source.mapping);
  return (
    <details open={missing.length > 0} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer font-semibold text-stone-800">
        열 맞추기 {missing.length > 0 ? <Badge tone="loss">필수 {missing.length}개 못 찾음</Badge> : <Badge tone="good">자동으로 맞췄어요</Badge>}
      </summary>
      <p className="mt-2 text-xs text-stone-500">마켓마다 머리글 이름이 달라 자동으로 찾았어요. 틀린 칸만 고쳐 주세요.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SOURCE_FIELDS.map((f) => (
          <Field key={f.field} label={`${f.label}${f.required ? " *" : ""}`}>
            <Select
              value={source.mapping[f.field] ?? ""}
              onChange={(e) => {
                const next = { ...source.mapping };
                if (e.target.value === "") delete next[f.field];
                else next[f.field] = Number(e.target.value);
                onChange(next);
              }}
            >
              <option value="">(없음)</option>
              {source.headers.map((h, i) => (
                <option key={i} value={i}>
                  {h || `${i + 1}번째 열`}
                </option>
              ))}
            </Select>
          </Field>
        ))}
      </div>
    </details>
  );
}

function UnmatchedCard({ orders }: { orders: MatchedOrder[] }) {
  const skus = useAppStore((s) => s.skus);
  const addSkuAlias = useAppStore((s) => s.addSkuAlias);
  const labels = [...new Set(orders.map(orderLabel))];
  if (labels.length === 0) return null;
  return (
    <Card title={`내 상품과 연결 안 된 주문 ${orders.length}건`}>
      {skus.length === 0 ? (
        <Notice tone="warn">
          아직 등록한 상품이 없어요. <Link href="/settings" className="font-medium underline">설정 → 상품</Link>에서 상품과 공급처를 먼저 등록하면 공급처별로 나눠 드려요.
        </Notice>
      ) : (
        <>
          <p className="mb-3 text-sm text-stone-500">한 번 골라 두면 다음 주문 파일부터는 자동으로 연결돼요.</p>
          <ul className="space-y-2">
            {labels.map((label) => (
              <li key={label} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-stone-700" title={label}>
                  {label} <span className="text-stone-400">({orders.filter((o) => orderLabel(o) === label).length}건)</span>
                </span>
                <Select className="w-auto! min-w-56" value="" onChange={(e) => e.target.value && addSkuAlias(e.target.value, label)} aria-label={`${label} 상품 연결`}>
                  <option value="">내 상품 고르기…</option>
                  {skus.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.productName} {s.optionName}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function ShipInfo({ batch }: { batch: SupplierBatch }) {
  const holidays = useAppStore((s) => s.holidays);
  const now = new Date();
  const fresh = batch.orders.some((o) => o.sku?.fresh);
  const ship = nextShipDate(now, batch.supplier, holidays, fresh);
  if (!ship) return <Notice tone="loss">출고 요일이 비어 있어요. 설정에서 공급처 출고 요일을 정해 주세요.</Notice>;
  const arrive = deliveryDate(ship, holidays);
  if (dateKey(ship) === dateKey(now)) {
    return (
      <Notice tone="good">
        오늘 {batch.supplier.cutoffTime}까지 보내면 오늘 출고 → {formatDate(arrive)} 도착 예상
      </Notice>
    );
  }
  return (
    <Notice tone="warn">
      오늘 출고 마감이 지났거나 출고일이 아니에요{fresh && " (신선 제한 요일 포함)"} → {formatDate(ship)} 출고, {formatDate(arrive)} 도착 예상. 늦어지면{" "}
      <Link href="/cs" className="font-medium underline">
        출고 지연 안내
      </Link>
      를 먼저 보내세요.
    </Notice>
  );
}

function BatchCard({ batch }: { batch: SupplierBatch }) {
  const sheet = buildPurchaseSheet(batch.orders, batch.supplier.template);
  const qty = batch.orders.reduce((s, o) => s + o.qty, 0);
  const supply = batch.orders.reduce((s, o) => s + (o.sku ? o.sku.supplyPrice * o.qty : 0), 0);
  const download = async () => downloadBlob(await writeXlsx(sheet, "발주서"), sheetFileName(batch.supplier));
  return (
    <Card
      title={
        <>
          {batch.supplier.name} <span className="text-sm font-normal text-stone-500">{batch.orders.length}건 · {qty}개 · 공급가 {won(supply)}</span>
        </>
      }
      actions={
        <div className="flex gap-1">
          <CopyButton text={toTsv(sheet)} label="표 복사" />
          <Button variant="secondary" onClick={download}>
            엑셀 받기
          </Button>
        </div>
      }
    >
      <ShipInfo batch={batch} />
      {batch.supplier.contact && <p className="mt-2 text-xs text-stone-500">발주 연락처: {batch.supplier.contact}</p>}
      <div className="mt-3 max-h-72 overflow-y-auto">
        <Table>
          <thead>
            <tr>
              {sheet[0].map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.slice(1).map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="max-w-56 truncate text-xs" title={cell}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}

function LedgerSendCard({ orders }: { orders: MatchedOrder[] }) {
  const channels = useAppStore((s) => s.channels);
  const ledger = useAppStore((s) => s.ledger);
  const addLedgerEntries = useAppStore((s) => s.addLedgerEntries);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [result, setResult] = useState("");
  const channel = channels.find((c) => c.id === channelId);
  const sellable = orders.filter((o): o is MatchedOrder & { sku: NonNullable<MatchedOrder["sku"]> } => o.sku !== null);

  const send = () => {
    const today = toDateKey(new Date());
    const existing = new Set(ledger.map((e) => e.id));
    const entries: LedgerEntry[] = sellable.map((o) => {
      const revenue = o.payAmount || (o.sku.listings[channelId] ?? 0) * o.qty;
      return {
        id: o.orderNo ? `order:${o.orderNo}:${o.sku.id}` : uid(),
        date: today,
        channelId,
        skuId: o.sku.id,
        label: `${o.sku.productName} ${o.sku.optionName}`.trim(),
        qty: o.qty,
        revenue,
        cost: skuUnitCost(o.sku) * o.qty,
        fee: estimateFee(revenue, channel),
        ad: 0,
        other: 0,
        taxFree: o.sku.taxFree,
        source: "orders",
      };
    });
    const fresh = entries.filter((e) => !existing.has(e.id));
    addLedgerEntries(fresh);
    const noPrice = fresh.filter((e) => e.revenue === 0).length;
    setResult(
      `${fresh.length}건을 장부에 넣었어요${entries.length > fresh.length ? ` (이미 넣은 ${entries.length - fresh.length}건 제외)` : ""}.${noPrice ? ` 결제금액·판매가가 없는 ${noPrice}건은 장부에서 매출을 고쳐 주세요.` : ""}`,
    );
  };

  return (
    <Card title="매출 장부에 넣기">
      <p className="mb-3 text-sm text-stone-500">
        연결된 주문 {sellable.length}건을 오늘 날짜로 장부에 넣어요. 결제금액 열이 없으면 등록된 판매가 × 수량으로 계산하고, 수수료는 채널 수수료율로 추정해요.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="이 주문 파일의 판매채널">
          <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={send} disabled={sellable.length === 0 || !channel}>
          장부에 넣기
        </Button>
        <Link href="/ledger" className="px-2 py-2 text-sm text-emerald-700 hover:underline">
          장부 보기 →
        </Link>
      </div>
      {result && (
        <Notice tone="good" className="mt-3">
          {result}
        </Notice>
      )}
    </Card>
  );
}

export function OrderBuilder({ source, orders, onMappingChange }: { source: OrderSource; orders: MatchedOrder[]; onMappingChange: (mapping: ColumnMapping) => void }) {
  const suppliers = useAppStore((s) => s.suppliers);
  const { batches, unmatched } = groupBySupplier(orders, suppliers);
  const missing = missingRequired(source.mapping);

  const downloadAll = async () => {
    const zip = new JSZip();
    for (const batch of batches) zip.file(sheetFileName(batch.supplier), await writeXlsx(buildPurchaseSheet(batch.orders, batch.supplier.template), "발주서"));
    downloadBlob(await zip.generateAsync({ type: "blob" }), `발주서_${toDateKey(new Date())}.zip`);
  };

  return (
    <div className="space-y-5">
      {source.warnings.length > 0 && (
        <Notice tone="warn">
          <p className="font-medium">AI가 확인을 요청했어요</p>
          <ul className="mt-1 list-disc pl-5">
            {source.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}
      <ColumnMappingCard source={source} onChange={onMappingChange} />
      {missing.length > 0 ? (
        <Notice tone="loss">필수 열({missing.map((f) => f.label).join(", ")})을 골라야 발주서를 만들 수 있어요.</Notice>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="주문" value={`${orders.length}건`} />
            <Stat label="공급처" value={`${batches.length}곳`} />
            <Stat label="연결 안 됨" value={`${unmatched.length}건`} tone={unmatched.length ? "warn" : "good"} />
            <Stat label="총 수량" value={`${orders.reduce((s, o) => s + o.qty, 0)}개`} />
          </div>
          <UnmatchedCard orders={unmatched} />
          {batches.length === 0 ? (
            <EmptyState>내 상품과 연결된 주문이 없어요. 위에서 상품을 연결해 주세요.</EmptyState>
          ) : (
            <>
              {batches.length > 1 && (
                <div className="flex justify-end">
                  <Button onClick={downloadAll}>공급처별 발주서 한 번에 받기 (zip)</Button>
                </div>
              )}
              {batches.map((batch) => (
                <BatchCard key={batch.supplier.id} batch={batch} />
              ))}
              <LedgerSendCard orders={orders} />
            </>
          )}
        </>
      )}
    </div>
  );
}
