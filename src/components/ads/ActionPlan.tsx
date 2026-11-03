"use client";

import { useState } from "react";
import { CopyButton } from "@/components/ui";
import { isFollowupKind, type AdFollowup } from "@/lib/adFollowup";
import { perMonth, type AdAction, type ReportPeriod } from "@/lib/adInsights";
import { wonShort } from "@/lib/format";
import { Panel, SectionHeader, TONE_TEXT, Tag, dotted } from "./parts";

const TONE_STYLE = {
  loss: { bar: "before:bg-rose-400", label: "손실 막기" },
  warn: { bar: "before:bg-amber-400", label: "줄이기" },
  good: { bar: "before:bg-emerald-400", label: "키우기" },
  info: { bar: "before:bg-sky-400", label: "개선 아이디어" },
} as const;

interface Props {
  actions: AdAction[];
  period: ReportPeriod | null;
  /** 이 보고서를 기준으로 이미 기록한 조치 */
  recorded: AdFollowup[];
  onRecord: (action: AdAction) => void;
  onUndo: (id: string) => void;
}

/** 우선순위대로 정리한 실행 계획 — 접으면 한 줄, 펼치면 대상·추적 */
export function ActionPlan({ actions, period, recorded, onRecord, onUndo }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Panel>
      <SectionHeader title="지금 바로 할 일" description="손실 막기 → 줄이기 → 키우기. 금액은 보고서 기간 기준이에요." />
      {!actions.length ? (
        <p className="py-6 text-center text-sm text-stone-500">눈에 띄게 새는 곳이 없어요. 데이터가 더 쌓이면 다시 올려 보세요.</p>
      ) : (
        <ol className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200">
          {actions.map((action, i) => {
            const style = TONE_STYLE[action.tone];
            const expanded = open === action.id;
            const monthly = action.impact === null ? null : perMonth(action.impact, period);
            const trackable = Boolean(period && isFollowupKind(action.id) && action.targets?.length);
            const done = recorded.find((f) => f.kind === action.id);
            return (
              <li key={action.id} className={`relative bg-white before:absolute before:inset-y-0 before:left-0 before:w-0.5 ${style.bar}`}>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : action.id)}
                  className="flex w-full items-center gap-3 py-2.5 pr-3 pl-4 text-left hover:bg-stone-50/80"
                  aria-expanded={expanded}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold tabular-nums ${done ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-500"}`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Tag tone={action.tone}>{style.label}</Tag>
                      {done && <Tag tone="good">추적 중</Tag>}
                      <span className="truncate font-medium text-stone-900">{action.title}</span>
                    </span>
                  </span>
                  {action.impact !== null && action.impact > 0 && (
                    <span className="shrink-0 text-right">
                      <span className={`block text-sm font-semibold tabular-nums ${TONE_TEXT[action.tone]}`}>{wonShort(action.impact)}</span>
                      <span className="block text-[10px] text-stone-400">
                        {action.impactLabel}
                        {monthly !== null ? ` · 월 ${wonShort(monthly)}` : ""}
                      </span>
                    </span>
                  )}
                </button>
                {expanded && (
                  <div className="space-y-2.5 px-4 pb-3 pl-12">
                    <p className="text-[13px] leading-relaxed text-stone-500">{action.detail}</p>
                    {action.items && (
                      <ul className="grid gap-0.5 text-[13px] text-stone-600 md:grid-cols-2">
                        {action.items.map((item) => (
                          <li key={item} className="truncate" title={item}>
                            · {item}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(action.copy || trackable) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {action.copy && <CopyButton text={action.copy.text} label={action.copy.label} />}
                        {trackable &&
                          (done ? (
                            <>
                              <span className="text-xs text-stone-400">
                                {dotted(done.doneAt)} 실행 · {done.items.length}개 — 이후 기간 보고서를 올리면 비교해요
                              </span>
                              <button type="button" onClick={() => onUndo(done.id)} className="text-xs text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline">
                                기록 취소
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onRecord(action)}
                              className="inline-flex items-center rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-700"
                            >
                              실행했어요 · 효과 추적
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
