"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Sparkline } from "@/components/charts";
import { Badge, Card, CommitNumber, EmptyState, Stat, Table, Toggle } from "@/components/ui";
import { countByStatus, evaluateListings, priceChangeRate, type ListingEval } from "@/lib/margin";
import { percent, won } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

const SHOCK_MIN = -30;
const SHOCK_MAX = 50;

const CELL_TONE = { good: "", warn: "bg-amber-50/70", loss: "bg-rose-50" } as const;
const RATE_TONE = { good: "text-emerald-600", warn: "text-amber-600", loss: "font-bold text-rose-600" } as const;

export function MarginBoard() {
  const { skus, channels, costs, suppliers, setSupplyPrice, setListing } = useAppStore();
  const [shock, setShock] = useState(0);
  const [onlyIssues, setOnlyIssues] = useState(false);

  const evals = useMemo(() => evaluateListings(skus, channels, costs, 1 + shock / 100), [skus, channels, costs, shock]);
  const byKey = useMemo(() => new Map(evals.map((e) => [`${e.skuId}:${e.channelId}`, e])), [evals]);
  const counts = countByStatus(evals);
  const issueIds = new Set(evals.filter((e) => e.status !== "good").map((e) => e.skuId));
  const rows = onlyIssues ? skus.filter((s) => issueIds.has(s.id)) : skus;

  if (skus.length === 0) {
    return (
      <EmptyState>
        등록된 상품이 없습니다.{" "}
        <Link href="/settings" className="text-emerald-700 underline">
          설정
        </Link>
        에서 공급처와 상품(채널별 판매가 포함)을 등록하면, 모든 상품의 마진을 한눈에 점검할 수 있어요.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="판매 중 (상품×채널)" value={`${evals.length}건`} />
        <Stat label="역마진" value={`${counts.loss}건`} tone={counts.loss ? "loss" : "default"} hint="팔수록 손해" />
        <Stat label={`목표 ${costs.targetMargin}% 미달`} value={`${counts.warn}건`} tone={counts.warn ? "warn" : "default"} />
        <Stat label="정상" value={`${counts.good}건`} tone="good" />
      </div>

      <Card
        title="공급가 변동 시뮬레이션"
        actions={shock !== 0 && <Badge tone="warn">가정 상태 · 저장된 공급가는 그대로</Badge>}
      >
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="range"
            min={SHOCK_MIN}
            max={SHOCK_MAX}
            step={5}
            value={shock}
            onChange={(e) => setShock(Number(e.target.value))}
            className="h-2 min-w-56 flex-1 cursor-pointer accent-emerald-600"
            aria-label="공급가 변동률"
          />
          <span className={`w-20 text-right text-lg font-bold tabular-nums ${shock > 0 ? "text-rose-600" : shock < 0 ? "text-emerald-600" : "text-stone-700"}`}>
            {shock > 0 ? "+" : ""}
            {shock}%
          </span>
          <button type="button" onClick={() => setShock(0)} className="text-xs text-stone-500 hover:text-stone-800" disabled={shock === 0}>
            초기화
          </button>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          경락가·산지 시세가 오르면 어떤 상품이 먼저 역마진이 되는지 미리 확인하세요. 권장가는 이 가정 기준으로 다시 계산됩니다.
        </p>
      </Card>

      <Card
        title="전체 상품 마진표"
        actions={<Toggle checked={onlyIssues} onChange={setOnlyIssues} label="문제 있는 상품만" />}
      >
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-emerald-700">역마진·목표 미달 상품이 없습니다 👍</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>상품</th>
                <th className="text-right">공급가</th>
                {channels.map((ch) => (
                  <th key={ch.id} className="text-right">
                    {ch.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((sku) => {
                const change = priceChangeRate(sku.priceHistory);
                return (
                  <tr key={sku.id}>
                    <td className="min-w-40">
                      <div className="font-medium">{sku.productName}</div>
                      <div className="text-xs text-stone-400">
                        {sku.optionName} · {suppliers.find((s) => s.id === sku.supplierId)?.name ?? "공급처 미지정"} · {sku.taxFree ? "면세" : "과세"}
                      </div>
                    </td>
                    <td className="text-right">
                      <CommitNumber value={sku.supplyPrice} onCommit={(v) => v !== null && v >= 0 && setSupplyPrice(sku.id, v)} />
                      <div className="flex items-center justify-end gap-1.5 text-[11px] text-stone-400">
                        <Sparkline values={sku.priceHistory.map((p) => p.price)} width={48} height={16} />
                        {change !== null && (
                          <span className={change > 0 ? "text-rose-500" : change < 0 ? "text-emerald-600" : ""}>
                            {change > 0 ? "+" : ""}
                            {percent(change)}
                          </span>
                        )}
                      </div>
                    </td>
                    {channels.map((ch) => (
                      <ListingCell
                        key={ch.id}
                        price={sku.listings[ch.id]}
                        evaluation={byKey.get(`${sku.id}:${ch.id}`)}
                        onPrice={(v) => setListing(sku.id, ch.id, v)}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
          판매가 칸을 눌러 바로 수정하세요(비우면 미판매). 공급가를 바꾸면 날짜별 이력이 쌓여 추세선으로 보입니다. 광고비율 {costs.adRate}% · CS 적립{" "}
          {costs.lossRate}% · 고객 배송비 {won(costs.customerShippingFee)} 기준.
        </p>
      </Card>
    </div>
  );
}

function ListingCell({ price, evaluation, onPrice }: { price?: number; evaluation?: ListingEval; onPrice: (v: number | null) => void }) {
  const status = evaluation?.status;
  return (
    <td className={`text-right align-top ${status ? CELL_TONE[status] : ""}`}>
      <CommitNumber value={price} placeholder="미판매" onCommit={onPrice} />
      {evaluation && (
        <div className="mt-0.5 space-y-0.5 text-[11px]">
          <div className={RATE_TONE[evaluation.status]}>
            {percent(evaluation.result.marginRate)} · {won(evaluation.result.profit)}
          </div>
          {evaluation.status !== "good" && evaluation.recommended && (
            <button
              type="button"
              onClick={() => onPrice(evaluation.recommended)}
              className="rounded-full bg-white px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
              title="목표 마진을 맞추는 최소 판매가로 바꿉니다"
            >
              권장 {won(evaluation.recommended)} 적용
            </button>
          )}
        </div>
      )}
    </td>
  );
}
