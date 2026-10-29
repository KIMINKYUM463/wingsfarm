"use client";

import { useState, type ChangeEvent } from "react";
import type { Sku, Supplier } from "@/types";
import { Badge, Button, Card, CommitNumber, EmptyState, Field, Modal, NumberInput, PageHeader, Table } from "@/components/ui";
import { SkuForm, createEmptySku } from "@/components/SkuForm";
import { SupplierForm } from "@/components/SupplierForm";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { emptySupplier } from "@/lib/data/defaults";
import { toDateKey, uid, won } from "@/lib/format";
import { pickAppData, useAppStore, type AppData } from "@/store/useAppStore";

export default function SettingsPage() {
  const store = useAppStore();
  const { channels, costs, suppliers, skus, updateChannel, setCosts, removeSupplier, removeSku, importData, resetAll } = store;
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [editingSku, setEditingSku] = useState<Sku | null>(null);
  const [notice, setNotice] = useState("");

  const today = toDateKey(new Date());

  const exportData = () => {
    const blob = new Blob([JSON.stringify(pickAppData(store), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wingsfarm-ai-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as AppData;
      if (!Array.isArray(data.skus) || !Array.isArray(data.suppliers) || !Array.isArray(data.channels)) throw new Error();
      importData(data);
      setNotice("백업을 복원했습니다.");
    } catch {
      setNotice("올바른 백업 파일이 아닙니다.");
    }
  };

  const deleteSupplier = (s: Supplier) => {
    const used = skus.filter((sku) => sku.supplierId === s.id).length;
    if (used > 0) return setNotice(`${s.name}에 연결된 상품 ${used}개를 먼저 다른 공급처로 옮겨 주세요.`);
    if (confirm(`${s.name}을(를) 삭제할까요?`)) removeSupplier(s.id);
  };

  return (
    <>
      <PageHeader title="설정" description="수수료·기본 비용·공급처·상품을 관리합니다. 모든 계산 화면에 즉시 반영됩니다." />
      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="닫기">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ConnectionStatus />

        <Card title="채널 수수료 (%)" actions={<span className="text-xs text-stone-400">본인 카테고리·등급 기준으로 수정</span>}>
          <Table>
            <thead>
              <tr>
                <th>채널</th>
                <th className="text-right">판매수수료</th>
                <th className="text-right">결제수수료</th>
                <th className="text-right">배송비수수료</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  {(["saleFeeRate", "paymentFeeRate", "shippingFeeRate"] as const).map((key) => (
                    <td key={key} className="text-right">
                      <CommitNumber value={c[key]} onCommit={(v) => updateChannel(c.id, { [key]: v ?? 0 })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title="기본 비용·목표">
          <div className="grid grid-cols-2 gap-3">
            <Field label="목표 마진율" hint="권장 판매가 계산 기준">
              <NumberInput value={costs.targetMargin} onValueChange={(v) => setCosts({ targetMargin: v })} suffix="%" />
            </Field>
            <Field label="광고비율" hint="판매가 대비 평균 광고비">
              <NumberInput value={costs.adRate} onValueChange={(v) => setCosts({ adRate: v })} suffix="%" />
            </Field>
            <Field label="CS 손실 적립률" hint="파손·변질 환불 대비">
              <NumberInput value={costs.lossRate} onValueChange={(v) => setCosts({ lossRate: v })} suffix="%" />
            </Field>
            <Field label="고객결제 배송비" hint="무료배송이면 0">
              <NumberInput value={costs.customerShippingFee} onValueChange={(v) => setCosts({ customerShippingFee: v })} suffix="원" />
            </Field>
            <Field label="권장가 올림 단위">
              <NumberInput value={costs.roundUnit} onValueChange={(v) => setCosts({ roundUnit: Math.max(1, v) })} suffix="원" />
            </Field>
          </div>
        </Card>

        <Card title="공급처" actions={<Button variant="secondary" onClick={() => setEditing(emptySupplier(uid()))}>+ 공급처 추가</Button>}>
          <Table>
            <thead>
              <tr>
                <th>공급처</th>
                <th className="text-right">연결 상품</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-right tabular-nums">{skus.filter((sku) => sku.supplierId === s.id).length}개</td>
                  <td className="whitespace-nowrap text-right">
                    <Button variant="ghost" onClick={() => setEditing(s)}>
                      수정
                    </Button>
                    <Button variant="danger" onClick={() => deleteSupplier(s)}>
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card
          title="상품"
          className="lg:col-span-2"
          actions={
            <Button variant="secondary" disabled={suppliers.length === 0} onClick={() => setEditingSku(createEmptySku(suppliers[0].id))}>
              + 상품 추가
            </Button>
          }
        >
          {skus.length === 0 ? (
            <EmptyState>
              {suppliers.length === 0
                ? "공급처를 먼저 등록한 뒤 상품을 추가하세요."
                : "등록된 상품이 없습니다. CS 도우미·가격·마진에서 쓸 상품을 추가하세요."}
            </EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>상품</th>
                  <th>분류</th>
                  <th>공급처</th>
                  <th className="text-right">공급가</th>
                  <th className="text-right">택배비·포장비</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {skus.map((sku) => (
                  <tr key={sku.id}>
                    <td className="min-w-40">
                      <div className="font-medium">{sku.productName}</div>
                      <div className="flex gap-1 text-xs text-stone-400">
                        {sku.optionName} · {sku.code || "코드없음"}
                        {sku.taxFree ? <Badge>면세</Badge> : <Badge tone="info">과세</Badge>}
                        {sku.fresh && <Badge tone="warn">신선</Badge>}
                      </div>
                    </td>
                    <td className="text-xs">{sku.category}</td>
                    <td className="whitespace-nowrap text-xs">{suppliers.find((s) => s.id === sku.supplierId)?.name ?? "미지정"}</td>
                    <td className="text-right">{won(sku.supplyPrice)}</td>
                    <td className="text-right text-xs text-stone-500">
                      {won(sku.extraShippingCost)} · {won(sku.packagingCost)}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <Button variant="ghost" onClick={() => setEditingSku(sku)}>
                        수정
                      </Button>
                      <Button variant="danger" onClick={() => confirm(`${sku.productName} ${sku.optionName}을(를) 삭제할까요?`) && removeSku(sku.id)}>
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="데이터 백업·복원" className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={exportData}>
              JSON 백업 다운로드
            </Button>
            <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              백업 파일 복원
              <input type="file" accept=".json" className="hidden" onChange={onImport} />
            </label>
            <Button
              variant="danger"
              onClick={() => confirm("상품·공급처 등 모든 데이터를 삭제할까요? 되돌릴 수 없습니다.") && resetAll()}
            >
              전체 데이터 초기화
            </Button>
            <span className="text-xs text-stone-400">데이터는 이 브라우저(localStorage)에만 저장됩니다. 정기적으로 백업하세요.</span>
          </div>
        </Card>
      </div>

      <Modal open={editing !== null} title={editing && suppliers.some((s) => s.id === editing.id) ? "공급처 수정" : "공급처 추가"} onClose={() => setEditing(null)}>
        {editing && <SupplierForm initial={editing} onDone={() => setEditing(null)} />}
      </Modal>
      <Modal open={editingSku !== null} title={editingSku && skus.some((s) => s.id === editingSku.id) ? "상품 수정" : "상품 추가"} onClose={() => setEditingSku(null)}>
        {editingSku && <SkuForm initial={editingSku} onDone={() => setEditingSku(null)} />}
      </Modal>
    </>
  );
}
