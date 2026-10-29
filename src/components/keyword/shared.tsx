"use client";

import { useEffect, useState, type ReactNode } from "react";
import { stagger } from "@/components/motion";
import { num } from "@/lib/format";
import type { KeywordReport, KeywordTrends } from "@/lib/keyword";

export const keywordHref = (keyword: string) => `/keywords?q=${encodeURIComponent(keyword)}`;

/** 검색광고 API는 10 미만을 "< 10"으로 줘서 0으로 저장해 둔다 */
export const volumeText = (n: number) => (n === 0 ? "< 10" : num(n));

/** keyword가 바뀔 때마다 분석 리포트를 불러온다 (응답이 늦게 온 이전 키워드 결과는 버린다) */
export function useKeywordReport(keyword: string) {
  const [result, setResult] = useState<{ keyword: string; data?: KeywordReport; error?: string }>({ keyword: "" });

  useEffect(() => {
    if (!keyword) return;
    const controller = new AbortController();
    fetch(`/api/keyword?q=${encodeURIComponent(keyword)}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setResult({ keyword, data: json });
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setResult({ keyword, error: err.message || "분석을 불러오지 못했습니다." });
      });
    return () => controller.abort();
  }, [keyword]);

  const current = result.keyword === keyword ? result : { keyword };
  return { data: current.data ?? null, error: current.error ?? "", loading: !!keyword && !current.data && !current.error };
}

/**
 * 보이는 키워드의 12개월 추이만 불러온다. 이미 받은 키워드는 다시 요청하지 않아
 * 정렬·더보기를 해도 새로 나타난 키워드만 추가 조회된다.
 */
export function useKeywordTrends(keywords: string[]) {
  const [series, setSeries] = useState<Record<string, number[] | null>>({});
  const [periods, setPeriods] = useState<string[]>([]);
  const missing = keywords.filter((k) => !(k in series));
  const missingKey = missing.join("\n");

  useEffect(() => {
    if (!missingKey) return;
    const targets = missingKey.split("\n");
    const controller = new AbortController();
    const params = new URLSearchParams(targets.map((k) => ["k", k]));
    fetch(`/api/keyword/trends?${params}`, { signal: controller.signal })
      .then((res) => res.json() as Promise<KeywordTrends>)
      .then((json) => {
        if (json.periods) setPeriods(json.periods);
        setSeries((prev) => ({ ...prev, ...Object.fromEntries(targets.map((k) => [k, json.series?.[k] ?? null])) }));
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setSeries((prev) => ({ ...prev, ...Object.fromEntries(targets.map((k) => [k, null])) }));
      });
    return () => controller.abort();
  }, [missingKey]);

  return { series, periods, loading: (k: string) => !(k in series) };
}

export function Panel({ index, title, subtitle, aside, children }: { index: number; title: string; subtitle: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section
      className="animate-fade-up rounded-3xl border border-stone-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.08)]"
      style={stagger(index, 150, 80)}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-stone-900">{title}</h2>
          <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

const AD_COMPETITION_CLASS: Record<string, string> = {
  낮음: "bg-emerald-50 text-emerald-700",
  중간: "bg-amber-50 text-amber-700",
  높음: "bg-rose-50 text-rose-700",
};

/** 검색광고 입찰 경쟁 정도 (높을수록 광고비를 쓰는 판매자가 많다) */
export function AdCompetitionBadge({ level }: { level: string | undefined }) {
  if (!level) return <span className="text-stone-300">–</span>;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${AD_COMPETITION_CLASS[level] ?? "bg-stone-100 text-stone-600"}`}>{level}</span>;
}

const SETUP_GUIDE: Record<KeywordReport["notices"][number]["service"], { title: string; steps: string[]; link: string }> = {
  searchad: {
    title: "네이버 검색광고 API 연결 (무료)",
    steps: [
      "네이버 검색광고(searchad.naver.com) 가입 → 광고 집행 없이도 발급 가능",
      "도구 > API 사용 관리 > 네이버 검색광고 API 서비스 신청",
      "액세스 라이선스·비밀키·CUSTOMER_ID를 .env.local의 NAVER_AD_API_KEY, NAVER_AD_SECRET_KEY, NAVER_AD_CUSTOMER_ID에 입력 후 서버 재시작",
    ],
    link: "https://searchad.naver.com",
  },
  datalab: {
    title: "네이버 데이터랩 연결",
    steps: ["네이버 개발자센터 > 내 애플리케이션 > API 설정", "사용 API에 '데이터랩(쇼핑인사이트)' 추가"],
    link: "https://developers.naver.com/apps/#/list",
  },
};

export function ApiNotices({ notices }: { notices: KeywordReport["notices"] }) {
  if (notices.length === 0) return null;
  const services = [...new Set(notices.map((n) => n.service))];
  return (
    <section className="animate-fade-up rounded-3xl border border-amber-200 bg-linear-to-r from-amber-50 to-white p-6">
      <h2 className="font-bold text-stone-900">일부 데이터가 연결되지 않았어요</h2>
      <ul className="mt-1 space-y-0.5 text-sm text-stone-600">
        {notices.map((n) => (
          <li key={n.message}>· {n.message}</li>
        ))}
      </ul>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {services.map((service) => {
          const guide = SETUP_GUIDE[service];
          return (
            <div key={service} className="rounded-2xl border border-stone-200 bg-white p-4">
              <a href={guide.link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-700 hover:underline">
                {guide.title} ↗
              </a>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-stone-500">
                {guide.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
