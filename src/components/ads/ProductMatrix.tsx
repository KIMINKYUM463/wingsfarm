"use client";

import { useState } from "react";
import { QUADRANT_META, type ProductStat, type Quadrant } from "@/lib/adInsights";
import { num, percent, wonShort } from "@/lib/format";
import { Metric, Panel, RoasMeter, SectionHeader, profitText, profitTone, rateText, roasText } from "./parts";

const QUADRANT_COLOR: Record<Quadrant, string> = { star: "#10b981", rising: "#0ea5e9", leak: "#f43f5e", drain: "#f59e0b" };
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
      .map((y) => ({ y, box: { x1, x2: x1 + width, y1: y - LABEL_H + 2, y2: y + 2 } }))
      .find(({ box }) => box.y1 >= PAD.top && box.y2 <= H - PAD.bottom && !placed.some((p) => overlaps(p, box)));
    if (!spot && product.key !== selected) continue;
    const { y, box } = spot ?? { y: cy - r - 4, box: { x1, x2: x1 + width, y1: cy - r - 14, y2: cy - r - 2 } };
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
      <rect x={midX} y={PAD.top} width={W - PAD.right - midX} height={midY - PAD.top} fill="#ecfdf5" />
      <rect x={PAD.left} y={PAD.top} width={midX - PAD.left} height={midY - PAD.top} fill="#f0f9ff" />
      <rect x={midX} y={midY} width={W - PAD.right - midX} height={H - PAD.bottom - midY} fill="#fff1f2" />
      <rect x={PAD.left} y={midY} width={midX - PAD.left} height={H - PAD.bottom - midY} fill="#fffbeb" />
      <line x1={PAD.left} x2={W - PAD.right} y1={midY} y2={midY} stroke="#f59e0b" strokeDasharray="4 4" />
      <line x1={midX} x2={midX} y1={PAD.top} y2={H - PAD.bottom} stroke="#d6d3d1" strokeDasharray="4 4" />
      <text x={PAD.left - 6} y={midY + 4} textAnchor="end" className="fill-amber-600 text-[10px] font-semibold">
        손익분기
      </text>
      {[-2, 2].map((v) => (
        <text key={v} x={PAD.left - 6} y={y(2 ** v) + 4} textAnchor="end" className="fill-stone-400 text-[10px]">
          {v > 0 ? `${2 ** v}배` : `1/${2 ** -v}`}
        </text>
      ))}
      <text x={W - PAD.right - 6} y={PAD.top + 14} textAnchor="end" className="fill-emerald-700 text-[11px] font-semibold">
        {QUADRANT_META.star.label}
      </text>
      <text x={PAD.left + 6} y={PAD.top + 14} className="fill-sky-700 text-[11px] font-semibold">
        {QUADRANT_META.rising.label}
      </text>
      <text x={W - PAD.right - 6} y={H - PAD.bottom - 8} textAnchor="end" className="fill-rose-700 text-[11px] font-semibold">
        {QUADRANT_META.leak.label}
      </text>
      <text x={PAD.left + 6} y={H - PAD.bottom - 8} className="fill-amber-700 text-[11px] font-semibold">
        {QUADRANT_META.drain.label}
      </text>
      <text x={(W + PAD.left) / 2} y={H - 8} textAnchor="middle" className="fill-stone-400 text-[10px]">
        광고비 → 많이 씀 (원 크기 = 광고 매출)
      </text>

      {[...bubbles].sort((a, b) => b.r - a.r).map(({ product: p, cx, cy, r }) => {
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

function Detail({ product }: { product: ProductStat }) {
  const meta = QUADRANT_META[product.quadrant];
  const maxCost = Math.max(1, ...product.options.map((o) => o.metrics.cost));
  return (
    <div className="flex h-full flex-col rounded-2xl border border-stone-200/80 p-5">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: QUADRANT_COLOR[product.quadrant] }}>
        {meta.label}
        {product.lowData && <span className="font-normal opacity-80">· 데이터 적음</span>}
      </span>
      <p className="mt-2 font-semibold leading-snug text-stone-900">{product.key}</p>
      <p className="mt-1 text-xs text-stone-500">{meta.hint}</p>
      <div className="mt-4 flex items-end justify-between">
        <p className={`text-3xl font-bold tabular-nums ${ratioOf(product) !== null && ratioOf(product)! >= 1 ? "text-emerald-600" : "text-rose-600"}`}>{roasText(product.metrics.roas)}</p>
        <p className="pb-1 text-xs text-stone-400">손익분기 {roasText(product.breakEven)}</p>
      </div>
      <div className="mt-2">
        <RoasMeter roas={product.metrics.roas} breakEven={product.breakEven} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="광고비" value={wonShort(product.metrics.cost)} hint={`전체의 ${percent(product.costShare, 0)}`} />
        <Metric label="매출" value={wonShort(product.metrics.revenue)} hint={`전체의 ${percent(product.revenueShare, 0)}`} />
        <Metric label="남긴 돈" value={profitText(product.profit)} tone={profitTone(product.profit)} />
        <Metric label="주문" value={`${num(product.metrics.orders)}건`} />
        <Metric label="클릭률" value={rateText(product.metrics.ctr, 2)} />
        <Metric label="전환율" value={rateText(product.metrics.cvr)} />
      </div>
      <p className="mt-5 text-xs font-semibold text-stone-500">옵션별 ({product.options.length})</p>
      <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
        {product.options.map((o) => (
          <li key={o.key}>
            <div className="flex justify-between gap-2 text-xs">
              <span className="truncate text-stone-700" title={o.option}>
                {o.option}
              </span>
              <span className={`shrink-0 font-semibold tabular-nums ${o.breakEven && o.metrics.roas !== null ? (o.metrics.roas >= o.breakEven ? "text-emerald-600" : "text-rose-600") : "text-stone-500"}`}>
                {roasText(o.metrics.roas)}
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-stone-400" style={{ width: `${(o.metrics.cost / maxCost) * 100}%` }} />
            </div>
            <p className="mt-0.5 text-[11px] text-stone-400">
              광고비 {wonShort(o.metrics.cost)} · 매출 {wonShort(o.metrics.revenue)} · 주문 {num(o.metrics.orders)}건
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 상품 사분면 지도 + 선택 상품 상세 + 사분면별 목록 */
export function ProductMatrix({ products }: { products: ProductStat[] }) {
  const [selected, setSelected] = useState(products[0]?.key ?? "");
  const current = products.find((p) => p.key === selected) ?? products[0];
  if (!current) return null;
  const count = (q: Quadrant) => products.filter((p) => p.quadrant === q).length;

  return (
    <Panel>
      <SectionHeader
        eyebrow="Product Portfolio"
        title="상품별로 남는 광고, 새는 광고"
        description="가로는 광고비, 세로는 손익분기 대비 ROAS예요. 노란 점선 위는 광고비를 빼고도 남는 상품이에요. 원을 누르면 옵션별 성과가 보여요."
        actions={
          <div className="flex flex-wrap gap-1.5">
            {QUADRANTS.map((q) => (
              <span key={q} className="inline-flex items-center gap-1.5 rounded-full bg-stone-50 px-2.5 py-1 text-xs text-stone-600 ring-1 ring-stone-200">
                <span className="size-2 rounded-full" style={{ background: QUADRANT_COLOR[q] }} />
                {QUADRANT_META[q].label} {count(q)}
              </span>
            ))}
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-stone-100 p-2">
          <Chart products={products} selected={current.key} onSelect={setSelected} />
        </div>
        <Detail product={current} />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
              <th className="py-2 font-medium">상품</th>
              <th className="py-2 text-right font-medium">광고비</th>
              <th className="py-2 text-right font-medium">매출</th>
              <th className="w-44 py-2 pl-6 font-medium">ROAS / 손익분기</th>
              <th className="py-2 text-right font-medium">남긴 돈</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr
                key={p.key}
                onClick={() => setSelected(p.key)}
                className={`cursor-pointer border-b border-stone-100 transition hover:bg-stone-50 ${p.key === current.key ? "bg-emerald-50/50" : ""}`}
              >
                <td className="max-w-80 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: QUADRANT_COLOR[p.quadrant] }} />
                    <span className="truncate font-medium text-stone-800" title={p.key}>
                      {p.key}
                    </span>
                    {p.lowData && <span className="shrink-0 text-[10px] text-stone-400">데이터 적음</span>}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums">{wonShort(p.metrics.cost)}</td>
                <td className="py-2.5 text-right tabular-nums">{wonShort(p.metrics.revenue)}</td>
                <td className="py-2.5 pl-6">
                  <span className="mb-1 block text-xs tabular-nums text-stone-600">
                    {roasText(p.metrics.roas)} <span className="text-stone-400">/ {roasText(p.breakEven)}</span>
                  </span>
                  <RoasMeter roas={p.metrics.roas} breakEven={p.breakEven} />
                </td>
                <td className={`py-2.5 text-right font-semibold tabular-nums ${profitTone(p.profit) === "good" ? "text-emerald-600" : "text-rose-600"}`}>{profitText(p.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
