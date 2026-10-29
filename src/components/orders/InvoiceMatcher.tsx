"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, Notice, Select, Stat, Table } from "@/components/ui";
import { downloadBlob } from "@/lib/file";
import { toDateKey } from "@/lib/format";
import { UPLOAD_FORMATS, buildUploadSheet, detectInvoiceMapping, matchInvoices, type InvoiceStatus, type Order, type UploadFormat } from "@/lib/orders";
import { writeXlsx } from "@/lib/xlsx";
import { TableLoader, type LoadedTable } from "./TableLoader";

const COURIER_OPTIONS = ["CJ대한통운", "롯데택배", "한진택배", "우체국택배", "로젠택배", "경동택배"];

/** 회신 파일마다 머리글이 달라 [주문번호, 송장, 택배사, 받는분, 연락처] 표준 줄로 맞춘다 */
const STANDARD = { orderNo: 0, invoice: 1, courier: 2, receiver: 3, phone: 4 };

function normalizeReply(table: LoadedTable): { rows: string[][]; ok: boolean } {
  const candidates = table.rows.slice(0, 5).map((row, i) => ({ i, mapping: detectInvoiceMapping(row) }));
  const best = candidates.reduce((a, b) => (Object.keys(b.mapping).length > Object.keys(a.mapping).length ? b : a));
  const { mapping } = best;
  if (mapping.invoice === undefined) return { rows: [], ok: false };
  const pick = (row: string[], index: number | undefined) => (index === undefined ? "" : (row[index] ?? ""));
  return {
    ok: true,
    rows: table.rows.slice(best.i + 1).map((row) => [pick(row, mapping.orderNo), pick(row, mapping.invoice), pick(row, mapping.courier), pick(row, mapping.receiver), pick(row, mapping.phone)]),
  };
}

const STATUS: Record<InvoiceStatus, { label: string; tone: "good" | "warn" | "loss" }> = {
  ok: { label: "준비됨", tone: "good" },
  check: { label: "확인 필요", tone: "warn" },
  missing: { label: "회신 없음", tone: "loss" },
};

export function InvoiceMatcher({ orders, headers }: { orders: Order[]; headers: string[] }) {
  const [replies, setReplies] = useState<LoadedTable[]>([]);
  const [badFiles, setBadFiles] = useState<string[]>([]);
  const [courier, setCourier] = useState(COURIER_OPTIONS[0]);
  const [format, setFormat] = useState<UploadFormat>("smartstore");

  const normalized = replies.map(normalizeReply);
  const { results, orphans } = matchInvoices(
    orders,
    normalized.flatMap((n) => n.rows),
    STANDARD,
    courier,
  );
  const count = (s: InvoiceStatus) => results.filter((r) => r.status === s).length;

  const addReplies = (tables: LoadedTable[]) => {
    const bad = tables.filter((t) => !normalizeReply(t).ok).map((t) => t.name);
    setBadFiles(bad);
    setReplies((prev) => [...prev, ...tables.filter((t) => !bad.includes(t.name))]);
  };

  const download = async () => {
    const sheet = buildUploadSheet(results, format, headers);
    downloadBlob(await writeXlsx(sheet, "발송처리"), `송장업로드_${format === "smartstore" ? "스마트스토어" : "원본양식"}_${toDateKey(new Date())}.xlsx`);
  };

  return (
    <div className="space-y-5">
      <Card title="공급처 송장 회신 불러오기">
        <TableLoader multiple onLoad={addReplies} hint="공급처마다 받은 회신 파일을 한꺼번에 올려도 돼요. 송장번호 열만 있으면 됩니다." />
        {badFiles.length > 0 && (
          <Notice tone="loss" className="mt-3">
            송장번호 열을 못 찾은 파일: {badFiles.join(", ")}. 머리글에 &lsquo;송장번호&rsquo;나 &lsquo;운송장번호&rsquo;가 있는지 확인해 주세요.
          </Notice>
        )}
        {replies.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-600">
            불러온 회신: {replies.map((r) => r.name).join(", ")}
            <Button variant="ghost" onClick={() => setReplies([])}>
              비우기
            </Button>
          </div>
        )}
      </Card>

      {replies.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="준비됨" value={`${count("ok")}건`} tone="good" />
            <Stat label="확인 필요" value={`${count("check")}건`} tone={count("check") ? "warn" : "default"} />
            <Stat label="회신 없음" value={`${count("missing")}건`} tone={count("missing") ? "loss" : "default"} />
            <Stat label="주문에 없는 회신" value={`${orphans.length}줄`} tone={orphans.length ? "warn" : "default"} hint="다른 날 주문이거나 주문번호가 달라요" />
          </div>

          <Card title="마켓 업로드 파일">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="택배사가 비어 있을 때 기본값">
                <Select value={courier} onChange={(e) => setCourier(e.target.value)}>
                  {COURIER_OPTIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="양식">
                <Select value={format} onChange={(e) => setFormat(e.target.value as UploadFormat)}>
                  {UPLOAD_FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button onClick={download} disabled={count("ok") === 0}>
                준비된 {count("ok")}건 엑셀 받기
              </Button>
            </div>
            <p className="mt-2 text-xs text-stone-500">
              &lsquo;확인 필요&rsquo;·&lsquo;회신 없음&rsquo;은 파일에서 빠져요. 잘못된 송장을 올리면 고객 배송조회가 꼬이고 마켓 페널티를 받을 수 있어 확인한 뒤 따로 처리하세요.
            </p>
          </Card>

          <Card title="주문별 송장">
            <div className="max-h-[28rem] overflow-y-auto">
              <Table>
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>주문번호</th>
                    <th>받는 분</th>
                    <th>상품</th>
                    <th>택배사</th>
                    <th>송장번호</th>
                    <th>확인할 점</th>
                  </tr>
                </thead>
                <tbody>
                  {[...results]
                    .sort((a, b) => ["check", "missing", "ok"].indexOf(a.status) - ["check", "missing", "ok"].indexOf(b.status))
                    .map((r) => (
                      <tr key={r.order.key}>
                        <td>
                          <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                        </td>
                        <td className="text-xs tabular-nums">{r.order.orderNo}</td>
                        <td>{r.order.receiver}</td>
                        <td className="max-w-52 truncate text-xs" title={r.order.productName}>
                          {r.order.productName} {r.order.optionName}
                        </td>
                        <td className="text-xs">{r.courier}</td>
                        <td className="text-xs tabular-nums">{r.invoice}</td>
                        <td className="text-xs text-amber-700">{r.reason}</td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
