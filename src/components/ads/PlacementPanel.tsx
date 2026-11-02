import { PLACEMENT_META, type PlacementKind, type PlacementStat } from "@/lib/adInsights";
import { percent, won, wonShort } from "@/lib/format";
import { Metric, Panel, RoasMeter, SectionHeader, profitText, profitTone, rateText, roasText } from "./parts";

export const PLACEMENT_COLOR: Record<PlacementKind, string> = { search: "#10b981", nonSearch: "#8b5cf6", external: "#f59e0b", other: "#a8a29e" };

function ShareBar({ label, placements, pick }: { label: string; placements: PlacementStat[]; pick: (p: PlacementStat) => number }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-stone-500">{label}</p>
      <div className="flex h-7 overflow-hidden rounded-lg bg-stone-100">
        {placements.map((p) =>
          pick(p) > 0 ? (
            <div
              key={p.kind}
              className="flex items-center justify-center text-[11px] font-semibold text-white transition-[width] duration-700"
              style={{ width: `${pick(p) * 100}%`, background: PLACEMENT_COLOR[p.kind] }}
              title={`${PLACEMENT_META[p.kind].label} ${percent(pick(p), 0)}`}
            >
              {pick(p) >= 0.08 && percent(pick(p), 0)}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** 한 줄 요약: 광고비 비중보다 매출 비중이 큰 지면 vs 작은 지면 */
function headline(placements: PlacementStat[]) {
  const ranked = [...placements].filter((p) => p.metrics.cost > 0).sort((a, b) => (b.metrics.roas ?? 0) - (a.metrics.roas ?? 0));
  const best = ranked[0];
  const worst = ranked.at(-1);
  if (!best || !worst || best === worst || !worst.metrics.roas || !best.metrics.roas) return null;
  return `${PLACEMENT_META[best.kind].label}은 광고비의 ${percent(best.costShare, 0)}로 매출의 ${percent(best.revenueShare, 0)}를 만들어요. ${PLACEMENT_META[worst.kind].label}보다 ROAS가 ${(best.metrics.roas / worst.metrics.roas).toFixed(1)}배 높아요.`;
}

export function PlacementPanel({ placements }: { placements: PlacementStat[] }) {
  const summary = headline(placements);
  return (
    <Panel>
      <SectionHeader eyebrow="Placement" title="어디에 노출될 때 팔리나" description={summary ?? "광고가 노출된 지면별 성과예요."} />
      <div className="space-y-3">
        <ShareBar label="광고비 비중" placements={placements} pick={(p) => p.costShare} />
        <ShareBar label="광고 매출 비중" placements={placements} pick={(p) => p.revenueShare} />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {placements.map((p) => (
          <div key={p.kind} className="rounded-2xl border border-stone-200/80 p-4">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: PLACEMENT_COLOR[p.kind] }} />
              <p className="font-semibold text-stone-900">{PLACEMENT_META[p.kind].label}</p>
            </div>
            <p className="mt-1 min-h-8 text-[11px] leading-snug text-stone-400">{PLACEMENT_META[p.kind].hint}</p>
            <p className={`mt-3 text-2xl font-bold tabular-nums ${p.breakEven && p.metrics.roas !== null ? (p.metrics.roas >= p.breakEven ? "text-emerald-600" : "text-rose-600") : "text-stone-900"}`}>
              {roasText(p.metrics.roas)}
            </p>
            <div className="mt-2">
              <RoasMeter roas={p.metrics.roas} breakEven={p.breakEven} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Metric label="광고비" value={wonShort(p.metrics.cost)} />
              <Metric label="매출" value={wonShort(p.metrics.revenue)} />
              <Metric label="남긴 돈" value={profitText(p.profit)} tone={profitTone(p.profit)} />
              <Metric label="클릭률" value={rateText(p.metrics.ctr, 2)} />
              <Metric label="클릭당" value={p.metrics.cpc === null ? "-" : won(p.metrics.cpc)} />
              <Metric label="전환율" value={rateText(p.metrics.cvr)} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
