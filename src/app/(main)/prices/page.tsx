"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Badge, Card, EmptyState, Notice, PageHeader, Select, Table, Tabs, TextInput } from "@/components/ui";
import { num } from "@/lib/format";
import { errorMessage } from "@/lib/http";
import { CATEGORY_ICON, PRICE_ALERT_RATE, changeRate, priceIcon, splitItemName, type KamisPrice, type KamisResponse } from "@/lib/kamis";

const CLS_TABS = [
  { id: "도매", label: "🏭 도매 · 공급가 흐름" },
  { id: "소매", label: "🛒 소매 · 소비자 체감가" },
] as const;
type Cls = (typeof CLS_TABS)[number]["id"];

type Sort = "name" | "up" | "down";

const monthRate = (i: KamisPrice) => changeRate(i.today, i.monthAgo);
function Change({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-stone-300">-</span>;
  const pct = Math.round(rate * 100);
  const tone =
    rate >= PRICE_ALERT_RATE
      ? "bg-rose-50 font-semibold text-rose-600"
      : rate <= -PRICE_ALERT_RATE
        ? "bg-sky-50 font-semibold text-sky-600"
        : pct > 0
          ? "text-rose-500"
          : pct < 0
            ? "text-sky-500"
            : "text-stone-400";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs tabular-nums ${tone}`}>
      {pct > 0 ? "▲" : pct < 0 ? "▼" : "–"} {Math.abs(pct)}%
    </span>
  );
}

function ItemName({ item }: { item: KamisPrice }) {
  const { main, sub: kind } = splitItemName(item.name, item.unit);
  const sub = [kind, item.variant && `구분 ${item.variant}`].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-50 text-base" aria-hidden>
        {priceIcon(item)}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-stone-800">{main}</span>
          {(monthRate(item) ?? 0) >= PRICE_ALERT_RATE && <Badge tone="loss">급등</Badge>}
        </div>
        {sub && <div className="truncate text-xs text-stone-400">{sub}</div>}
      </div>
    </div>
  );
}

function SummaryTile({ icon, label, value, hint, tone = "text-stone-900", active, onClick }: { icon: string; label: string; value: string; hint?: string; tone?: string; active?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 text-left">
        <div className="text-xs text-stone-500">{label}</div>
        <div className={`text-lg font-bold tabular-nums ${tone}`}>{value}</div>
        {hint && <div className="truncate text-xs text-stone-400">{hint}</div>}
      </div>
    </>
  );
  const base = "flex items-center gap-3 rounded-2xl border p-4 transition";
  if (!onClick) return <div className={`${base} border-stone-200 bg-stone-50`}>{body}</div>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`${base} ${active ? "border-emerald-400 bg-emerald-50" : "border-stone-200 bg-stone-50 hover:border-stone-300"}`}>
      {body}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition ${active ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"}`}
    >
      {children}
    </button>
  );
}

function SetupGuide() {
  return (
    <Card title="🔌 시세 연결이 필요해요">
      <p className="text-sm text-stone-600">
        설정의 연결 상태에서 농산물 시세 인증키를 넣으면 이 화면에 전국 도·소매 시세가 나와요. 농림축산식품부·aT가 매일 조사하는 공식 가격이에요.
      </p>
      <Link href="/settings" className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline">
        설정으로 가기 →
      </Link>
    </Card>
  );
}

export default function PricesPage() {
  const [data, setData] = useState<KamisResponse | null>(null);
  const [failed, setFailed] = useState("");
  const [cls, setCls] = useState<Cls>("도매");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("up");

  useEffect(() => {
    fetch("/api/prices")
      .then((res) => res.json() as Promise<KamisResponse>)
      .then(setData)
      .catch((err) => setFailed(errorMessage(err, "시세를 불러오지 못했어요.")));
  }, []);

  const items = data?.items ?? [];
  const clsItems = items.filter((i) => i.cls === cls);
  const categories = [...new Set(clsItems.map((i) => i.category).filter(Boolean))];
  const surging = clsItems.filter((i) => (monthRate(i) ?? 0) >= PRICE_ALERT_RATE).length;
  const falling = clsItems.filter((i) => (monthRate(i) ?? 0) <= -PRICE_ALERT_RATE).length;
  const latestDate = items.find((i) => i.latestDate)?.latestDate;
  const updatedTime = data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "";
  const keyword = query.trim();
  const rows = clsItems
    .filter((i) => (!category || i.category === category) && i.name.includes(keyword))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : (sort === "up" ? -1 : 1) * ((monthRate(a) ?? 0) - (monthRate(b) ?? 0))));

  const changeCls = (next: Cls) => {
    setCls(next);
    setCategory("");
  };

  return (
    <>
      <PageHeader title="도매 시세" description="전국 도·소매 공식 시세로 공급가 인상을 미리 알아채세요. 도매가가 한 달 새 10% 넘게 오르면 공급처가 곧 단가를 올릴 가능성이 높아요." />

      {failed && <Notice tone="loss">{failed}</Notice>}
      {!data && !failed && <EmptyState>⏳ 시세를 불러오는 중…</EmptyState>}
      {data?.missingKey && <SetupGuide />}
      {data?.error && !data.missingKey && <Notice tone="loss">{data.error}</Notice>}

      {items.length > 0 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryTile icon="📋" label={`${cls} 조사 품목`} value={`${clsItems.length}개`} hint={`${categories.length}개 부류`} />
            <SummaryTile icon="📈" label="한 달 새 10%↑ 급등" value={`${surging}개`} tone="text-rose-600" hint="오른 순으로 보기" active={sort === "up"} onClick={() => setSort("up")} />
            <SummaryTile icon="📉" label="한 달 새 10%↓ 급락" value={`${falling}개`} tone="text-sky-600" hint="내린 순으로 보기" active={sort === "down"} onClick={() => setSort("down")} />
            <SummaryTile icon="🗓️" label="조사일" value={latestDate === "당일" ? "오늘" : (latestDate ?? "-")} hint={updatedTime && `${updatedTime} 갱신 · 3시간마다`} />
          </div>
          <Card
            title={
              <span className="flex items-center gap-2">
                📊 전체 시세 <Badge>{rows.length}개</Badge>
              </span>
            }
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Tabs tabs={CLS_TABS} value={cls} onChange={changeCls} />
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm" aria-hidden>
                  🔍
                </span>
                <TextInput className="w-44! pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="품목 검색" aria-label="품목 검색" />
              </div>
              <Select className="w-auto!" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬">
                <option value="up">한 달 새 많이 오른 순</option>
                <option value="down">한 달 새 많이 내린 순</option>
                <option value="name">이름순</option>
              </Select>
            </div>

            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="부류">
              <Chip active={!category} onClick={() => setCategory("")}>
                🧺 전체 <span className="text-xs opacity-70">{clsItems.length}</span>
              </Chip>
              {categories.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {CATEGORY_ICON[c] ?? "📦"} {c} <span className="text-xs opacity-70">{clsItems.filter((i) => i.category === c).length}</span>
                </Chip>
              ))}
            </div>

            {rows.length === 0 ? (
              <EmptyState>🔎 조건에 맞는 품목이 없어요.</EmptyState>
            ) : (
              <Table scrollClassName="max-h-[32rem]">
                <thead>
                  <tr>
                    <th>품목</th>
                    {!category && <th>부류</th>}
                    <th>단위</th>
                    <th className="text-right">최근가</th>
                    <th className="text-right">전일 대비</th>
                    <th className="text-right">1개월 전 대비</th>
                    <th className="text-right">1년 전 대비</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.id} className="hover:bg-stone-50">
                      <td>
                        <ItemName item={i} />
                      </td>
                      {!category && <td className="whitespace-nowrap text-xs text-stone-500">{i.category}</td>}
                      <td className="whitespace-nowrap text-xs text-stone-500">{i.unit}</td>
                      <td className="text-right font-semibold tabular-nums text-stone-800">{i.today ? `${num(i.today)}원` : "-"}</td>
                      <td className="text-right">
                        <Change rate={changeRate(i.today, i.dayAgo)} />
                      </td>
                      <td className="text-right">
                        <Change rate={monthRate(i)} />
                      </td>
                      <td className="text-right">
                        <Change rate={changeRate(i.today, i.yearAgo)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
