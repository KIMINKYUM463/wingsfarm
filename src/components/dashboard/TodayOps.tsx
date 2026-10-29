"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { AppLink } from "@/components/AppLink";
import { countByStatus, evaluateListings } from "@/lib/margin";
import { opsProgress } from "@/lib/opsChecklist";
import { percent } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

const QUICK_LINKS = [
  { href: "/titles", label: "상품명", icon: "✍️" },
  { href: "/tags", label: "검색 태그", icon: "🏷️" },
  { href: "/thumbnails", label: "썸네일", icon: "🖼️" },
  { href: "/detail-page", label: "상세페이지", icon: "📄" },
  { href: "/marketing", label: "마케팅", icon: "📣" },
];

export function TodayOps() {
  const { skus, channels, costs, opsChecks, workingProduct } = useAppStore();
  const evals = useMemo(() => evaluateListings(skus, channels, costs), [skus, channels, costs]);
  const counts = countByStatus(evals);
  const worst = evals
    .filter((e) => e.status !== "good")
    .sort((a, b) => a.result.marginRate - b.result.marginRate)
    .slice(0, 3);
  const daily = opsProgress(opsChecks, "daily");
  const weekly = opsProgress(opsChecks, "weekly");
  const skuName = (id: string) => {
    const sku = skus.find((s) => s.id === id);
    return sku ? `${sku.productName} ${sku.optionName}` : "";
  };
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? id;

  return (
    <section className="grid animate-fade-up gap-4 md:grid-cols-3">
      <OpsCard
        title="역마진 경보"
        href="/margin?tab=board"
        tone={counts.loss ? "loss" : counts.warn ? "warn" : "good"}
        headline={evals.length === 0 ? "판매가 미등록" : counts.loss ? `역마진 ${counts.loss}건` : counts.warn ? `목표 미달 ${counts.warn}건` : "모두 정상"}
      >
        {evals.length === 0 ? (
          <p>설정 → 상품에 채널별 판매가를 넣으면 매일 자동으로 점검합니다.</p>
        ) : worst.length === 0 ? (
          <p>판매 중인 {evals.length}건 모두 목표 마진 {costs.targetMargin}% 이상입니다.</p>
        ) : (
          <ul className="space-y-1">
            {worst.map((e) => (
              <li key={`${e.skuId}:${e.channelId}`} className="flex justify-between gap-2">
                <span className="truncate">
                  {skuName(e.skuId)} · {channelName(e.channelId)}
                </span>
                <span className={`shrink-0 font-semibold ${e.status === "loss" ? "text-rose-600" : "text-amber-600"}`}>{percent(e.result.marginRate)}</span>
              </li>
            ))}
          </ul>
        )}
      </OpsCard>

      <OpsCard
        title="오늘 할 일"
        href="/ops"
        tone={daily.done === daily.total ? "good" : "default"}
        headline={`매일 ${daily.done}/${daily.total} · 매주 ${weekly.done}/${weekly.total}`}
      >
        {daily.pending.length === 0 ? (
          <p>오늘 루틴을 모두 끝냈어요 👏</p>
        ) : (
          <ul className="space-y-1">
            {daily.pending.slice(0, 3).map((item) => (
              <li key={item.id} className="truncate">
                ☐ {item.title}
              </li>
            ))}
          </ul>
        )}
      </OpsCard>

      <OpsCard title="작업 중인 상품" tone="default" headline={workingProduct || "아직 없음"}>
        <p className="mb-2">한 번 입력하면 상품명·태그·썸네일·마케팅 화면에 자동으로 채워집니다.</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_LINKS.map((l) => (
            <AppLink key={l.href} href={l.href} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-200 hover:ring-emerald-300">
              {l.icon} {l.label}
            </AppLink>
          ))}
        </div>
      </OpsCard>
    </section>
  );
}

const TONE = {
  default: "border-stone-200 bg-white",
  good: "border-emerald-200 bg-emerald-50/50",
  warn: "border-amber-200 bg-amber-50/60",
  loss: "border-rose-200 bg-rose-50/70",
} as const;

const HEADLINE_TONE = { default: "text-stone-900", good: "text-emerald-700", warn: "text-amber-700", loss: "text-rose-700" } as const;

function OpsCard({
  title,
  href,
  tone,
  headline,
  children,
}: {
  title: string;
  href?: string;
  tone: keyof typeof TONE;
  headline: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-3xl border p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${TONE[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-stone-500">{title}</p>
        {href && (
          <Link href={href} className="text-xs text-emerald-700 hover:underline">
            열기 →
          </Link>
        )}
      </div>
      <p className={`mt-1 truncate text-xl font-bold tracking-tight ${HEADLINE_TONE[tone]}`}>{headline}</p>
      <div className="mt-3 text-xs leading-relaxed text-stone-600">{children}</div>
    </div>
  );
}
