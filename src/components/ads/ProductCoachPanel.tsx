"use client";

import { useState } from "react";
import { AppLink } from "@/components/AppLink";
import { CopyButton } from "@/components/ui";
import { excludeText, safeExcludes, type CoachIssue, type IssueKind, type ProductCoach } from "@/lib/adCoach";
import type { AdGroup } from "@/lib/coupangAds";
import { num, won, wonShort } from "@/lib/format";
import { DataTable, Panel, SectionHeader, TableHead, Tag, TONE_TEXT, profitText, profitTone, rateText, roasText, td, th } from "./parts";

const ISSUE_STYLE: Record<IssueKind, { tone: "warn" | "loss" | "info"; short: string; links: { href: string; label: string }[] }> = {
  thumbnail: { tone: "warn", short: "썸네일", links: [{ href: "/thumbnails", label: "썸네일 제조기" }] },
  conversion: {
    tone: "loss",
    short: "리뷰·상세",
    links: [
      { href: "/reviews", label: "리뷰 분석" },
      { href: "/detail-page", label: "상세페이지" },
    ],
  },
  margin: { tone: "info", short: "마진", links: [{ href: "/margin", label: "가격·마진" }] },
};

type ActionKind = "exclude" | "cut" | "scale" | "promising";

const ACTION: Record<ActionKind, { label: string; tone: "loss" | "warn" | "good" | "info" }> = {
  exclude: { label: "빼기", tone: "loss" },
  cut: { label: "낮추기", tone: "warn" },
  scale: { label: "더 태우기", tone: "good" },
  promising: { label: "후보", tone: "info" },
};

const hasAdvice = (c: ProductCoach) => c.issues.length + c.exclude.length + c.cut.length + c.scale.length + c.promising.length > 0;

function Issue({ issue }: { issue: CoachIssue }) {
  const [open, setOpen] = useState(false);
  const style = ISSUE_STYLE[issue.kind];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={style.tone}>{style.short}</Tag>
        <p className="min-w-0 flex-1 text-[13px] text-stone-700">{issue.title}</p>
        {style.links.map((link) => (
          <AppLink key={link.href} href={link.href} className="text-xs font-medium text-emerald-700 hover:underline">
            {link.label}
          </AppLink>
        ))}
        <button type="button" onClick={() => setOpen(!open)} className="text-xs text-stone-400 hover:text-stone-600">
          {open ? "접기" : "가이드"}
        </button>
      </div>
      {open && (
        <div className="mt-1.5 pl-1">
          <p className="text-[13px] text-stone-500">{issue.detail}</p>
          <ul className="mt-1 space-y-0.5 text-[13px] text-stone-600">
            {issue.tips.map((tip) => (
              <li key={tip}>· {tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function keywordRows(coach: ProductCoach) {
  const sold = new Set(coach.soldElsewhere);
  const rows: { kind: ActionKind; group: AdGroup; note: string | null }[] = [
    ...coach.exclude.map((g) => ({ kind: "exclude" as const, group: g, note: sold.has(g.key) ? "다른 상품에서 팔림 — 제외 대신 입찰가 낮추기" : null })),
    ...coach.cut.map((g) => ({ kind: "cut" as const, group: g, note: null })),
    ...coach.scale.map((g) => ({ kind: "scale" as const, group: g, note: null })),
    ...coach.promising.map((g) => ({ kind: "promising" as const, group: g, note: "주문 1건 — 조금만 올려 데이터 모으기" })),
  ];
  return rows;
}

function CoachCard({ coach, open, onToggle }: { coach: ProductCoach; open: boolean; onToggle: () => void }) {
  const boost = coach.scale.length + coach.promising.length;
  const rows = keywordRows(coach);
  return (
    <li className="border-b border-stone-100 last:border-0">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-1 py-3 text-left hover:bg-stone-50/80">
        <span className="min-w-0 flex-1 truncate font-medium text-stone-900" title={coach.key}>
          {coach.key}
        </span>
        {coach.issues.map((i) => (
          <Tag key={i.kind} tone={ISSUE_STYLE[i.kind].tone}>
            {ISSUE_STYLE[i.kind].short}
          </Tag>
        ))}
        {coach.exclude.length > 0 && <Tag tone="loss">빼기 {coach.exclude.length}</Tag>}
        {boost > 0 && <Tag tone="good">더 태우기 {boost}</Tag>}
        <span className={`text-xs text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="space-y-3 pb-4">
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-stone-500">
            <span>
              광고비 <b className="font-semibold tabular-nums text-stone-800">{wonShort(coach.metrics.cost)}</b>
            </span>
            <span>
              ROAS{" "}
              <b className="font-semibold tabular-nums text-stone-800">
                {roasText(coach.metrics.roas)} / {roasText(coach.breakEven)}
              </b>
            </span>
            <span>
              남긴 돈 <b className={`font-semibold tabular-nums ${TONE_TEXT[profitTone(coach.profit)]}`}>{profitText(coach.profit)}</b>
            </span>
            <span>
              검색 클릭률 <b className="font-semibold tabular-nums text-stone-800">{rateText(coach.searchCtr, 2)}</b>
              {coach.peerCtr !== null && <span className="text-stone-400"> (평균 {rateText(coach.peerCtr, 2)})</span>}
            </span>
            <span>
              전환율 <b className="font-semibold tabular-nums text-stone-800">{rateText(coach.metrics.cvr)}</b>
              {coach.peerCvr !== null && <span className="text-stone-400"> (평균 {rateText(coach.peerCvr)})</span>}
            </span>
            <span>
              주문 <b className="font-semibold tabular-nums text-stone-800">{num(coach.metrics.orders)}건</b>
            </span>
          </p>

          {coach.issues.map((issue) => (
            <Issue key={issue.kind} issue={issue} />
          ))}

          {rows.length > 0 && (
            <DataTable minWidth="640px">
              <TableHead>
                <tr>
                  <th className={th("left")}>조치</th>
                  <th className={th("left")}>키워드</th>
                  <th className={th()}>클릭</th>
                  <th className={th()}>광고비</th>
                  <th className={th()}>ROAS</th>
                  <th className={th()}>주문</th>
                </tr>
              </TableHead>
              <tbody>
                {rows.map(({ kind, group: g, note }) => (
                  <tr key={`${kind}-${g.key}`} className="border-t border-stone-100">
                    <td className={td()}>
                      <Tag tone={ACTION[kind].tone}>{ACTION[kind].label}</Tag>
                    </td>
                    <td className={td("max-w-56")}>
                      <p className="truncate font-medium text-stone-800" title={g.key}>
                        {g.key}
                      </p>
                      {note && <p className="text-[11px] text-amber-700">{note}</p>}
                    </td>
                    <td className={`${td()} text-right tabular-nums`}>{num(g.metrics.clicks)}</td>
                    <td className={`${td()} text-right tabular-nums`}>{won(g.metrics.cost)}</td>
                    <td className={`${td()} text-right tabular-nums`}>{roasText(g.metrics.roas)}</td>
                    <td className={`${td()} text-right tabular-nums`}>{num(g.metrics.orders)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {safeExcludes(coach).length > 0 && <CopyButton text={safeExcludes(coach).join("\n")} label="뺄 키워드 복사" />}
            {[...coach.scale, ...coach.promising].length > 0 && <CopyButton text={[...coach.scale, ...coach.promising].map((g) => g.key).join("\n")} label="더 태울 키워드 복사" />}
            {coach.adGroups.length > 0 && <span className="text-xs text-stone-400">등록: {coach.adGroups.join(" · ")}</span>}
          </div>
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
        title="상품별 키워드 조치"
        description={[
          excludeCount ? `뺄 키워드 ${excludeCount}개 · ${won(wasted)}` : null,
          count("thumbnail") ? `썸네일 ${count("thumbnail")}` : null,
          count("conversion") ? `리뷰·상세 ${count("conversion")}` : null,
          count("margin") ? `마진 ${count("margin")}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "클릭률은 썸네일, 전환율은 리뷰·상세페이지를 먼저 보세요."}
        actions={allExcludes && <CopyButton text={allExcludes} label="제외 키워드 모두 복사" />}
      />
      <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 px-3">
        {list.map((coach) => (
          <CoachCard key={coach.key} coach={coach} open={openKey === coach.key} onToggle={() => setOpenKey(openKey === coach.key ? null : coach.key)} />
        ))}
      </ul>
    </Panel>
  );
}
