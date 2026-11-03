"use client";

import { Fragment, useState } from "react";
import { QUADRANT_META, type ProductStat, type Quadrant } from "@/lib/adInsights";
import { num, wonShort } from "@/lib/format";
import { DataTable, Panel, SectionHeader, TableHead, profitText, profitTone, rateText, roasText, td, th } from "./parts";

const QUADRANT_COLOR: Record<Quadrant, string> = {
  star: "#10b981",
  rising: "#0ea5e9",
  leak: "#f43f5e",
  drain: "#f59e0b",
};
const QUADRANTS: Quadrant[] = ["star", "rising", "leak", "drain"];

const W = 640;
const H = 340;
const PAD = { left: 52, right: 20, top: 20, bottom: 36 };
/** 세로축: ROAS ÷ 손익분기를 log2로 (1/8배 ~ 8배) */
const Y_LIMIT = 3;
const LABELS = 5;
const MIN_R = 6;
const MAX_R = 26;
/** 10px 글자 한 자의 대략 너비 (라벨 겹침 판정용) */
const CHAR_W = 9;
const LABEL_H = 12;

const ratioOf = (p: ProductStat) => (p.metrics.roas !== null && p.breakEven ? p.metrics.roas / p.breakEven : null);
const shortName = (key: string) => key.replace(/^\[[^\]]*\]\s*/, "").slice(0, 12);

interface Box {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}
const overlaps = (a: Box, b: Box) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

interface Bubble {
  product: ProductStat;
  cx: number;
  cy: number;
  r: number;
}
interface Label {
  key: string;
  text: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
}

/** 매출 큰 순으로 위 → 아래 자리를 시도하고, 다른 라벨과 겹치면 뺀다. 선택된 상품은 항상 표시 */
function placeLabels(bubbles: Bubble[], keys: Set<string>, selected: string): Label[] {
  const placed: Box[] = [];
  const labels: Label[] = [];
  const ordered = [...bubbles.filter((b) => b.product.key === selected), ...bubbles.filter((b) => b.product.key !== selected && keys.has(b.product.key))];
  for (const { product, cx, cy, r } of ordered) {
    const text = shortName(product.key);
    const width = text.length * CHAR_W;
    const anchor = cx + width / 2 > W - PAD.right ? "end" : cx - width / 2 < PAD.left ? "start" : "middle";
    const ax = anchor === "end" ? Math.min(cx + r, W - PAD.right - 2) : anchor === "start" ? Math.max(cx - r, PAD.left + 2) : cx;
    const x1 = anchor === "end" ? ax - width : anchor === "start" ? ax : ax - width / 2;
    const spot = [cy - r - 4, cy + r + LABEL_H]
      .map((y) => ({
        y,
        box: { x1, x2: x1 + width, y1: y - LABEL_H + 2, y2: y + 2 },
      }))
      .find(({ box }) => box.y1 >= PAD.top && box.y2 <= H - PAD.bottom && !placed.some((p) => overlaps(p, box)));
    if (!spot && product.key !== selected) continue;
    const { y, box } = spot ?? {
      y: cy - r - 4,
      box: { x1, x2: x1 + width, y1: cy - r - 14, y2: cy - r - 2 },
    };
    placed.push(box);
    labels.push({ key: product.key, text, x: ax, y, anchor });
  }
  return labels;
}

function Chart({ products, selected, onSelect }: { products: ProductStat[]; selected: string; onSelect: (key: string) => void }) {
  const plotted = products.filter((p) => p.metrics.cost > 0);
  const costs = plotted.map((p) => Math.log10(p.metrics.cost));
  const [xMin, xMax] = [Math.min(...costs), Math.max(...costs)];
  const span = xMax - xMin || 1;
  const maxRevenue = Math.max(1, ...plotted.map((p) => p.metrics.revenue));
  const averageCost = plotted.reduce((a, p) => a + p.metrics.cost, 0) / Math.max(1, plotted.length);

  const x = (cost: number) => PAD.left + MAX_R + ((Math.log10(cost) - xMin) / span) * (W - PAD.left - PAD.right - 2 * MAX_R);
  const y = (ratio: number | null) => {
    const v = ratio === null || ratio <= 0 ? -Y_LIMIT : Math.max(-Y_LIMIT, Math.min(Y_LIMIT, Math.log2(ratio)));
    return PAD.top + MIN_R + ((Y_LIMIT - v) / (2 * Y_LIMIT)) * (H - PAD.top - PAD.bottom - 2 * MIN_R);
  };
  const midY = y(1);
  const midX = x(averageCost);
  const bubbles: Bubble[] = plotted.map((p) => ({
    product: p,
    cx: x(p.metrics.cost),
    cy: y(ratioOf(p)),
    r: MIN_R + (MAX_R - MIN_R) * Math.sqrt(p.metrics.revenue / maxRevenue),
  }));
  const top = [...plotted].sort((a, b) => b.metrics.revenue - a.metrics.revenue).slice(0, LABELS);
  const labels = placeLabels(bubbles, new Set(top.map((p) => p.key)), selected);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      <rect x={midX} y={PAD.top} width={W - PAD.right - midX} height={midY - PAD.top} fill="#ecfdf5" fillOpacity="0.45" />
      <rect x={PAD.left} y={PAD.top} width={midX - PAD.left} height={midY - PAD.top} fill="#f8fafc" />
      <rect x={midX} y={midY} width={W - PAD.right - midX} height={H - PAD.bottom - midY} fill="#fff1f2" fillOpacity="0.4" />
      <rect x={PAD.left} y={midY} width={midX - PAD.left} height={H - PAD.bottom - midY} fill="#fffbeb" fillOpacity="0.35" />
      <line x1={PAD.left} x2={W - PAD.right} y1={midY} y2={midY} stroke="#d6d3d1" strokeDasharray="4 4" />
      <line x1={midX} x2={midX} y1={PAD.top} y2={H - PAD.bottom} stroke="#e7e5e4" strokeDasharray="4 4" />
      <text x={PAD.left - 6} y={midY + 4} textAnchor="end" className="fill-stone-400 text-[10px]">
        손익분기
      </text>
      {[-2, 2].map((v) => (
        <text key={v} x={PAD.left - 6} y={y(2 ** v) + 4} textAnchor="end" className="fill-stone-400 text-[10px]">
          {v > 0 ? `${2 ** v}배` : `1/${2 ** -v}`}
        </text>
      ))}
      <text x={W - PAD.right - 6} y={PAD.top + 14} textAnchor="end" className="fill-stone-400 text-[10px]">
        {QUADRANT_META.star.label}
      </text>
      <text x={PAD.left + 6} y={PAD.top + 14} className="fill-stone-400 text-[10px]">
        {QUADRANT_META.rising.label}
      </text>
      <text x={W - PAD.right - 6} y={H - PAD.bottom - 8} textAnchor="end" className="fill-stone-400 text-[10px]">
        {QUADRANT_META.leak.label}
      </text>
      <text x={PAD.left + 6} y={H - PAD.bottom - 8} className="fill-stone-400 text-[10px]">
        {QUADRANT_META.drain.label}
      </text>
      <text x={(W + PAD.left) / 2} y={H - 8} textAnchor="middle" className="fill-stone-400 text-[10px]">
        광고비 → (원 크기 = 광고 매출)
      </text>

      {[...bubbles]
        .sort((a, b) => b.r - a.r)
        .map(({ product: p, cx, cy, r }) => {
          const active = p.key === selected;
          return (
            <circle
              key={p.key}
              cx={cx}
              cy={cy}
              r={r}
              fill={QUADRANT_COLOR[p.quadrant]}
              fillOpacity={active ? 0.9 : 0.45}
              stroke={active ? "#07140f" : "white"}
              strokeWidth={active ? 2 : 1.5}
              className="cursor-pointer transition-all duration-300"
              onClick={() => onSelect(p.key)}
              onMouseEnter={() => onSelect(p.key)}
            />
          );
        })}
      {labels.map((l) => (
        <text key={l.key} x={l.x} y={l.y} textAnchor={l.anchor} className="pointer-events-none fill-stone-700 text-[10px] font-medium" stroke="white" strokeWidth={3} paintOrder="stroke">
          {l.text}
        </text>
      ))}
    </svg>
  );
}

/** 상품 사분면 지도 + 표. 행을 고르면 옵션이 펼쳐져요 */
export function ProductMatrix({ products }: { products: ProductStat[] }) {
  const [selected, setSelected] = useState(products[0]?.key ?? "");
  const current = products.find((p) => p.key === selected) ?? products[0];
  if (!current) return null;
  const count = (q: Quadrant) => products.filter((p) => p.quadrant === q).length;

  return (
    <Panel>
      <SectionHeader
        title="상품 포트폴리오"
        description="가로 광고비, 세로 손익분기 대비 ROAS. 점선 위는 남는 상품이에요."
        actions={
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
            {QUADRANTS.map((q) => (
              <span key={q} className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ background: QUADRANT_COLOR[q] }} />
                {QUADRANT_META[q].label} {count(q)}
              </span>
            ))}
          </div>
        }
      />
      <Chart products={products} selected={current.key} onSelect={setSelected} />

      <div className="mt-4">
        <DataTable minWidth="860px">
          <TableHead>
            <tr>
              <th className={th("left")}>상품</th>
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
            {products.map((p) => {
              const active = p.key === current.key;
              return (
                <Fragment key={p.key}>
                  <tr onClick={() => setSelected(p.key)} className={`cursor-pointer border-t border-stone-100 hover:bg-stone-50 ${active ? "bg-stone-50" : ""}`}>
                    <td className={`${td("max-w-64")}`}>
                      <span className="flex items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: QUADRANT_COLOR[p.quadrant] }} />
                        <span className="truncate font-medium text-stone-800" title={p.key}>
                          {p.key}
                        </span>
                        {p.lowData && <span className="shrink-0 text-[10px] text-stone-400">데이터 적음</span>}
                      </span>
                    </td>
                    <td className={`${td()} text-right tabular-nums`}>{wonShort(p.metrics.cost)}</td>
                    <td className={`${td()} text-right tabular-nums`}>{wonShort(p.metrics.revenue)}</td>
                    <td className={`${td()} text-right font-semibold tabular-nums ${p.metrics.roas !== null && p.breakEven && p.metrics.roas >= p.breakEven ? "text-emerald-600" : "text-rose-600"}`}>
                      {roasText(p.metrics.roas)}
                    </td>
                    <td className={`${td()} text-right font-semibold tabular-nums ${profitTone(p.profit) === "good" ? "text-emerald-600" : "text-rose-600"}`}>{profitText(p.profit)}</td>
                    <td className={`${td()} text-right tabular-nums`}>{num(p.metrics.orders)}</td>
                    <td className={`${td()} text-right tabular-nums`}>{rateText(p.metrics.ctr, 2)}</td>
                    <td className={`${td()} text-right tabular-nums`}>{rateText(p.metrics.cvr)}</td>
                  </tr>
                  {active && p.options.length > 1 &&
                    p.options.map((o) => (
                      <tr key={o.key} className="bg-stone-50/70">
                        <td className={`${td("max-w-64 pl-8 text-stone-500")}`}>
                          <span className="truncate" title={o.option}>
                            {o.option}
                          </span>
                        </td>
                        <td className={`${td()} text-right tabular-nums text-stone-500`}>{wonShort(o.metrics.cost)}</td>
                        <td className={`${td()} text-right tabular-nums text-stone-500`}>{wonShort(o.metrics.revenue)}</td>
                        <td className={`${td()} text-right tabular-nums ${o.breakEven && o.metrics.roas !== null ? (o.metrics.roas >= o.breakEven ? "text-emerald-600" : "text-rose-600") : "text-stone-500"}`}>
                          {roasText(o.metrics.roas)}
                        </td>
                        <td className={`${td()} text-right tabular-nums text-stone-500`}>{profitText(o.profit)}</td>
                        <td className={`${td()} text-right tabular-nums text-stone-500`}>{num(o.metrics.orders)}</td>
                        <td className={`${td()} text-right tabular-nums text-stone-500`}>{rateText(o.metrics.ctr, 2)}</td>
                        <td className={`${td()} text-right tabular-nums text-stone-500`}>{rateText(o.metrics.cvr)}</td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </DataTable>
      </div>
    </Panel>
  );
}
