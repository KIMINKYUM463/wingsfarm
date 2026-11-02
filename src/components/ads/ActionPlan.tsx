"use client";

import { useState } from "react";
import { CopyButton } from "@/components/ui";
import { perMonth, type AdAction, type ReportPeriod } from "@/lib/adInsights";
import { wonShort } from "@/lib/format";
import { Panel, SectionHeader, TONE_DOT } from "./parts";

const TONE_STYLE = {
  loss: { ring: "ring-rose-100", badge: "bg-rose-50 text-rose-700", label: "손실 막기", amount: "text-rose-600" },
  warn: { ring: "ring-amber-100", badge: "bg-amber-50 text-amber-700", label: "줄이기", amount: "text-amber-600" },
  good: { ring: "ring-emerald-100", badge: "bg-emerald-50 text-emerald-700", label: "키우기", amount: "text-emerald-600" },
  info: { ring: "ring-sky-100", badge: "bg-sky-50 text-sky-700", label: "개선 아이디어", amount: "text-sky-600" },
} as const;

/** 우선순위대로 정리한 실행 계획 — 각 항목에 아끼는 돈·지키는 이익을 붙인다 */
export function ActionPlan({ actions, period }: { actions: AdAction[]; period: ReportPeriod | null }) {
  const [open, setOpen] = useState<string | null>(actions[0]?.id ?? null);

  return (
    <Panel>
      <SectionHeader
        eyebrow="Action Plan"
        title="지금 바로 할 일"
        description="손실을 막는 일 → 줄이는 일 → 키우는 일 순서예요. 금액은 보고서 기간 기준이고, 괄호는 한 달로 환산한 값이에요."
      />
      {!actions.length ? (
        <p className="rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-800">눈에 띄게 새는 곳이 없어요. 데이터가 더 쌓이면 다시 올려 보세요.</p>
      ) : (
        <ol className="space-y-3">
          {actions.map((action, i) => {
            const style = TONE_STYLE[action.tone];
            const expanded = open === action.id;
            const monthly = action.impact === null ? null : perMonth(action.impact, period);
            return (
              <li key={action.id} className={`rounded-2xl bg-stone-50/60 ring-1 transition hover:bg-white hover:shadow-sm ${style.ring}`}>
                <button type="button" onClick={() => setOpen(expanded ? null : action.id)} className="flex w-full items-start gap-4 p-4 text-left" aria-expanded={expanded}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#07140f] text-sm font-bold text-amber-200">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`mr-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>
                      <span className={`size-1.5 rounded-full ${TONE_DOT[action.tone]}`} />
                      {style.label}
                    </span>
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
                {expanded && (action.items?.length || action.copy) && (
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
                    {action.copy && (
                      <div className="mt-3">
                        <CopyButton text={action.copy.text} label={action.copy.label} />
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
