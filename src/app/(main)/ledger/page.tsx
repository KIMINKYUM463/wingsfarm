"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, Notice, PageHeader, Stat, Table, TextInput } from "@/components/ui";
import { LedgerForm } from "@/components/ledger/LedgerForm";
import { downloadBlob } from "@/lib/file";
import { percent, toDateKey, won } from "@/lib/format";
import { entryProfit, estimateVat, groupTotals, inMonth, ledgerCsvRows, totals } from "@/lib/ledger";
import { toCsv } from "@/lib/table";
import type { LedgerEntry } from "@/types";
import { useAppStore } from "@/store/useAppStore";

const TREND_MONTHS = 6;

function recentMonths(month: string, count: number) {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => toDateKey(new Date(y, m - 1 - (count - 1 - i), 1)).slice(0, 7));
}

function GroupTable({ title, rows }: { title: string; rows: ReturnType<typeof groupTotals> }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <EmptyState>기록이 없어요</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>항목</th>
              <th className="text-right">매출</th>
              <th className="text-right">순이익</th>
              <th className="text-right">마진율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="max-w-52 truncate">{r.key}</td>
                <td className="text-right tabular-nums">{won(r.revenue)}</td>
                <td className={`text-right tabular-nums ${r.profit < 0 ? "text-rose-600" : ""}`}>{won(r.profit)}</td>
                <td className="text-right tabular-nums">{r.revenue > 0 ? percent(r.marginRate) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

export default function LedgerPage() {
  const ledger = useAppStore((s) => s.ledger);
  const channels = useAppStore((s) => s.channels);
  const removeLedgerEntry = useAppStore((s) => s.removeLedgerEntry);
  const [month, setMonth] = useState(toDateKey(new Date()).slice(0, 7));
  const [editing, setEditing] = useState<LedgerEntry | "new" | null>(null);

  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? "삭제된 채널";
  const entries = inMonth(ledger, month).sort((a, b) => b.date.localeCompare(a.date));
  const sum = totals(entries);
  const vat = estimateVat(entries);
  const trend = recentMonths(month, TREND_MONTHS).map((m) => ({ month: m, ...totals(inMonth(ledger, m)) }));
  const maxRevenue = Math.max(1, ...trend.map((t) => t.revenue));

  const exportCsv = () => downloadBlob(new Blob([toCsv(ledgerCsvRows(entries, channelName))], { type: "text/csv" }), `매출장부_${month}.csv`);

  return (
    <>
      <PageHeader
        title="매출 장부"
        description="마켓 정산서와 따로 보는 '진짜 남은 돈'. 발주서 도우미에서 주문을 넣거나 직접 기록하세요."
        actions={
          <>
            <TextInput type="month" className="w-auto!" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="월 선택" />
            <Button variant="secondary" onClick={exportCsv} disabled={entries.length === 0}>
              CSV 받기
            </Button>
            <Button onClick={() => setEditing("new")} disabled={channels.length === 0}>
              + 기록
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="매출" value={won(sum.revenue)} hint={`${sum.count}건 · ${sum.qty}개`} />
        <Stat label="순이익" value={won(sum.profit)} tone={sum.profit < 0 ? "loss" : "good"} hint="매출 − 원가 − 수수료 − 광고비 − 기타" />
        <Stat label="마진율" value={sum.revenue > 0 ? percent(sum.marginRate) : "-"} tone={sum.marginRate < 0.1 ? "warn" : "default"} />
        <Stat label="광고비" value={won(sum.ad)} hint={sum.revenue > 0 ? `매출 대비 ${percent(sum.ad / sum.revenue)}` : undefined} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card title={`최근 ${TREND_MONTHS}개월`}>
          <div className="flex gap-3">
            {trend.map((t) => (
              <button key={t.month} type="button" onClick={() => setMonth(t.month)} className="flex flex-1 flex-col items-center gap-1" title={`${t.month} 매출 ${won(t.revenue)} / 순이익 ${won(t.profit)}`}>
                <div className="flex h-32 w-full items-end justify-center gap-0.5">
                  <div className="w-1/2 rounded-t bg-stone-300" style={{ height: `${(t.revenue / maxRevenue) * 100}%` }} />
                  <div className={`w-1/2 rounded-t ${t.profit < 0 ? "bg-rose-400" : "bg-emerald-500"}`} style={{ height: `${(Math.abs(t.profit) / maxRevenue) * 100}%` }} />
                </div>
                <span className={`text-xs ${t.month === month ? "font-bold text-emerald-700" : "text-stone-500"}`}>{Number(t.month.slice(5))}월</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-400">회색 = 매출, 초록 = 순이익 (빨강은 적자). 막대를 누르면 그 달로 이동해요.</p>
        </Card>

        <Card title="부가세 대략 계산 (일반과세자)">
          <dl className="space-y-1.5 text-sm">
            {[
              ["과세 매출", vat.taxableRevenue],
              ["면세 매출 (신선 농·수산물)", vat.taxFreeRevenue],
              ["매출세액 (과세 매출의 1/11)", vat.outputVat],
              ["매입세액 추정 (과세 원가 + 수수료·광고비 과세분의 1/11)", vat.inputVat],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-stone-500">{label}</dt>
                <dd className="tabular-nums">{won(value as number)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2 border-t border-stone-200 pt-1.5 font-semibold">
              <dt>이번 달 몫 예상 납부액</dt>
              <dd className="tabular-nums">{won(vat.payable)}</dd>
            </div>
          </dl>
          <Notice tone="warn" className="mt-3 text-xs">
            세금계산서·카드 증빙이 모두 있다고 가정한 대략치예요. 수수료·광고비는 과세 매출 비율만큼만 공제로 보고, 간이과세자·면세사업자·의제매입세액 공제는 반영하지 않아요. 신고는
            홈택스·세무사와 확인하세요.
          </Notice>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <GroupTable title="채널별" rows={groupTotals(entries, (e) => channelName(e.channelId))} />
        <GroupTable title="상품별" rows={groupTotals(entries.filter((e) => e.qty > 0), (e) => e.label)} />
      </div>

      <Card title={`${month} 기록 ${entries.length}건`} className="mt-5">
        {entries.length === 0 ? (
          <EmptyState>
            이 달 기록이 없어요. <Link href="/orders" className="text-emerald-700 underline">발주서 도우미</Link>에서 주문 파일을 장부에 넣거나 &lsquo;+ 기록&rsquo;으로 직접 적어 보세요.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>채널</th>
                <th>내용</th>
                <th className="text-right">수량</th>
                <th className="text-right">매출</th>
                <th className="text-right">원가</th>
                <th className="text-right">수수료</th>
                <th className="text-right">광고·기타</th>
                <th className="text-right">순이익</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-xs tabular-nums">{e.date.slice(5)}</td>
                  <td className="whitespace-nowrap text-xs">{channelName(e.channelId)}</td>
                  <td className="max-w-56 truncate">
                    {e.label} {e.source === "orders" && <Badge>주문파일</Badge>} {e.taxFree || e.qty === 0 ? null : <Badge tone="info">과세</Badge>}
                  </td>
                  <td className="text-right tabular-nums">{e.qty || "-"}</td>
                  <td className="text-right tabular-nums">{won(e.revenue)}</td>
                  <td className="text-right tabular-nums">{won(e.cost)}</td>
                  <td className="text-right tabular-nums">{won(e.fee)}</td>
                  <td className="text-right tabular-nums">{won(e.ad + e.other)}</td>
                  <td className={`text-right font-medium tabular-nums ${entryProfit(e) < 0 ? "text-rose-600" : ""}`}>{won(entryProfit(e))}</td>
                  <td className="whitespace-nowrap text-right">
                    <Button variant="ghost" onClick={() => setEditing(e)}>
                      수정
                    </Button>
                    <Button variant="danger" onClick={() => confirm(`'${e.label}' 기록을 지울까요?`) && removeLedgerEntry(e.id)}>
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={editing !== null} title={editing === "new" ? "장부 기록" : "기록 수정"} onClose={() => setEditing(null)}>
        {editing && <LedgerForm initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
