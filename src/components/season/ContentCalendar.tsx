"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Card, Notice } from "@/components/ui";
import { buildContentPlan, type ContentPost } from "@/lib/contentCalendar";
import { DEFAULT_HOLIDAYS } from "@/lib/data/holidays";
import { SEASON_ITEMS } from "@/lib/data/season";
import { formatDate } from "@/lib/format";
import { addDays, parseDateKey } from "@/lib/holidays";
import { MARKETING_FORMAT_META } from "@/lib/marketingAi";
import { useAppStore } from "@/store/useAppStore";

const contentKey = (id: string) => `content:${id}`;

export function ContentCalendar() {
  const router = useRouter();
  const { skus, opsChecks, toggleOpsCheck, setWorkingProduct } = useAppStore();
  const [today] = useState(() => new Date());
  const plan = buildContentPlan(
    SEASON_ITEMS,
    skus.map((s) => s.productName),
    DEFAULT_HOLIDAYS,
    today,
  );
  const weeks = [...new Set(plan.map((p) => p.weekStart))];
  const done = plan.filter((p) => opsChecks[contentKey(p.id)]).length;

  const create = (post: ContentPost) => {
    setWorkingProduct(post.item);
    router.push(`/marketing?studio=${post.format}&note=${encodeURIComponent(`${post.angle} (${post.reason})`)}`);
  };

  return (
    <div className="space-y-4">
      <Notice>
        제철 시작·막바지와 명절 일정으로 8주 게시 계획을 짰어요. 한 주에 짧은 콘텐츠(도달) 1개 + 긴 콘텐츠(검색·저장) 1개. 등록한 내 상품 품목이 먼저 들어가요. &lsquo;만들기&rsquo;를 누르면 마케팅
        스튜디오가 주제를 채운 채로 열려요. ({done}/{plan.length} 발행)
      </Notice>
      <div className="grid gap-4 md:grid-cols-2">
        {weeks.map((week) => {
          const start = parseDateKey(week);
          const isThisWeek = today >= start && today < addDays(start, 7);
          return (
            <Card
              key={week}
              title={
                <>
                  {formatDate(start)} ~ {formatDate(addDays(start, 6))} {isThisWeek && <Badge tone="good">이번 주</Badge>}
                </>
              }
            >
              <ul className="space-y-2">
                {plan
                  .filter((p) => p.weekStart === week)
                  .map((post) => {
                    const meta = MARKETING_FORMAT_META[post.format];
                    const checked = Boolean(opsChecks[contentKey(post.id)]);
                    return (
                      <li key={post.id} className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-2.5">
                        <input type="checkbox" checked={checked} onChange={() => toggleOpsCheck(contentKey(post.id))} className="mt-1 size-4 accent-emerald-600" aria-label={`${post.item} 발행 완료`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${checked ? "text-stone-400 line-through" : "text-stone-800"}`}>
                            {meta.icon} {post.item} · {meta.title}
                          </p>
                          <p className="text-xs text-stone-500">
                            {post.angle} <span className="text-stone-400">— {post.reason}</span>
                          </p>
                        </div>
                        <button type="button" onClick={() => create(post)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                          만들기 →
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
