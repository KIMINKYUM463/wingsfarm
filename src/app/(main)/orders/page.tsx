"use client";

import { useState } from "react";
import { Button, Card, Notice, PageHeader, Tabs } from "@/components/ui";
import { AiOrderParser } from "@/components/orders/AiOrderParser";
import { InvoiceMatcher } from "@/components/orders/InvoiceMatcher";
import { OrderBuilder, type OrderSource } from "@/components/orders/OrderBuilder";
import { TableLoader, type LoadedTable } from "@/components/orders/TableLoader";
import { detectMapping, findHeaderRow, matchSku, toOrders } from "@/lib/orders";
import { useAppStore } from "@/store/useAppStore";

const TABS = [
  { id: "purchase", label: "📦 발주서 만들기" },
  { id: "invoice", label: "🚚 송장 회신 → 마켓 업로드" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const LOAD_TABS = [
  { id: "file", label: "마켓 주문 파일" },
  { id: "ai", label: "문자·카톡 주문 (AI)" },
] as const;
type LoadTab = (typeof LOAD_TABS)[number]["id"];

function toSource(table: LoadedTable, warnings: string[] = []): OrderSource {
  const headerRow = findHeaderRow(table.rows);
  const headers = table.rows[headerRow];
  return { name: table.name, headers, body: table.rows.slice(headerRow + 1), mapping: detectMapping(headers), warnings };
}

export default function OrdersPage() {
  const skus = useAppStore((s) => s.skus);
  const [tab, setTab] = useState<Tab>("purchase");
  const [loadTab, setLoadTab] = useState<LoadTab>("file");
  const [source, setSource] = useState<OrderSource | null>(null);

  const orders = source ? toOrders(source.body, source.mapping).map((o) => ({ ...o, sku: matchSku(o, skus) })) : [];

  return (
    <>
      <PageHeader
        title="발주서 도우미"
        description="마켓 주문 파일을 공급처별 발주서로 나누고, 공급처가 보낸 송장을 마켓 업로드 파일로 바꿔 드려요. 마켓 계정 연결 없이 파일만 다뤄요."
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />

      {!source ? (
        <Card title="1. 오늘 주문 불러오기">
          <Tabs tabs={LOAD_TABS} value={loadTab} onChange={setLoadTab} className="mb-4" />
          {loadTab === "file" ? (
            <TableLoader
              onLoad={([table]) => setSource(toSource(table))}
              hint="스마트스토어 '주문 엑셀 다운로드'·쿠팡 'DeliveryList' 등 그대로. 암호가 걸린 파일은 엑셀에서 암호를 풀고 저장해 주세요."
            />
          ) : (
            <AiOrderParser onLoad={(table, warnings) => setSource(toSource(table, warnings))} />
          )}
          <Notice className="mt-4">
            주문 파일(고객 이름·연락처·주소)은 이 브라우저 안에서만 처리되고 저장되지 않아요. 새로고침하면 다시 불러와야 해요.
          </Notice>
        </Card>
      ) : (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-100 px-4 py-2 text-sm text-stone-600">
          <span>
            불러온 주문: <b className="text-stone-800">{source.name}</b> · {orders.length}건
          </span>
          <Button variant="ghost" onClick={() => setSource(null)}>
            다른 주문 불러오기
          </Button>
        </div>
      )}

      {source && (
        <>
          <div hidden={tab !== "purchase"}>
            <OrderBuilder source={source} orders={orders} onMappingChange={(mapping) => setSource({ ...source, mapping })} />
          </div>
          <div hidden={tab !== "invoice"}>
            <InvoiceMatcher orders={orders} headers={source.headers} />
          </div>
        </>
      )}
    </>
  );
}
