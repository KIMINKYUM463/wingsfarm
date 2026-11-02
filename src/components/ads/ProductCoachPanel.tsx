"use client";

import { useState } from "react";
import { AppLink } from "@/components/AppLink";
import { CopyButton } from "@/components/ui";
import { excludeText, safeExcludes, type CoachIssue, type IssueKind, type ProductCoach } from "@/lib/adCoach";
import type { AdGroup } from "@/lib/coupangAds";
import { num, won, wonShort } from "@/lib/format";
import { Metric, Panel, SectionHeader, profitText, profitTone, rateText, roasText } from "./parts";

const ISSUE_STYLE: Record<IssueKind, { box: string; title: string; icon: string; short: string; links: { href: string; label: string }[] }> = {
  thumbnail: { box: "bg-amber-50/70 ring-amber-200", title: "text-amber-900", icon: "🖼️", short: "썸네일", links: [{ href: "/thumbnails", label: "썸네일 제조기" }] },
  conversion: {
    box: "bg-rose-50/70 ring-rose-200",
    title: "text-rose-900",
    icon: "📝",
    short: "리뷰·상세",
    links: [
      { href: "/reviews", label: "리뷰 분석" },
      { href: "/detail-page", label: "상세페이지 고치기" },
    ],
  },
  margin: { box: "bg-sky-50/70 ring-sky-200", title: "text-sky-900", icon: "💰", short: "마진", links: [{ href: "/margin", label: "가격·마진 계산" }] },
};

const hasAdvice = (c: ProductCoach) => c.issues.length + c.exclude.length + c.cut.length + c.scale.length + c.promising.length > 0;

function Issue({ issue }: { issue: CoachIssue }) {
  const style = ISSUE_STYLE[issue.kind];
  return (
    <div className={`rounded-2xl p-4 ring-1 ${style.box}`}>
      <p className={`text-sm font-semibold ${style.title}`}>
        {style.icon} {issue.title}
      </p>
      <p className="mt-1 text-sm text-stone-600">{issue.detail}</p>
      <ul className="mt-2 space-y-1 text-[13px] leading-relaxed text-stone-600">
        {issue.tips.map((tip) => (
          <li key={tip} className="flex gap-1.5">
            <span className="text-stone-400">·</span>
            {tip}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-3">
        {style.links.map((link) => (
          <AppLink key={link.href} href={link.href} className="text-xs font-semibold text-emerald-700 hover:underline">
            {link.label} →
          </AppLink>
        ))}
      </div>
    </div>
  );
}

function KeywordColumn({
  title,
  hint,
  tone,
  groups,
  detail,
  copy,
  extra,
}: {
  title: string;
  hint: string;
  tone: "loss" | "warn" | "good";
  groups: AdGroup[];
  detail: (g: AdGroup) => string;
  copy?: string[];
  extra?: (g: AdGroup) => string | null;
}) {
  const ring = { loss: "bg-rose-50/40 ring-rose-100 text-rose-800", warn: "bg-amber-50/40 ring-amber-100 text-amber-800", good: "bg-emerald-50/40 ring-emerald-100 text-emerald-800" }[tone];
  return (
    <div className={`rounded-2xl p-4 ring-1 ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {title} <span className="font-normal opacity-70">{groups.length}</span>
        </p>
        {copy && copy.length > 0 && <CopyButton text={copy.join("\n")} label="복사" />}
      </div>
      <p className="mt-0.5 text-[11px] text-stone-500">{hint}</p>
      {groups.length === 0 ? (
        <p className="mt-3 text-xs text-stone-400">없어요</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {groups.slice(0, 10).map((g) => (
            <li key={g.key} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium text-stone-800" title={g.key}>
                  {g.key}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-stone-500">{detail(g)}</span>
              </div>
              {extra?.(g) && <p className="text-[11px] text-amber-700">{extra(g)}</p>}
            </li>
          ))}
          {groups.length > 10 && <li className="text-xs text-stone-400">외 {groups.length - 10}개 (복사하면 모두 들어가요)</li>}
        </ul>
      )}
    </div>
  );
}

function CoachCard({ coach, open, onToggle }: { coach: ProductCoach; open: boolean; onToggle: () => void }) {
  const boost = [...coach.scale, ...coach.promising];
  const promising = new Set(coach.promising.map((k) => k.key));
  const soldElsewhere = new Set(coach.soldElsewhere);
  return (
    <li className="rounded-2xl border border-stone-200/80">
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left">
        <span className="min-w-0 flex-1 truncate font-semibold text-stone-900" title={coach.key}>
          {coach.key}
        </span>
        {coach.issues.map((i) => (
          <span key={i.kind} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">
            {ISSUE_STYLE[i.kind].icon} {ISSUE_STYLE[i.kind].short}
          </span>
        ))}
        {coach.exclude.length > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">뺄 키워드 {coach.exclude.length}</span>}
        {boost.length > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">더 태울 {boost.length}</span>}
        <span className="text-xs text-stone-400">{open ? "접기 ▲" : "보기 ▼"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-stone-100 px-4 py-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Metric label="광고비" value={wonShort(coach.metrics.cost)} />
            <Metric label="ROAS / 손익분기" value={`${roasText(coach.metrics.roas)} / ${roasText(coach.breakEven)}`} />
            <Metric label="남긴 돈" value={profitText(coach.profit)} tone={profitTone(coach.profit)} />
            <Metric label="검색 클릭률" value={rateText(coach.searchCtr, 2)} hint={coach.peerCtr === null ? "비교 대상 없음" : `다른 상품 ${rateText(coach.peerCtr, 2)}`} />
            <Metric label="전환율" value={rateText(coach.metrics.cvr)} hint={coach.peerCvr === null ? "비교 대상 없음" : `다른 상품 ${rateText(coach.peerCvr)}`} />
            <Metric label="주문" value={`${num(coach.metrics.orders)}건`} />
          </div>

          {coach.issues.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-2">
              {coach.issues.map((issue) => (
                <Issue key={issue.kind} issue={issue} />
              ))}
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-3">
            <KeywordColumn
              title="광고에서 뺄 키워드"
              hint={`주문 0건 · 낭비 ${won(coach.wasted)} → 제외 키워드로 등록`}
              tone="loss"
              groups={coach.exclude}
              detail={(g) => `클릭 ${g.metrics.clicks} · ${won(g.metrics.cost)}`}
              copy={safeExcludes(coach)}
              extra={(g) => (soldElsewhere.has(g.key) ? "다른 상품에선 팔린 키워드 — 같은 광고그룹이면 제외 말고 입찰가만 낮추세요" : null)}
            />
            <KeywordColumn
              title="입찰가 낮출 키워드"
              hint="팔리지만 손익분기 미달 → 입찰가 10~20% 내리기"
              tone="warn"
              groups={coach.cut}
              detail={(g) => `ROAS ${roasText(g.metrics.roas)}`}
              copy={coach.cut.map((g) => g.key)}
            />
            <KeywordColumn
              title="광고비 더 태울 키워드"
              hint="손익분기의 1.3배 이상 → 입찰가 10~20% 올리기"
              tone="good"
              groups={boost}
              detail={(g) => `ROAS ${roasText(g.metrics.roas)} · ${g.metrics.orders}건`}
              copy={boost.map((g) => g.key)}
              extra={(g) => (promising.has(g.key) ? "주문 1건이라 아직 후보 — 조금만 올려 데이터를 모으세요" : null)}
            />
          </div>

          {coach.adGroups.length > 0 && <p className="text-xs text-stone-500">등록할 곳: {coach.adGroups.join(" · ")}</p>}
        </div>
      )}
    </li>
  );
}

/** 상품별로 뺄 키워드·더 태울 키워드 + 클릭률(썸네일)·전환율(리뷰·상세페이지) 진단 */
export function ProductCoachPanel({ coaches }: { coaches: ProductCoach[] }) {
  const list = coaches.filter(hasAdvice);
  const [openKey, setOpenKey] = useState<string | null>(() => list.find((c) => c.issues.length || c.exclude.length)?.key ?? list[0]?.key ?? null);
  if (!list.length) return null;

  const count = (kind: IssueKind) => list.filter((c) => c.issues.some((i) => i.kind === kind)).length;
  const excludeCount = list.reduce((acc, c) => acc + c.exclude.length, 0);
  const wasted = list.reduce((acc, c) => acc + c.wasted, 0);
  const allExcludes = excludeText(list);

  return (
    <Panel>
      <SectionHeader
        eyebrow="Product Coaching"
        title="상품별로 뺄 키워드 · 더 태울 키워드"
        description="클릭률이 다른 상품보다 낮으면 썸네일 문제, 클릭은 되는데 안 팔리면 리뷰·상세페이지 문제로 봐요. 기준은 같은 보고서의 다른 상품 평균이에요."
        actions={allExcludes && <CopyButton text={allExcludes} label="상품별 제외 키워드 모두 복사" />}
      />
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-rose-50 px-3 py-1 font-medium text-rose-700">
          뺄 키워드 {excludeCount}개 · 낭비 {won(wasted)}
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">🖼️ 썸네일 점검 {count("thumbnail")}개 상품</span>
        <span className="rounded-full bg-rose-50 px-3 py-1 font-medium text-rose-700">📝 리뷰·상세페이지 점검 {count("conversion")}개 상품</span>
        {count("margin") > 0 && <span className="rounded-full bg-sky-50 px-3 py-1 font-medium text-sky-700">💰 마진 점검 {count("margin")}개 상품</span>}
      </div>
      <ul className="space-y-2">
        {list.map((coach) => (
          <CoachCard key={coach.key} coach={coach} open={openKey === coach.key} onToggle={() => setOpenKey(openKey === coach.key ? null : coach.key)} />
        ))}
      </ul>
    </Panel>
  );
}
