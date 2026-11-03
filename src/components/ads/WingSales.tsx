"use client";

import { useEffect, useMemo, useState } from "react";
import type { HealthResponse } from "@/app/api/health/route";
import { Button, Notice, Stat, Table } from "@/components/ui";
import { Panel, SectionHeader } from "./parts";
import { summarize, type AdRow } from "@/lib/coupangAds";
import { toIsoDate, totalSalesView, type WingSales as Sales, type WingSalesResponse } from "@/lib/coupangWing";
import { num, percent, won } from "@/lib/format";

const TOP_PRODUCTS = 5;

interface Props {
  rows: AdRow[];
  /** 보고서 기간 (날짜 열이 없는 기간 합계 보고서는 파일 이름에서) */
  period: { from: string; to: string } | null;
  costMultiplier: number;
  breakEven: number;
}

const rate = (value: number | null) => (value === null ? "-" : percent(value, 1));

/** 광고 기간의 실제 쿠팡 매출(윙 Open API)과 광고비를 비교 — 광고 ROAS가 놓치는 "광고 덕에 늘어난 전체 매출"을 본다 */
export function WingSales({ rows, period, costMultiplier, breakEven }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [sales, setSales] = useState<Sales | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((h) => setConfigured(h.coupangWing))
      .catch(() => setConfigured(false));
  }, []);

  const adByDate = useMemo(() => {
    const map = new Map<string, AdRow[]>();
    for (const r of rows) {
      const date = toIsoDate(r.date);
      if (date) map.set(date, [...(map.get(date) ?? []), r]);
    }
    return map;
  }, [rows]);

  const load = async () => {
    if (!period) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/coupang/sales?from=${period.from}&to=${period.to}`);
      const body = (await res.json()) as WingSalesResponse;
      if (!body.configured) setConfigured(false);
      else if ("error" in body) setError(body.error);
      else setSales(body);
    } catch {
      setError("서버에 연결하지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  if (configured === null) return null;
  if (!configured) return <SetupGuide />;

  return (
    <Card
      title="실제 쿠팡 매출과 비교"
      actions={
        period && (
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? "불러오는 중…" : sales ? "다시 불러오기" : "실제 매출 불러오기"}
          </Button>
        )
      }
    >
      {!period && <Notice tone="warn">보고서 기간을 알 수 없어요. 기간 구분을 &quot;일별&quot;로 만들거나, 파일 이름을 광고센터에서 받은 그대로(…_20261012_20261102.xlsx) 올려 주세요.</Notice>}
      {period && !sales && !error && (
        <p className="text-sm text-stone-500">
          광고 보고서 기간({period.from} ~ {period.to})의 쿠팡 주문을 윙 Open API로 불러와, 광고를 거치지 않은 주문까지 합친 <b>전체 매출 대비 광고비</b>를 계산해요.
        </p>
      )}
      {error && <Notice tone="loss">{error}</Notice>}
      {sales && <Comparison sales={sales} adByDate={adByDate} costMultiplier={costMultiplier} breakEven={breakEven} rows={rows} />}
    </Card>
    </Panel>
}

function Comparison({ sales, adByDate, rows, costMultiplier, breakEven }: { sales: Sales; adByDate: Map<string, AdRow[]>; rows: AdRow[]; costMultiplier: number; breakEven: number }) {
  const ad = summarize(rows, costMultiplier);
  const view = totalSalesView(ad.cost, ad.revenue, sales.total.sales, breakEven);
  const salesByDate = new Map(sales.days.map((d) => [d.date, d]));
  const days = [...new Set([...adByDate.keys(), ...salesByDate.keys()])].sort();
  const daily = adByDate.size > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="쿠팡 전체 매출" value={won(sales.total.sales)} hint={`주문 ${num(sales.total.orders)}건 · ${num(sales.total.units)}개`} />
        <Stat label="광고로 난 매출 비중" value={rate(view.adShare)} hint={`광고 매출 ${won(ad.revenue)}`} />
        <Stat label="광고 없이 난 매출" value={won(view.organic)} hint="검색·재구매 등" />
        <Stat
          label="전체 매출 대비 광고비"
          value={rate(view.tacos)}
          hint={`버틸 수 있는 선 ${rate(view.limit)} (손익분기 ${num(breakEven)}%)`}
          tone={view.healthy === null ? "default" : view.healthy ? "good" : "loss"}
        />
      </div>

      {view.healthy !== null && (
        <Notice tone={view.healthy ? "good" : "loss"}>
          {view.healthy
            ? `광고 매출만 보면 ROAS ${ad.roas === null ? "-" : `${num(ad.roas)}%`}지만, 쿠팡 전체 매출로 보면 광고비가 매출의 ${rate(view.tacos)}라 광고비 빼기 전 이익률(${rate(view.limit)}) 안에 있어요. 상품 전체로는 광고비를 감당하고 있어요.`
            : `쿠팡 전체 매출로 봐도 광고비가 매출의 ${rate(view.tacos)}로, 광고비 빼기 전 이익률(${rate(view.limit)})을 넘어요. 위의 제외 후보·적자 키워드부터 줄이세요.`}
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Table>
          <thead>
            <tr>
              <th>날짜</th>
              {daily && <th className="text-right">광고비</th>}
              {daily && <th className="text-right">광고 매출</th>}
              <th className="text-right">전체 매출</th>
              {daily && <th className="text-right">전체 대비 광고비</th>}
            </tr>
          </thead>
          <tbody>
            {days.map((date) => {
              const dayAd = summarize(adByDate.get(date) ?? [], costMultiplier);
              const total = salesByDate.get(date)?.sales ?? 0;
              const tacos = total > 0 ? dayAd.cost / total : null;
              return (
                <tr key={date}>
                  <td className="tabular-nums">{date}</td>
                  {daily && <td className="text-right tabular-nums">{won(dayAd.cost)}</td>}
                  {daily && <td className="text-right tabular-nums">{won(dayAd.revenue)}</td>}
                  <td className="text-right tabular-nums">{won(total)}</td>
                  {daily && (
                    <td className={`text-right font-semibold tabular-nums ${tacos !== null && view.limit !== null ? (tacos <= view.limit ? "text-emerald-600" : "text-rose-600") : ""}`}>{rate(tacos)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
        <div>
          <p className="mb-2 text-xs font-semibold text-stone-500">기간 매출 상위 상품</p>
          <ol className="space-y-1.5 text-sm">
            {sales.products.slice(0, TOP_PRODUCTS).map((p, i) => (
              <li key={p.name} className="flex justify-between gap-3">
                <span className="truncate text-stone-700" title={p.name}>
                  {i + 1}. {p.name}
                </span>
                <span className="shrink-0 tabular-nums text-stone-500">{won(p.sales)}</span>
              </li>
            ))}
            {!sales.products.length && <li className="text-stone-400">이 기간 주문이 없어요.</li>}
          </ol>
        </div>
      </div>
      <p className="text-xs text-stone-400">
        주문일 기준, 취소·환불대기 수량을 뺀 판매가 합계예요(쿠폰 할인 전). 오늘 들어온 주문은 아직 덜 잡혔을 수 있어요. 개인정보는 불러오지 않고 합계만 계산해요.
      </p>
    </div>
  );
}

function SetupGuide() {
  return (
    <Card title="실제 쿠팡 매출과 비교 (선택)">
    <Panel>
      <SectionHeader title="실제 쿠팡 매출 (선택)" />
      <p className="text-sm text-stone-600">광고 ROAS는 광고를 거친 주문만 세요. 윙 Open API를 연결하면 같은 기간의 전체 주문 매출과 비교해요.</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-sm leading-6 text-stone-600">
        <li>
          <a href="https://wing.coupang.com" target="_blank" rel="noreferrer" className="text-emerald-700 underline">
            쿠팡 윙
          </a>{" "}
          → 판매자정보 → <b>추가판매자정보</b> → OPEN API 키 발급
        </li>
        <li>
          업체 입력 방식 <b>자체개발(직접입력)</b>, IP 칸에 이 프로그램이 돌아가는 PC·서버의 <b>공인 IP</b>
        </li>
        <li>
          프로젝트 폴더 <code className="rounded bg-stone-100 px-1">.env.local</code>에 <code className="rounded bg-stone-100 px-1">COUPANG_VENDOR_ID</code>(업체코드),{" "}
          <code className="rounded bg-stone-100 px-1">COUPANG_ACCESS_KEY</code>, <code className="rounded bg-stone-100 px-1">COUPANG_SECRET_KEY</code> 입력 → 서버 재시작
        </li>
      </ol>
      <p className="mt-3 text-xs text-stone-400">키는 발급 후 사용까지 최대 하루가 걸릴 수 있고, 180일마다 다시 발급해야 해요.</p>
    </Panel>
}
