import { FOLLOWUP_META, samePeriod, snapshotDaily, type AdFollowup, type AdReportSnapshot, type DailyStats, type FollowupResult, type FollowupVerdict } from "@/lib/adFollowup";
import type { ReportPeriod } from "@/lib/adInsights";
import { won, wonShort } from "@/lib/format";
import { Panel, SectionHeader, dotted, profitText, roasText } from "./parts";

export interface FollowupView {
  followup: AdFollowup;
  result: FollowupResult;
}

interface Props {
  views: FollowupView[];
  reports: AdReportSnapshot[];
  period: ReportPeriod | null;
  costMultiplier: number;
  onRemove: (id: string) => void;
  onRemoveReport: (period: ReportPeriod) => void;
}

const VERDICT_STYLE: Record<FollowupVerdict, { label: string; chip: string; text: string; ring: string }> = {
  better: { label: "효과 있음", chip: "bg-emerald-500 text-white", text: "text-emerald-600", ring: "ring-emerald-200" },
  flat: { label: "변화 없음", chip: "bg-stone-200 text-stone-700", text: "text-stone-700", ring: "ring-stone-200" },
  worse: { label: "역효과", chip: "bg-rose-500 text-white", text: "text-rose-600", ring: "ring-rose-200" },
};

const signedWon = (value: number) => `${value >= 0 ? "+" : "−"}${won(Math.abs(value))}`;
const monthly = (perDay: number) => perDay * 30;

/** 지표별로 "늘면 좋은지(up)·줄면 좋은지(down)" — null이면 방향을 따지지 않는다 */
type Direction = "up" | "down" | null;

interface Row {
  id: "cost" | "revenue" | "roas" | "profit";
  label: string;
  value: (d: DailyStats) => number | null;
  format: (v: number | null) => string;
  delta: (before: number, after: number) => string;
  direction: Direction;
}

const rowsFor = (f: AdFollowup): Row[] => {
  const growing = FOLLOWUP_META[f.kind].focus === "revenue";
  return [
    { id: "cost", label: "광고비", value: (d) => d.cost, format: (v) => (v === null ? "-" : won(v)), delta: (a, b) => signedWon(b - a), direction: growing ? null : "down" },
    { id: "revenue", label: "광고 매출", value: (d) => d.revenue, format: (v) => (v === null ? "-" : won(v)), delta: (a, b) => signedWon(b - a), direction: "up" },
    { id: "roas", label: "ROAS", value: (d) => d.roas, format: roasText, delta: (a, b) => `${b >= a ? "+" : "−"}${Math.round(Math.abs(b - a))}%p`, direction: "up" },
    { id: "profit", label: "남긴 돈", value: (d) => d.profit, format: (v) => (v === null ? "-" : signedWon(v)), delta: (a, b) => signedWon(b - a), direction: "up" },
  ];
};

const deltaTone = (direction: Direction, before: number, after: number) => {
  if (!direction || before === after) return "text-stone-400";
  return (after > before) === (direction === "up") ? "text-emerald-600" : "text-rose-600";
};

/** 지난 조치의 전후 비교 + 보고서별 추이 */
export function FollowupPanel({ views, reports, period, costMultiplier, onRemove, onRemoveReport }: Props) {
  const evaluated = views.filter((v) => v.result.profitDelta !== null);
  const total = evaluated.reduce((acc, v) => acc + (v.result.profitDelta ?? 0), 0);
  const count = (verdict: FollowupVerdict) => evaluated.filter((v) => v.result.verdict === verdict).length;
  const ordered = [...views].sort((a, b) => Number(a.result.after === null) - Number(b.result.after === null));

  return (
    <Panel>
      <SectionHeader
        eyebrow="Follow-up"
        title="지난 조치, 효과 있었나요?"
        description="'실행했어요'로 기록한 조치를 같은 키워드·상품끼리 하루 평균으로 비교해요. 보고서마다 기간이 달라도 공정하게 비교되고, 손익분기·부가세는 기록 당시 값을 그대로 써요."
      />

      {evaluated.length > 0 && (
        <div className="relative mb-5 overflow-hidden rounded-2xl bg-[#07140f] p-6 text-white">
          <div className="pointer-events-none absolute -right-16 -top-20 size-64 animate-float rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-amber-300/80">Result</p>
              <p className="mt-2 text-sm text-white/60">기록한 조치 {evaluated.length}개로 광고에서 남긴 돈이</p>
              <p className={`mt-1 text-4xl font-black tracking-tight tabular-nums md:text-5xl ${total >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                월 {profitText(monthly(total))}
              </p>
              <p className="mt-1 text-xs text-white/40">하루 {signedWon(total)} × 30일 (추정)</p>
            </div>
            <div className="flex gap-2">
              {(["better", "flat", "worse"] as const).map((verdict) => (
                <div key={verdict} className="min-w-20 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center backdrop-blur">
                  <p className="text-2xl font-bold tabular-nums">{count(verdict)}</p>
                  <p className="text-[11px] text-white/50">{VERDICT_STYLE[verdict].label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {views.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {ordered.map((v) => (
            <FollowupCard key={v.followup.id} {...v} onRemove={onRemove} />
          ))}
        </div>
      )}

      {reports.length >= 2 && <ReportTrend reports={reports} period={period} costMultiplier={costMultiplier} onRemove={onRemoveReport} />}
    </Panel>
  );
}

function FollowupCard({ followup: f, result: r, onRemove }: FollowupView & { onRemove: (id: string) => void }) {
  const meta = FOLLOWUP_META[f.kind];
  const style = r.verdict ? VERDICT_STYLE[r.verdict] : null;
  const unit = meta.scope === "keyword" ? "키워드" : "상품";

  return (
    <article className={`rounded-2xl bg-white p-5 ring-1 ${style?.ring ?? "ring-stone-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-stone-900">{meta.label}</h3>
            {style ? (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${style.chip}`}>{style.label}</span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{r.status === "unsupported" ? "비교 불가" : "결과 대기"}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-stone-400">
            {dotted(f.doneAt)} 실행 · 기준 {dotted(f.baseline.from)}–{dotted(f.baseline.to)} · {unit} {f.items.length}개
          </p>
        </div>
        <button type="button" onClick={() => onRemove(f.id)} className="shrink-0 rounded-full px-2 py-1 text-xs text-stone-400 transition hover:bg-stone-100 hover:text-stone-600">
          기록 삭제
        </button>
      </div>

      {r.after && r.profitDelta !== null ? (
        <>
          <div className="mt-4 flex items-baseline justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3">
            <span className="text-xs text-stone-500">하루 남긴 돈 변화</span>
            <span className="text-right">
              <span className={`text-xl font-bold tabular-nums ${style?.text ?? ""}`}>{signedWon(r.profitDelta)}</span>
              <span className="ml-2 text-xs tabular-nums text-stone-400">월 {profitText(monthly(r.profitDelta))}</span>
            </span>
          </div>
          <CompareTable followup={f} before={r.before} after={r.after} />
          <p className="mt-3 text-xs leading-relaxed text-stone-500">{matchedNote(f, r)}</p>
          {r.status === "partial" && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              조치 전 날짜가 섞인 보고서라 효과가 덜 보일 수 있어요. {dotted(f.doneAt)} 이후 기간으로 받은 보고서를 올리면 더 정확해요.
            </p>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-stone-300 px-4 py-4 text-sm">
          <p className="font-medium text-stone-700">목표: {meta.goal}</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">
            {r.status === "unsupported"
              ? `이 보고서엔 ${unit} 정보가 없어 비교할 수 없어요. ${unit} 단위까지 펼친 보고서를 올려 주세요.`
              : `${dotted(f.doneAt)} 이후 기간의 보고서를 올리면 전후를 비교해 드려요.`}
          </p>
          <p className="mt-3 text-xs tabular-nums text-stone-400">
            기준 하루 광고비 {won(r.before.cost)} · 매출 {won(r.before.revenue)} · 남긴 돈 {r.before.profit === null ? "-" : signedWon(r.before.profit)}
          </p>
        </div>
      )}
    </article>
  );
}

function matchedNote(f: AdFollowup, r: FollowupResult) {
  const unit = FOLLOWUP_META[f.kind].scope === "keyword" ? "키워드" : "상품";
  if (f.kind === "exclude")
    return r.matched === 0 ? "대상 키워드가 새 보고서에서 모두 사라졌어요 — 제외 키워드가 잘 적용됐어요." : `대상 ${f.items.length}개 중 ${r.matched}개가 아직 광고되고 있어요. 제외 키워드 등록이 빠진 캠페인이 없는지 확인해 보세요.`;
  return r.matched < f.items.length ? `대상 ${unit} ${f.items.length}개 중 ${r.matched}개가 새 보고서에 나왔어요. 나오지 않은 ${unit}은 광고비·매출 0으로 계산했어요.` : `대상 ${unit} ${f.items.length}개 모두 새 보고서에서 비교했어요.`;
}

function CompareTable({ followup, before, after }: { followup: AdFollowup; before: DailyStats; after: DailyStats }) {
  const focus = FOLLOWUP_META[followup.kind].focus;
  return (
    <div className="mt-3 divide-y divide-stone-100 text-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 pb-1.5 text-[11px] text-stone-400">
        <span>하루 평균</span>
        <span className="w-20 text-right">조치 전</span>
        <span className="w-20 text-right">조치 후</span>
        <span className="w-20 text-right">변화</span>
      </div>
      {rowsFor(followup).map((row) => {
        const a = row.value(before);
        const b = row.value(after);
        return (
          <div
            key={row.id}
            className={`grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 py-1.5 ${row.id === focus ? "-mx-2 rounded-lg bg-amber-50/70 px-2" : ""}`}
            title={row.id === focus ? "이 조치에서 가장 먼저 볼 지표" : undefined}
          >
            <span className={`truncate ${row.id === focus ? "font-semibold text-amber-800" : "text-stone-600"}`}>{row.label}</span>
            <span className="w-20 text-right tabular-nums text-stone-400">{row.format(a)}</span>
            <span className="w-20 text-right font-semibold tabular-nums text-stone-900">{row.format(b)}</span>
            <span className={`w-20 text-right text-xs font-semibold tabular-nums ${a === null || b === null ? "text-stone-300" : deltaTone(row.direction, a, b)}`}>
              {a === null || b === null ? "-" : row.delta(a, b)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 보고서를 올릴 때마다 쌓이는 하루 평균 추이 */
function ReportTrend({ reports, period, costMultiplier, onRemove }: { reports: AdReportSnapshot[]; period: ReportPeriod | null; costMultiplier: number; onRemove: (period: ReportPeriod) => void }) {
  const days = reports.map((s) => ({ s, d: snapshotDaily(s, costMultiplier) }));
  const maxProfit = Math.max(1, ...days.map(({ d }) => Math.abs(d.profit ?? 0)));

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-stone-900">보고서별 추이</h3>
      <p className="mt-0.5 text-xs text-stone-400">올린 보고서마다 하루 평균으로 맞춰 쌓아요. 기간이 겹치는 보고서끼리는 같은 날이 두 번 들어갈 수 있어요.</p>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-stone-200">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-stone-50 text-xs text-stone-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">보고서 기간</th>
              <th className="px-3 py-2 text-right font-medium">하루 광고비</th>
              <th className="px-3 py-2 text-right font-medium">하루 매출</th>
              <th className="px-3 py-2 text-right font-medium">ROAS</th>
              <th className="px-3 py-2 text-right font-medium">하루 남긴 돈</th>
              <th className="w-40 px-3 py-2 font-medium" />
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {days.map(({ s, d }, i) => {
              const prev = days[i - 1]?.d;
              const current = period !== null && samePeriod(s, period);
              const profit = d.profit ?? 0;
              return (
                <tr key={`${s.from}_${s.to}`} className={`border-t border-stone-100 ${current ? "bg-amber-50/50" : ""}`}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-stone-800">
                      {dotted(s.from)}–{dotted(s.to).slice(5)}
                    </span>
                    <span className="ml-1.5 text-xs text-stone-400">{s.days}일</span>
                    {current && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">이번 보고서</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {wonShort(d.cost)}
                    <Trend prev={prev?.cost} value={d.cost} direction={null} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {wonShort(d.revenue)}
                    <Trend prev={prev?.revenue} value={d.revenue} direction="up" />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {roasText(d.roas)}
                    <Trend prev={prev?.roas ?? undefined} value={d.roas} direction="up" />
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {profitText(d.profit)}
                    <Trend prev={prev?.profit ?? undefined} value={d.profit} direction="up" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="relative h-2 rounded-full bg-stone-100">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-stone-300" />
                      <div
                        className={`absolute inset-y-0 rounded-full ${profit >= 0 ? "left-1/2 bg-emerald-400" : "right-1/2 bg-rose-400"}`}
                        style={{ width: `${(Math.abs(profit) / maxProfit) * 50}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!current && (
                      <button type="button" onClick={() => onRemove(s)} className="text-xs text-stone-300 transition hover:text-stone-600" aria-label={`${dotted(s.from)} 보고서 기록 삭제`}>
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Trend({ prev, value, direction }: { prev: number | undefined; value: number | null; direction: Direction }) {
  if (prev === undefined || value === null || prev === value) return null;
  return <span className={`ml-1 text-[10px] ${deltaTone(direction, prev, value)}`}>{value > prev ? "▲" : "▼"}</span>;
}
