"use client";

import Link from "next/link";
import { useState } from "react";
import type { SourcingCandidate } from "@/types";
import { Badge, Button, Card, EmptyState, Modal, PageHeader } from "@/components/ui";
import { SourcingForm, emptyCandidate } from "@/components/sourcing/SourcingForm";
import { SEASON_ITEMS } from "@/lib/data/season";
import { num, percent, won } from "@/lib/format";
import { SCORE_LABEL, SCORE_WEIGHTS, evaluateCandidate, verdictOf, type ScoreKey } from "@/lib/sourcing";
import { useAppStore } from "@/store/useAppStore";

const KEYS = Object.keys(SCORE_WEIGHTS) as ScoreKey[];

export default function SourcingPage() {
  const { sourcing, channels, costs, removeSourcing } = useAppStore();
  const [editing, setEditing] = useState<SourcingCandidate | null>(null);
  const [today] = useState(() => new Date());

  const evals = sourcing
    .map((c) => evaluateCandidate(c, channels.find((ch) => ch.id === c.channelId), costs, SEASON_ITEMS, today))
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <PageHeader
        title="소싱 평가표"
        description="후보 품목을 마진·시즌·검색 수요·경쟁·파손 위험·공급 안정성으로 점수 매겨 비교해요. 감이 아니라 숫자로 첫 상품을 고르세요."
        actions={
          <Button onClick={() => setEditing(emptyCandidate(channels[0]?.id ?? ""))} disabled={channels.length === 0}>
            + 후보 추가
          </Button>
        }
      />

      <p className="mb-4 text-xs text-stone-500">
        배점: {KEYS.map((k) => `${SCORE_LABEL[k]} ${SCORE_WEIGHTS[k]}`).join(" · ")} (100점). 70점 이상 추천, 50점 이상 검토. 광고비 {costs.adRate}%·CS 적립 {costs.lossRate}%·목표 마진 {costs.targetMargin}%는{" "}
        <Link href="/settings" className="underline">
          설정
        </Link>{" "}
        값을 써요.
      </p>

      {evals.length === 0 ? (
        <EmptyState>
          후보를 2~3개 넣고 비교해 보세요. 제철 캘린더·대시보드 트렌드에서 후보를 고르면 좋아요.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {evals.map((ev, rank) => {
            const verdict = verdictOf(ev.total);
            const c = ev.candidate;
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-stone-400">#{rank + 1}</span>
                      <span className="truncate text-lg font-semibold text-stone-800">{c.name}</span>
                      <Badge tone={verdict.tone}>{verdict.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {c.category} · 공급 {won(c.supplyPrice)} → 판매 {won(c.salePrice)} · {channels.find((ch) => ch.id === c.channelId)?.name ?? "채널 없음"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold tabular-nums text-stone-900">{ev.total}</div>
                    <div className="text-xs text-stone-400">/ 100</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-stone-50 p-2">
                    <div className="text-stone-500">마진율</div>
                    <div className={`font-semibold ${ev.profit <= 0 ? "text-rose-600" : ""}`}>{percent(ev.marginRate)}</div>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-2">
                    <div className="text-stone-500">개당 순이익</div>
                    <div className={`font-semibold ${ev.profit <= 0 ? "text-rose-600" : ""}`}>{won(ev.profit)}</div>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-2">
                    <div className="text-stone-500">월 검색수</div>
                    <div className="font-semibold">{c.monthlySearch === null ? "미확인" : num(c.monthlySearch)}</div>
                  </div>
                </div>

                <ul className="mt-3 space-y-1">
                  {KEYS.map((k) => (
                    <li key={k} className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0 text-stone-500">{SCORE_LABEL[k]}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${ev.parts[k] * 100}%` }} />
                      </div>
                      <span className="w-12 text-right tabular-nums text-stone-600">
                        {Math.round(ev.parts[k] * SCORE_WEIGHTS[k])}/{SCORE_WEIGHTS[k]}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-stone-500">시즌: {ev.seasonText}</p>

                {ev.advice.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-amber-800">
                    {ev.advice.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
                {c.note && <p className="mt-2 whitespace-pre-wrap text-xs text-stone-500">메모: {c.note}</p>}

                <div className="mt-3 flex justify-end gap-1">
                  <Button variant="ghost" onClick={() => setEditing(c)}>
                    수정
                  </Button>
                  <Button variant="danger" onClick={() => confirm(`'${c.name}' 후보를 지울까요?`) && removeSourcing(c.id)}>
                    삭제
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal wide open={editing !== null} title={editing && sourcing.some((s) => s.id === editing.id) ? "후보 수정" : "후보 추가"} onClose={() => setEditing(null)}>
        {editing && <SourcingForm initial={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
