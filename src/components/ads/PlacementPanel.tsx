import { PLACEMENT_META, type PlacementKind, type PlacementStat } from "@/lib/adInsights";
import { percent, wonShort } from "@/lib/format";
import { DataTable, Panel, RoasMeter, SectionHeader, TableHead, profitText, rateText, roasText, td, th } from "./parts";

export const PLACEMENT_COLOR: Record<PlacementKind, string> = {
  search: "#10b981",
  nonSearch: "#8b5cf6",
  external: "#f59e0b",
  other: "#a8a29e",
};

function ShareBar({ label, placements, pick }: { label: string; placements: PlacementStat[]; pick: (p: PlacementStat) => number }) {
  return (
    <div>
      <p className="mb-1 text-xs text-stone-500">{label}</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-stone-100">
        {placements.map((p) =>
          pick(p) > 0 ? (
            <div key={p.kind} style={{ width: `${pick(p) * 100}%`, background: PLACEMENT_COLOR[p.kind] }} title={`${PLACEMENT_META[p.kind].label} ${percent(pick(p), 0)}`} />
          ) : null,
        )}
      </div>
    </div>
  );
}

function headline(placements: PlacementStat[]) {
  const ranked = [...placements].filter((p) => p.metrics.cost > 0).sort((a, b) => (b.metrics.roas ?? 0) - (a.metrics.roas ?? 0));
  const best = ranked[0];
  const worst = ranked.at(-1);
  if (!best || !worst || best === worst || !worst.metrics.roas || !best.metrics.roas) return null;
  return `${PLACEMENT_META[best.kind].label}은 광고비 ${percent(best.costShare, 0)}로 매출 ${percent(best.revenueShare, 0)}. ${PLACEMENT_META[worst.kind].label}보다 ROAS ${(best.metrics.roas / worst.metrics.roas).toFixed(1)}배.`;
}

export function PlacementPanel({ placements }: { placements: PlacementStat[] }) {
  return (
    <Panel>
      <SectionHeader title="노출 지면" description={headline(placements) ?? undefined} />
      <div className="mb-4 space-y-2">
        <ShareBar label="광고비" placements={placements} pick={(p) => p.costShare} />
        <ShareBar label="매출" placements={placements} pick={(p) => p.revenueShare} />
      </div>
      <DataTable minWidth="680px">
        <TableHead>
          <tr>
            <th className={th("left")}>지면</th>
            <th className={th()}>광고비</th>
            <th className={th()}>매출</th>
            <th className={th()}>ROAS</th>
            <th className={th()}>남긴 돈</th>
            <th className={th()}>클릭률</th>
            <th className={th()}>전환율</th>
          </tr>
        </TableHead>
        <tbody>
          {placements.map((p) => (
            <tr key={p.kind} className="border-t border-stone-100">
              <td className={td()}>
                <span className="inline-flex items-center gap-2 font-medium text-stone-800">
                  <span className="size-2 rounded-full" style={{ background: PLACEMENT_COLOR[p.kind] }} />
                  {PLACEMENT_META[p.kind].label}
                </span>
              </td>
              <td className={`${td()} text-right tabular-nums`}>{wonShort(p.metrics.cost)}</td>
              <td className={`${td()} text-right tabular-nums`}>{wonShort(p.metrics.revenue)}</td>
              <td className={`${td()} text-right`}>
                <span className={`block font-semibold tabular-nums ${p.breakEven && p.metrics.roas !== null ? (p.metrics.roas >= p.breakEven ? "text-emerald-600" : "text-rose-600") : "text-stone-900"}`}>
                  {roasText(p.metrics.roas)}
                </span>
                <RoasMeter roas={p.metrics.roas} breakEven={p.breakEven} />
              </td>
              <td className={`${td()} text-right tabular-nums ${(p.profit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{profitText(p.profit)}</td>
              <td className={`${td()} text-right tabular-nums`}>{rateText(p.metrics.ctr, 2)}</td>
              <td className={`${td()} text-right tabular-nums`}>{rateText(p.metrics.cvr)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </Panel>
  );
}
