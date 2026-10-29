"use client";

import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ROADMAP, roadmapKey, roadmapProgress } from "@/lib/roadmap";
import { useAppStore } from "@/store/useAppStore";

export default function RoadmapPage() {
  const opsChecks = useAppStore((s) => s.opsChecks);
  const toggleOpsCheck = useAppStore((s) => s.toggleOpsCheck);
  const { done, total, next } = roadmapProgress(opsChecks);
  const ratio = done / total;

  return (
    <>
      <PageHeader title="수강생 로드맵" description="사업자등록부터 첫 판매·첫 정산·매출 키우기까지, 위탁판매를 시작하는 순서대로 정리했어요. 하나씩 체크하며 따라오세요." />

      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-stone-500">진행률</p>
            <p className="text-2xl font-bold text-stone-900">
              {done}/{total} <span className="text-base font-medium text-emerald-700">{Math.round(ratio * 100)}%</span>
            </p>
          </div>
          {next ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
              다음 할 일: <b>{next.title}</b>
              {next.href && (
                <Link href={next.href} className="ml-2 font-medium underline">
                  바로 가기 →
                </Link>
              )}
            </div>
          ) : (
            <Badge tone="good">모든 단계를 마쳤어요 🎉</Badge>
          )}
        </div>
        <div className="mt-3 h-2 rounded-full bg-stone-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${ratio * 100}%` }} />
        </div>
      </Card>

      <ol className="space-y-4">
        {ROADMAP.map((stage) => {
          const stageDone = stage.steps.filter((s) => opsChecks[roadmapKey(s.id)]).length;
          return (
            <li key={stage.id}>
              <Card
                title={
                  <>
                    {stage.title} <span className="ml-1 text-sm font-normal text-stone-500">{stage.goal}</span>
                  </>
                }
                actions={<Badge tone={stageDone === stage.steps.length ? "good" : stageDone ? "warn" : "default"}>{`${stageDone}/${stage.steps.length}`}</Badge>}
              >
                <ul className="space-y-2">
                  {stage.steps.map((step) => {
                    const checked = Boolean(opsChecks[roadmapKey(step.id)]);
                    return (
                      <li key={step.id} className={`flex gap-3 rounded-xl p-3 ${next?.id === step.id ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-stone-50"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleOpsCheck(roadmapKey(step.id))} className="mt-1 size-4 shrink-0 accent-emerald-600" aria-label={step.title} />
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium ${checked ? "text-stone-400 line-through" : "text-stone-800"}`}>{step.title}</p>
                          <p className="mt-0.5 text-sm text-stone-600">{step.detail}</p>
                          {(step.href || step.link) && (
                            <div className="mt-1.5 flex flex-wrap gap-3 text-sm">
                              {step.href && (
                                <Link href={step.href} className="font-medium text-emerald-700 hover:underline">
                                  윙스팜AI에서 하기 →
                                </Link>
                              )}
                              {step.link && (
                                <a href={step.link.url} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">
                                  {step.link.label} ↗
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </li>
          );
        })}
      </ol>
    </>
  );
}
