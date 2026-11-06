"use client";

import { useState } from "react";
import { optionBoard, soldLines, type SoldLine } from "@/lib/adOptions";
import type { BreakEvenOf, AdRow } from "@/lib/coupangAds";
import { num, won } from "@/lib/format";
import { DataTable, Panel, SectionHeader, TableHead, profitText, rateText, roasText, td, th } from "./parts";

const PAGE = 30;

function showDate(value: string) {
  const digits = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  return digits ? `${digits[1]}-${digits[2]}-${digits[3]}` : value || "-";
}

export function OptionPanel({ rows, breakEvenOf, costMultiplier }: { rows: AdRow[]; breakEvenOf: BreakEvenOf; costMultiplier: number }) {
  const options = optionBoard(rows, breakEvenOf, costMultiplier);
  const sold = soldLines(rows);
  const [soldLimit, setSoldLimit] = useState(PAGE);

  return (
    <>
      <Panel>
        <SectionHeader title="옵션별 성적" description="같은 상품이라도 옵션ID(없으면 옵션 이름)로 나눠, 어떤 옵션이 광고비를 쓰는지 봐요." />
        <DataTable minWidth="880px">
          <TableHead>
            <tr>
              <th className={th("left")}>옵션</th>
              <th className={th()}>광고비</th>
              <th className={th()}>매출</th>
              <th className={th()}>ROAS</th>
              <th className={th()}>남긴 돈</th>
              <th className={th()}>주문</th>
              <th className={th()}>클릭률</th>
              <th className={th()}>전환율</th>
            </tr>
          </TableHead>
          <tbody>
            {options.slice(0, 40).map((o) => (
              <tr key={o.key} className="border-t border-stone-100">
                <td className={`${td("max-w-72")}`}>
                  <p className="truncate font-medium text-stone-800" title={o.label}>
                    {o.label}
                  </p>
                  {o.key !== o.label && <p className="truncate text-xs text-stone-400">{o.key}</p>}
                </td>
                <td className={`${td()} text-right tabular-nums`}>{won(o.metrics.cost)}</td>
                <td className={`${td()} text-right tabular-nums`}>{won(o.metrics.revenue)}</td>
                <td className={`${td()} text-right font-semibold tabular-nums`}>{roasText(o.metrics.roas)}</td>
                <td className={`${td()} text-right tabular-nums ${(o.profit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{profitText(o.profit)}</td>
                <td className={`${td()} text-right tabular-nums`}>{num(o.metrics.orders)}</td>
                <td className={`${td()} text-right tabular-nums`}>{rateText(o.metrics.ctr, 2)}</td>
                <td className={`${td()} text-right tabular-nums`}>{rateText(o.metrics.cvr)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        {!options.length && <p className="py-6 text-center text-sm text-stone-400">옵션으로 나눌 행이 없어요.</p>}
      </Panel>
      <Panel>
        <SectionHeader title="팔린 옵션" description="매출이 난 줄만, 최근 날짜부터. 어떤 키워드가 어떤 옵션을 팔았는지 확인해요." />
        <SoldTable lines={sold.slice(0, soldLimit)} />
        {sold.length > soldLimit && (
          <button type="button" onClick={() => setSoldLimit((n) => n + PAGE)} className="mt-3 w-full rounded-lg bg-stone-50 py-2 text-sm text-stone-600 hover:bg-stone-100">
            {num(sold.length - soldLimit)}줄 더 보기
          </button>
        )}
      </Panel>
    </>
  );
}

function SoldTable({ lines }: { lines: SoldLine[] }) {
  if (!lines.length) return <p className="py-6 text-center text-sm text-stone-400">매출이 난 줄이 없어요.</p>;
  return (
    <DataTable minWidth="720px">
      <TableHead>
        <tr>
          <th className={th("left")}>날짜</th>
          <th className={th("left")}>옵션</th>
          <th className={th("left")}>키워드</th>
          <th className={th()}>주문</th>
          <th className={th()}>매출</th>
        </tr>
      </TableHead>
      <tbody>
        {lines.map((line, i) => (
          <tr key={`${line.date}-${line.option}-${line.keyword}-${i}`} className="border-t border-stone-100">
            <td className={`${td()} tabular-nums text-stone-500`}>{showDate(line.date)}</td>
            <td className={`${td("max-w-64 truncate")}`} title={line.option}>
              {line.option}
            </td>
            <td className={`${td("max-w-40 truncate")}`}>{line.keyword}</td>
            <td className={`${td()} text-right tabular-nums`}>{num(line.orders)}</td>
            <td className={`${td()} text-right tabular-nums`}>{won(line.revenue)}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
