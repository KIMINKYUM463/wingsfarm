"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, EmptyState, Notice, PageHeader, Select, Table, Tabs, TextInput } from "@/components/ui";
import { growthText, num } from "@/lib/format";
import { errorMessage } from "@/lib/http";
import { PRICE_ALERT_RATE, changeRate, matchSkuPrices, type KamisPrice, type KamisResponse } from "@/lib/kamis";
import { useAppStore } from "@/store/useAppStore";

const CLS_TABS = [
  { id: "도매", label: "도매 (공급가 흐름)" },
  { id: "소매", label: "소매 (소비자 체감가)" },
] as const;
type Cls = (typeof CLS_TABS)[number]["id"];

type Sort = "name" | "up" | "down";

function Change({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-stone-300">-</span>;
  const tone = rate >= PRICE_ALERT_RATE ? "text-rose-600 font-semibold" : rate <= -PRICE_ALERT_RATE ? "text-sky-600 font-semibold" : "text-stone-600";
  return <span className={`tabular-nums ${tone}`}>{growthText(rate)}</span>;
}

function SetupGuide() {
  return (
    <Card title="KAMIS 시세 연결하기 (무료)">
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-stone-700">
        <li>
          <a href="https://www.kamis.or.kr" target="_blank" rel="noreferrer" className="text-emerald-700 underline">
            kamis.or.kr
          </a>{" "}
          회원가입 후 로그인
        </li>
        <li>고객센터 → Open-API → 이용 신청 (보통 바로 또는 하루 안에 인증키 발급)</li>
        <li>
          프로젝트 폴더의 <code className="rounded bg-stone-100 px-1">.env.local</code>에 두 줄 추가: <code className="rounded bg-stone-100 px-1">KAMIS_CERT_KEY=발급받은키</code>,{" "}
          <code className="rounded bg-stone-100 px-1">KAMIS_CERT_ID=KAMIS아이디</code>
        </li>
        <li>서버를 다시 켜면 이 화면에 전국 도·소매 시세가 나와요 (배포했다면 배포 환경변수에도 같은 값)</li>
      </ol>
      <p className="mt-3 text-xs text-stone-500">KAMIS는 농림축산식품부·aT가 운영하는 공식 시세로, 매일 조사한 도매·소매 가격과 1개월·1년 전 가격을 함께 줍니다.</p>
    </Card>
  );
}

export default function PricesPage() {
  const skus = useAppStore((s) => s.skus);
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
  const linked = matchSkuPrices(skus, items);
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))];
  const monthRate = (i: KamisPrice) => changeRate(i.today, i.monthAgo);
  const rows = items
    .filter((i) => i.cls === cls && (!category || i.category === category) && i.name.includes(query.trim()))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : (sort === "up" ? -1 : 1) * ((monthRate(a) ?? 0) - (monthRate(b) ?? 0))));

  return (
    <>
      <PageHeader title="도매 시세" description="KAMIS 공식 시세로 공급가 인상을 미리 알아채세요. 도매가가 한 달 새 10% 넘게 오르면 공급처가 곧 단가를 올릴 가능성이 높아요." />

      {failed && <Notice tone="loss">{failed}</Notice>}
      {!data && !failed && <EmptyState>시세를 불러오는 중…</EmptyState>}
      {data?.missingKey && <SetupGuide />}
      {data?.error && !data.missingKey && <Notice tone="loss">{data.error}</Notice>}

      {items.length > 0 && (
        <div className="space-y-5">
          <Card title="내 상품과 같은 품목">
            {linked.length === 0 ? (
              <p className="text-sm text-stone-500">상품명에 KAMIS 품목명(예: 사과, 배, 감귤, 고구마)이 들어 있으면 자동으로 연결돼요.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>내 상품</th>
                    <th>KAMIS 도매 품목</th>
                    <th className="text-right">최근가</th>
                    <th className="text-right">1개월 전 대비</th>
                    <th className="text-right">1년 전 대비</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {linked.map(({ sku, price, monthChange }) => (
                    <tr key={sku.id}>
                      <td>
                        {sku.productName} <span className="text-xs text-stone-400">{sku.optionName}</span>
                      </td>
                      <td className="text-xs text-stone-600">
                        {price.name} ({price.unit})
                      </td>
                      <td className="text-right tabular-nums">{num(price.today ?? 0)}원</td>
                      <td className="text-right">
                        <Change rate={monthChange} />
                      </td>
                      <td className="text-right">
                        <Change rate={changeRate(price.today, price.yearAgo)} />
                      </td>
                      <td className="whitespace-nowrap text-right">
                        {(monthChange ?? 0) >= PRICE_ALERT_RATE && (
                          <Link href="/margin?tab=board" className="text-xs font-medium text-rose-600 hover:underline">
                            인상 대비 마진 점검 →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card
            title={`전체 시세 ${rows.length}개`}
            actions={<span className="text-xs text-stone-400">조사일 {items.find((i) => i.latestDate)?.latestDate ?? "-"}</span>}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Tabs tabs={CLS_TABS} value={cls} onChange={setCls} />
              <Select className="w-auto!" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="부류">
                <option value="">전체 부류</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Select className="w-auto!" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬">
                <option value="up">한 달 새 많이 오른 순</option>
                <option value="down">한 달 새 많이 내린 순</option>
                <option value="name">이름순</option>
              </Select>
              <TextInput className="w-40!" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="품목 검색" aria-label="품목 검색" />
            </div>
            <div className="max-h-[32rem] overflow-y-auto">
              <Table>
                <thead>
                  <tr>
                    <th>품목</th>
                    <th>부류</th>
                    <th>단위</th>
                    <th className="text-right">최근가</th>
                    <th className="text-right">전일 대비</th>
                    <th className="text-right">1개월 전 대비</th>
                    <th className="text-right">1년 전 대비</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={`${i.cls}:${i.category}:${i.name}:${i.unit}`}>
                      <td>
                        {i.name} {(monthRate(i) ?? 0) >= PRICE_ALERT_RATE && <Badge tone="loss">급등</Badge>}
                      </td>
                      <td className="text-xs text-stone-500">{i.category}</td>
                      <td className="text-xs text-stone-500">{i.unit}</td>
                      <td className="text-right tabular-nums">{i.today ? `${num(i.today)}원` : "-"}</td>
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
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
