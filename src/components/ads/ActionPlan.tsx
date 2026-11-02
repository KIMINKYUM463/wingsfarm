"use client";

import { useState } from "react";
import { CopyButton } from "@/components/ui";
import { isFollowupKind, type AdFollowup } from "@/lib/adFollowup";
import { perMonth, type AdAction, type ReportPeriod } from "@/lib/adInsights";
import { wonShort } from "@/lib/format";
import { Panel, SectionHeader, TONE_DOT, dotted } from "./parts";

const TONE_STYLE = {
  loss: { ring: "ring-rose-100", badge: "bg-rose-50 text-rose-700", label: "손실 막기", amount: "text-rose-600" },
  warn: { ring: "ring-amber-100", badge: "bg-amber-50 text-amber-700", label: "줄이기", amount: "text-amber-600" },
  good: { ring: "ring-emerald-100", badge: "bg-emerald-50 text-emerald-700", label: "키우기", amount: "text-emerald-600" },
  info: { ring: "ring-sky-100", badge: "bg-sky-50 text-sky-700", label: "개선 아이디어", amount: "text-sky-600" },
} as const;

interface Props {
  actions: AdAction[];
  period: ReportPeriod | null;
  /** 이 보고서를 기준으로 이미 기록한 조치 */
  recorded: AdFollowup[];
  onRecord: (action: AdAction) => void;
  onUndo: (id: string) => void;
}

/** 우선순위대로 정리한 실행 계획 — 각 항목에 아끼는 돈·지키는 이익을 붙이고, 실행하면 효과를 추적한다 */
export function ActionPlan({ actions, period, recorded, onRecord, onUndo }: Props) {
  const [open, setOpen] = useState<string | null>(actions[0]?.id ?? null);

  return (
    <Panel>
      <SectionHeader
        eyebrow="Action Plan"
        title="지금 바로 할 일"
        description="손실을 막는 일 → 줄이는 일 → 키우는 일 순서예요. 금액은 보고서 기간 기준이고, 괄호는 한 달로 환산한 값이에요. 실행한 뒤 '실행했어요'를 누르면 다음 보고서에서 효과를 비교해 드려요."
      />
      {!actions.length ? (
        <p className="rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-800">눈에 띄게 새는 곳이 없어요. 데이터가 더 쌓이면 다시 올려 보세요.</p>
      ) : (
        <ol className="space-y-3">
          {actions.map((action, i) => {
            const style = TONE_STYLE[action.tone];
            const expanded = open === action.id;
            const monthly = action.impact === null ? null : perMonth(action.impact, period);
            const trackable = Boolean(period && isFollowupKind(action.id) && action.targets?.length);
            const done = recorded.find((f) => f.kind === action.id);
            return (
              <li key={action.id} className={`rounded-2xl bg-stone-50/60 ring-1 transition hover:bg-white hover:shadow-sm ${style.ring}`}>
                <button type="button" onClick={() => setOpen(expanded ? null : action.id)} className="flex w-full items-start gap-4 p-4 text-left" aria-expanded={expanded}>
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-emerald-500 text-white" : "bg-[#07140f] text-amber-200"}`}>{done ? "✓" : i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`mr-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>
                      <span className={`size-1.5 rounded-full ${TONE_DOT[action.tone]}`} />
                      {style.label}
                    </span>
                    {done && <span className="mr-2 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">효과 추적 중</span>}
                    <span className="font-semibold text-stone-900">{action.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-stone-500">{action.detail}</span>
                  </span>
                  {action.impact !== null && action.impact > 0 && (
                    <span className="shrink-0 text-right">
                      <span className="block text-[11px] text-stone-400">{action.impactLabel}</span>
                      <span className={`block text-lg font-bold tabular-nums ${style.amount}`}>{wonShort(action.impact)}</span>
                      {monthly !== null && <span className="block text-[11px] tabular-nums text-stone-400">(월 {wonShort(monthly)})</span>}
                    </span>
                  )}
                </button>
                {expanded && (action.items?.length || action.copy || trackable) && (
                  <div className="border-t border-stone-200/70 px-4 py-3 pl-16">
                    {action.items && (
                      <ul className="grid gap-1 text-sm text-stone-600 md:grid-cols-2">
                        {action.items.map((item) => (
                          <li key={item} className="truncate" title={item}>
                            · {item}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(action.copy || trackable) && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {action.copy && <CopyButton text={action.copy.text} label={action.copy.label} />}
                        {trackable &&
                          (done ? (
                            <>
                              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                                {dotted(done.doneAt)} 실행 · 대상 {done.items.length}개 — 이후 기간 보고서를 올리면 비교해요
                              </span>
                              <button type="button" onClick={() => onUndo(done.id)} className="text-xs text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline">
                                기록 취소
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onRecord(action)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#07140f] px-3.5 py-1.5 text-xs font-semibold text-amber-200 shadow-sm transition hover:bg-[#0d2219]"
                            >
                              <span className="size-1.5 rounded-full bg-amber-300" />
                              실행했어요 · 효과 추적 시작
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
