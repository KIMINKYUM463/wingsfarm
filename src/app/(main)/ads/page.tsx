"use client";

import { useCallback, useMemo, useState } from "react";
import { AdReport } from "@/components/ads/AdReport";
import { WingSales } from "@/components/ads/WingSales";
import { TableLoader, type LoadedTable } from "@/components/TableLoader";
import { Button, Card, Field, Notice, NumberInput, PageHeader, Toggle } from "@/components/ui";
import { parseAdReport, productBreakEven, type AdRow } from "@/lib/coupangAds";
import { num } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

const COUPANG_ID = "coupang";
/** 연결된 상품이 하나도 없을 때의 기본 손익분기 ROAS (마진 25% 상품 ≈ 400%) */
const FALLBACK_BREAK_EVEN = 300;
const VAT = 1.1;

interface LoadedReport {
  name: string;
  rows: AdRow[];
  window: string | null;
}

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export default function AdsPage() {
  const { channels, costs, skus } = useAppStore();
  const coupang = channels.find((c) => c.id === COUPANG_ID);
  const [report, setReport] = useState<LoadedReport | null>(null);
  const [error, setError] = useState("");
  const [withVat, setWithVat] = useState(true);

  // 마진 계산기에 쿠팡 판매가가 있는 상품들의 손익분기 중앙값 → 연결 안 된 상품의 기본값
  const suggested = useMemo(
    () => median(skus.flatMap((s) => productBreakEven(`${s.productName} ${s.optionName}`, [s], coupang, costs)?.roas ?? [])) ?? FALLBACK_BREAK_EVEN,
    [skus, coupang, costs],
  );
  const [baseInput, setBaseInput] = useState<number | null>(null);
  const baseBreakEven = Math.round(baseInput ?? suggested);

  const linked = useMemo(() => {
    const map = new Map<string, ReturnType<typeof productBreakEven>>();
    for (const r of report?.rows ?? []) if (!map.has(r.product)) map.set(r.product, productBreakEven(r.product, skus, coupang, costs));
    return map;
  }, [report, skus, coupang, costs]);

  const breakEvenOf = useCallback((r: AdRow) => linked.get(r.product)?.roas ?? baseBreakEven, [linked, baseBreakEven]);
  const linkedSkuOf = useCallback((product: string) => {
    const found = linked.get(product);
    return found ? `${found.sku.productName} ${found.sku.optionName} (손익분기 ${num(found.roas)}%)` : null;
  }, [linked]);

  const load = ([table]: LoadedTable[]) => {
    const parsed = parseAdReport(table.rows);
    if (parsed.missing.length) return setError(`${table.name}: ${parsed.missing.map((f) => f.label).join("·")} 열을 찾지 못했어요. 쿠팡 광고센터의 "상품광고 보고서" 엑셀이 맞는지 확인해 주세요.`);
    if (!parsed.rows.length) return setError(`${table.name}: 광고 성과가 있는 줄이 없어요.`);
    setError("");
    setReport({ name: table.name, rows: parsed.rows, window: parsed.window });
  };

  const dates = report?.rows.map((r) => r.date).filter(Boolean).sort() ?? [];
  const linkedCount = [...linked.values()].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="쿠팡 광고 분석"
        description="광고센터에서 받은 광고 보고서 엑셀을 올리면, 키워드·상품별 ROAS를 마진 계산기의 손익분기 ROAS와 비교해 줄일 것·늘릴 것을 알려 드려요."
        actions={report && <Button variant="secondary" onClick={() => setReport(null)}>다른 보고서 올리기</Button>}
      />

      {!report ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card title="광고 보고서 올리기">
            <TableLoader onLoad={load} hint="파일은 이 브라우저에서만 읽고, 서버로 보내지 않아요." />
            {error && <Notice tone="loss" className="mt-3">{error}</Notice>}
          </Card>
          <Card title="보고서 받는 법">
            <ol className="list-decimal space-y-2 pl-4 text-sm leading-6 text-stone-600">
              <li>쿠팡 광고센터 → <b>광고 보고서</b> 탭</li>
              <li><b>상품광고 보고서</b>, 기간 선택, 기간 구분 <b>일별</b></li>
              <li>보고서 구조를 <b>키워드</b> 단위까지 펼치기</li>
              <li>생성된 보고서를 <b>엑셀 다운로드</b> → 여기에 끌어다 놓기</li>
            </ol>
            <Notice className="mt-3">쿠팡은 판매자 광고 데이터를 API로 제공하지 않아 파일로 분석해요. 대신 실제 주문 매출은 윙 Open API로 불러와 비교할 수 있어요. 보고서 예약을 걸면 매일·매주·매월 오전 8시에 자동으로 만들어져요.</Notice>
          </Card>
        </div>
      ) : (
        <>
          <Card className="mb-6">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="font-medium text-stone-800">{report.name}</p>
                <p className="text-xs text-stone-500">
                  {dates.length ? `${dates[0]} ~ ${dates.at(-1)} · ` : ""}
                  {num(report.rows.length)}줄 · 전환 기준 {report.window ?? "보고서 기본"} · 마진 계산기 상품 연결 {linkedCount}/{linked.size}
                </p>
              </div>
              <div className="w-48">
                <Field label="기본 손익분기 ROAS" hint="연결 안 된 상품에 적용">
                  <NumberInput value={baseBreakEven} onValueChange={setBaseInput} suffix="%" />
                </Field>
              </div>
              <div className="pb-2">
                <Toggle checked={withVat} onChange={setWithVat} label="광고비에 부가세 10% 더하기" />
              </div>
            </div>
            <p className="mt-2 text-xs text-stone-400">
              손익분기 ROAS = 판매가 ÷ 광고비 빼기 전 이익. 마진 계산기에 쿠팡 판매가를 넣은 상품은 이름으로 자동 연결돼요. 보고서 광고비가 부가세 별도라면 실제 지출은 부가세를 더한 금액이에요.
            </p>
          </Card>
          <AdReport rows={report.rows} breakEvenOf={breakEvenOf} linkedSkuOf={linkedSkuOf} baseBreakEven={baseBreakEven} costMultiplier={withVat ? VAT : 1} />
          <div className="mt-6">
            <WingSales key={report.name} rows={report.rows} costMultiplier={withVat ? VAT : 1} breakEven={baseBreakEven} />
          </div>
        </>
      )}
    </>
  );
}
