"use client";

import { useCallback, useMemo, useState } from "react";
import { AdReport } from "@/components/ads/AdReport";
import { WingSales } from "@/components/ads/WingSales";
import { TableLoader, type LoadedTable } from "@/components/TableLoader";
import { Button, Card, Notice, NumberInput, PageHeader, Toggle } from "@/components/ui";
import { reportPeriod, type ReportPeriod } from "@/lib/adInsights";
import { parseAdReport, productBreakEven, type AdField, type AdRow } from "@/lib/coupangAds";
import { num } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

const COUPANG_ID = "coupang";
/** 연결된 상품이 하나도 없을 때의 기본 손익분기 ROAS (광고 전 이익률 33%) */
const FALLBACK_BREAK_EVEN = 300;
const VAT = 1.1;

interface LoadedReport {
  name: string;
  rows: AdRow[];
  fields: AdField[];
  window: string | null;
  period: ReportPeriod | null;
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
  const suggested = useMemo(() => median(skus.flatMap((s) => productBreakEven(`${s.productName} ${s.optionName}`, [s], coupang, costs)?.roas ?? [])) ?? FALLBACK_BREAK_EVEN, [skus, coupang, costs]);
  const [baseInput, setBaseInput] = useState<number | null>(null);
  const baseBreakEven = Math.round(baseInput ?? suggested);

  const linked = useMemo(() => {
    const map = new Map<string, ReturnType<typeof productBreakEven>>();
    for (const r of report?.rows ?? []) if (!map.has(r.product)) map.set(r.product, productBreakEven(r.product, skus, coupang, costs));
    return map;
  }, [report, skus, coupang, costs]);

  const breakEvenOf = useCallback((r: AdRow) => linked.get(r.product)?.roas ?? baseBreakEven, [linked, baseBreakEven]);

  const load = ([table]: LoadedTable[]) => {
    const parsed = parseAdReport(table.rows);
    if (parsed.missing.length) return setError(`${table.name}: ${parsed.missing.map((f) => f.label).join("·")} 열을 찾지 못했어요. 쿠팡 광고센터의 "상품광고 보고서" 엑셀이 맞는지 확인해 주세요.`);
    if (!parsed.rows.length) return setError(`${table.name}: 광고 성과가 있는 줄이 없어요.`);
    setError("");
    setReport({
      name: table.name,
      rows: parsed.rows,
      fields: parsed.fields,
      window: parsed.window,
      period: reportPeriod(parsed.rows, table.name),
    });
  };

  const linkedCount = [...linked.values()].filter(Boolean).length;
  const costMultiplier = withVat ? VAT : 1;

  return (
    <>
      <PageHeader
        title="쿠팡 광고 분석"
        description="광고센터 엑셀 · 손익분기 ROAS 기준으로 줄일 곳과 늘릴 곳을 가려 드려요."
        actions={
          report && (
            <Button variant="secondary" onClick={() => setReport(null)}>
              다른 보고서 올리기
            </Button>
          )
        }
      />

      {!report ? (
        <Card title="광고 보고서 올리기">
          <TableLoader onLoad={load} hint="파일은 이 브라우저에서만 읽고, 서버로 보내지 않아요." />
          {error && (
            <Notice tone="loss" className="mt-3">
              {error}
            </Notice>
          )}
          <details className="mt-5 border-t border-stone-100 pt-4">
            <summary className="cursor-pointer text-sm font-medium text-stone-600">보고서 받는 법</summary>
            <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-sm leading-6 text-stone-600">
              <li>
                쿠팡 광고센터 → <b>광고 보고서</b>
              </li>
              <li>
                <b>상품광고 보고서</b>, 기간은 합계 또는 일별
              </li>
              <li>
                구조를 <b>키워드</b>까지 펼친 뒤 엑셀 다운로드
              </li>
            </ol>
            <p className="mt-3 text-xs text-stone-400">쿠팡은 광고 데이터 API를 열지 않아 파일로 분석해요. 실제 주문 매출은 윙 Open API로 비교할 수 있어요.</p>
          </details>
        </Card>
      ) : (
        <AdReport
          rows={report.rows}
          fields={report.fields}
          fileName={report.name}
          window={report.window}
          period={report.period}
          breakEvenOf={breakEvenOf}
          costMultiplier={costMultiplier}
          settings={
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <label
                className="flex items-center gap-2"
                title="손익분기 ROAS = 판매가 ÷ 광고비 빼기 전 이익 (300%면 광고 전 이익률 33%). 마진 계산기에 쿠팡 판매가를 넣은 상품은 이름으로 자동 연결되고, 나머지는 이 값으로 '남긴 돈'을 추정해요."
              >
                <span className="text-stone-600">기본 손익분기</span>
                <span className="w-24">
                  <NumberInput value={baseBreakEven} onValueChange={setBaseInput} suffix="%" />
                </span>
              </label>
              <Toggle checked={withVat} onChange={setWithVat} label="광고비 부가세 10%" />
              <span className="text-xs text-stone-400" title="마진 계산기에 쿠팡 판매가가 있어 상품별 손익분기를 쓰는 상품 수">
                상품 연결 {linkedCount}/{linked.size} · {num(report.rows.length)}줄
              </span>
            </div>
          }
          sales={<WingSales key={report.name} rows={report.rows} period={report.period} costMultiplier={costMultiplier} breakEven={baseBreakEven} />}
        />
      )}
    </>
  );
}
