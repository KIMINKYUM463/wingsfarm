"use client";

import { useMemo, useState } from "react";
import type { SeasonCategory } from "@/types";
import { Badge, Card, PageHeader, Table, Tabs } from "@/components/ui";
import { ContentCalendar } from "@/components/season/ContentCalendar";
import { SEASON_ITEMS } from "@/lib/data/season";
import { PREP_LEAD_DAYS, seasonStatuses } from "@/lib/season";
import { useAppStore } from "@/store/useAppStore";

const FILTERS: ("전체" | SeasonCategory)[] = ["전체", "과일", "채소", "수산", "축산"];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const TABS = [
  { id: "season", label: "🍑 제철표" },
  { id: "content", label: "🗓️ 콘텐츠 캘린더" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** 로드맵·명절 일정에서 /season?tab=content 로 들어온다 (ClientOnly 아래라 window 사용 가능) */
const initialTab = (): Tab => (new URLSearchParams(window.location.search).get("tab") === "content" ? "content" : "season");

export default function SeasonPage() {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <>
      <PageHeader
        title={tab === "season" ? "제철 캘린더" : "콘텐츠 캘린더"}
        description={
          tab === "season"
            ? `시즌 시작 ${PREP_LEAD_DAYS}일 전에는 상세페이지와 상품 등록을 끝내야 검색 노출이 쌓입니다.`
            : "무엇을 올릴지 고민하지 않도록, 제철·명절에 맞춘 주 2회 게시 계획을 드려요."
        }
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />
      {tab === "season" ? <SeasonTable /> : <ContentCalendar />}
    </>
  );
}

function SeasonTable() {
  const skus = useAppStore((s) => s.skus);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("전체");
  const today = useMemo(() => new Date(), []);
  const currentMonth = today.getMonth() + 1;

  const statuses = useMemo(() => seasonStatuses(SEASON_ITEMS, today), [today]);
  const visible = statuses.filter((s) => filter === "전체" || s.item.category === filter);
  const prepare = statuses
    .filter((s) => !s.inSeason && s.daysUntilStart <= PREP_LEAD_DAYS + 30)
    .sort((a, b) => a.daysUntilStart - b.daysUntilStart);
  const ending = statuses.filter((s) => s.endingThisMonth);
  const registered = (name: string) => skus.some((s) => s.productName.includes(name));

  return (
    <>
      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <Card title="🚀 곧 시즌 오픈 — 지금 준비할 품목">
          <div className="flex flex-wrap gap-2">
            {prepare.length === 0 && <span className="text-sm text-stone-400">60일 내 시작하는 품목이 없습니다.</span>}
            {prepare.map((s) => (
              <div key={s.item.name} className="rounded-xl border border-stone-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{s.item.name}</span>
                  <Badge tone={s.daysUntilStart <= PREP_LEAD_DAYS ? "loss" : "warn"}>D-{s.daysUntilStart}</Badge>
                  {registered(s.item.name) && <Badge tone="good">등록됨</Badge>}
                </div>
                <div className="mt-1 max-w-56 text-xs text-stone-500">{s.item.tip}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="🍂 이번 달로 시즌 종료 — 품절·판매중지 대비">
          <div className="flex flex-wrap gap-2">
            {ending.length === 0 && <span className="text-sm text-stone-400">이번 달 종료되는 품목이 없습니다.</span>}
            {ending.map((s) => (
              <div key={s.item.name} className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2">
                <span className="font-semibold">{s.item.name}</span>
                {registered(s.item.name) && <span className="ml-2 text-xs text-amber-700">판매 중 → 대체 품목 준비</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card
        title="월별 제철표"
        actions={
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs ${f === filter ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"}`}
              >
                {f}
              </button>
            ))}
          </div>
        }
      >
        <Table>
          <thead>
            <tr>
              <th>품목</th>
              {MONTHS.map((m) => (
                <th key={m} className={`text-center ${m === currentMonth ? "rounded-t-xl bg-amber-50" : ""}`}>
                  {m === currentMonth ? (
                    <span className="inline-flex flex-col items-center gap-0.5">
                      <span className="text-[10px] font-semibold text-amber-600">이번 달</span>
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-white shadow-sm">{m}월</span>
                    </span>
                  ) : (
                    `${m}월`
                  )}
                </th>
              ))}
              <th>상태</th>
              <th>운영 팁</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.item.name}>
                <td className="whitespace-nowrap font-medium">
                  {s.item.name}
                  <span className="ml-1 text-xs text-stone-400">{s.item.category}</span>
                </td>
                {MONTHS.map((m) => (
                  <td key={m} className={`px-0.5! ${m === currentMonth ? "bg-amber-50" : ""}`}>
                    <div
                      className={`h-5 rounded ${
                        !s.item.months.includes(m)
                          ? ""
                          : m === currentMonth
                            ? "bg-emerald-600 shadow-[0_0_0_2px_#fbbf24]"
                            : "bg-emerald-400"
                      }`}
                    />
                  </td>
                ))}
                <td className="whitespace-nowrap">
                  {s.inSeason ? <Badge tone="good">제철</Badge> : <Badge>D-{s.daysUntilStart}</Badge>}
                </td>
                <td className="min-w-64 text-xs text-stone-500">{s.item.tip}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-3 text-xs text-stone-400">출하 시기는 지역·작황에 따라 1~2주 달라질 수 있는 참고 정보입니다.</p>
      </Card>
    </>
  );
}
