"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, PageHeader } from "@/components/ui";
import { SEASON_ITEMS } from "@/lib/data/season";
import { OPS_CADENCE_META, OPS_ITEMS, opsKey, periodKeyFor, type OpsCadence } from "@/lib/opsChecklist";
import { useAppStore } from "@/store/useAppStore";

export default function OpsPage() {
  const checks = useAppStore((s) => s.opsChecks);
  const toggleOpsCheck = useAppStore((s) => s.toggleOpsCheck);
  const resetOpsCadence = useAppStore((s) => s.resetOpsCadence);
  const [cadence, setCadence] = useState<OpsCadence>("daily");

  const periodKey = periodKeyFor(cadence);

  const monthNum = new Date().getMonth() + 1;
  const soonSeason = useMemo(
    () =>
      SEASON_ITEMS.filter((s) => {
        const next = ((monthNum % 12) + 1) as number;
        return s.months.includes(next) && !s.months.includes(monthNum);
      }).slice(0, 5),
    [monthNum],
  );
  const inSeasonNow = useMemo(() => SEASON_ITEMS.filter((s) => s.months.includes(monthNum)).slice(0, 6), [monthNum]);

  const items = OPS_ITEMS.filter((i) => i.cadence === cadence);
  const done = items.filter((i) => checks[opsKey(periodKey, i.id)]).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const meta = OPS_CADENCE_META[cadence];

  return (
    <>
      <PageHeader
        title="운영 체크리스트"
        description="농수산물 위탁셀러용 SOP. 매일·매주·매월 루틴으로 출고·CS·시세·시즌 준비를 빠뜨리지 않습니다."
        actions={
          <Button variant="ghost" onClick={() => resetOpsCadence(periodKey, items.map((i) => i.id))}>
            이 주기 초기화
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-stone-500">
                {meta.blurb} · <span className="font-medium text-stone-700">{meta.minutes}</span>
              </p>
              <p className="mt-1 text-2xl font-bold text-stone-900">
                {done}/{items.length} 완료 <span className="text-base font-semibold text-emerald-600">({pct}%)</span>
              </p>
            </div>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="mb-5 inline-flex rounded-2xl border border-stone-200 bg-stone-50 p-1">
            {(Object.keys(OPS_CADENCE_META) as OpsCadence[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCadence(c)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  cadence === c ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {OPS_CADENCE_META[c].label}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {items.map((item) => {
              const checked = !!checks[opsKey(periodKey, item.id)];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleOpsCheck(opsKey(periodKey, item.id))}
                    className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      checked ? "border-emerald-200 bg-emerald-50/80" : "border-stone-200 bg-white hover:border-stone-300"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border text-xs font-bold ${
                        checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-semibold ${checked ? "text-emerald-900 line-through decoration-emerald-300" : "text-stone-900"}`}>
                          {item.title}
                        </span>
                        {item.seasonSensitive && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">제철</span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">{item.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card title="이번 달 제철">
            <div className="flex flex-wrap gap-1.5">
              {inSeasonNow.map((s) => (
                <span key={s.name} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                  {s.name}
                </span>
              ))}
            </div>
            <Link href="/season" className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:underline">
              제철 캘린더 →
            </Link>
          </Card>

          <Card title="곧 시즌 오픈 (준비)">
            {soonSeason.length === 0 ? (
              <p className="text-xs text-stone-400">다음 달 신규 오픈 품목이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {soonSeason.map((s) => (
                  <li key={s.name} className="text-sm">
                    <p className="font-semibold text-stone-900">{s.name}</p>
                    <p className="text-xs text-stone-500">{s.tip}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="빠른 이동">
            <div className="flex flex-col gap-1.5 text-sm">
              <Link className="rounded-lg px-2 py-1.5 text-stone-700 hover:bg-stone-50" href="/cs">
                💬 CS 도우미
              </Link>
              <Link className="rounded-lg px-2 py-1.5 text-stone-700 hover:bg-stone-50" href="/margin">
                🧮 가격·마진
              </Link>
              <Link className="rounded-lg px-2 py-1.5 text-stone-700 hover:bg-stone-50" href="/marketing">
                📣 마케팅
              </Link>
              <Link className="rounded-lg px-2 py-1.5 text-stone-700 hover:bg-stone-50" href="/tags">
                🏷️ 검색 태그
              </Link>
              <Link className="rounded-lg px-2 py-1.5 text-stone-700 hover:bg-stone-50" href="/settings">
                ⚙️ 백업
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
