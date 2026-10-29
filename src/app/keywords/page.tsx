"use client";

import { Suspense, useEffect, useMemo, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeywordReportView } from "@/components/keyword/KeywordReportView";
import { keywordHref, useKeywordReport } from "@/components/keyword/shared";
import { stagger } from "@/components/motion";
import { SEASON_ITEMS } from "@/lib/data/season";
import { normalizeKeyword } from "@/lib/keyword";
import { seasonStatus } from "@/lib/season";
import { useAppStore } from "@/store/useAppStore";

export default function KeywordsPage() {
  return (
    <Suspense fallback={<div className="h-72 animate-pulse rounded-3xl bg-[#07140f]/90" />}>
      <KeywordsView />
    </Suspense>
  );
}

function KeywordsView() {
  const router = useRouter();
  const keyword = normalizeKeyword(useSearchParams().get("q"));
  const { data, error, loading } = useKeywordReport(keyword);

  const recentKeywords = useAppStore((s) => s.recentKeywords);
  const addRecentKeyword = useAppStore((s) => s.addRecentKeyword);
  const clearRecentKeywords = useAppStore((s) => s.clearRecentKeywords);

  const inSeason = useMemo(() => {
    const today = new Date();
    return SEASON_ITEMS.filter((i) => seasonStatus(i, today).inSeason).map((i) => i.searchKeyword ?? i.name);
  }, []);

  useEffect(() => {
    if (data) addRecentKeyword(data.keyword);
  }, [data, addRecentKeyword]);

  const analyze = (q: string) => {
    const next = normalizeKeyword(q);
    if (!next) return;
    router.push(keywordHref(next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    analyze(new FormData(e.currentTarget).get("q") as string);
  };

  const chips = recentKeywords.length > 0 ? recentKeywords : inSeason;

  return (
    <div className="space-y-6">
      <section className="relative animate-fade-up overflow-hidden rounded-3xl bg-[#07140f] p-8 text-white shadow-2xl md:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 animate-float rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-96 animate-float rounded-full bg-amber-400/10 blur-3xl [animation-delay:-7s]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[48px_48px]" />

        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-amber-300/80">Wingsfarm AI Keyword Lab</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">어떤 키워드로 팔까</h1>
          <p className="mt-2 text-sm text-white/50">월간 검색수 · 클릭률 · 광고 경쟁 · 연관/황금 키워드 · 고객층 · 검색 시즌을 한 번에</p>

          <form key={keyword} onSubmit={submit} className="mt-8 flex gap-2 rounded-2xl border border-white/15 bg-white/5 p-2 backdrop-blur transition focus-within:border-amber-300/60 focus-within:bg-white/10">
            <input
              name="q"
              defaultValue={keyword}
              placeholder="분석할 키워드를 입력하세요 (예: 과메기, 제주 감귤)"
              className="min-w-0 flex-1 bg-transparent px-4 text-lg text-white outline-none placeholder:text-white/30"
              autoFocus={!keyword}
            />
            <button type="submit" className="rounded-xl bg-amber-300 px-6 py-3 font-bold text-[#07140f] transition hover:bg-amber-200 hover:shadow-[0_0_24px_rgba(252,211,77,0.45)]">
              분석
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white/40">{recentKeywords.length > 0 ? "최근 검색" : "지금 제철"}</span>
            {chips.map((k, i) => (
              <button
                key={k}
                type="button"
                onClick={() => analyze(k)}
                className={`animate-fade-up rounded-full border px-3 py-1 transition hover:border-amber-300/60 hover:text-white ${k === keyword ? "border-amber-300/60 bg-amber-300/10 text-amber-200" : "border-white/10 text-white/70"}`}
                style={stagger(i, 200, 30)}
              >
                {k}
              </button>
            ))}
            {recentKeywords.length > 0 && (
              <button type="button" onClick={clearRecentKeywords} className="text-xs text-white/30 hover:text-white/60">
                지우기
              </button>
            )}
          </div>
        </div>
      </section>

      {!keyword ? (
        <FeatureIntro />
      ) : error ? (
        <div className="rounded-2xl bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      ) : loading || !data ? (
        <ReportSkeleton keyword={keyword} />
      ) : (
        <KeywordReportView key={data.keyword} report={data} onAnalyze={analyze} />
      )}
    </div>
  );
}

const FEATURES = [
  ["월간 검색수", "PC·모바일 검색량과 모바일 비중"],
  ["클릭률·광고 경쟁", "구매 의도와 광고비 경쟁이 얼마나 센지"],
  ["연관·황금 키워드", "검색은 많은데 광고 경쟁은 낮은 키워드 발굴"],
  ["상품명 조합", "연관 키워드 수식어로 상품명 만들기"],
  ["고객층", "성별·연령·기기별 클릭 비중"],
  ["검색 시즌", "1년 중 언제 가장 많이 찾는지"],
];

function FeatureIntro() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map(([title, desc], i) => (
        <div key={title} className="animate-fade-up rounded-2xl border border-stone-200 bg-white p-5" style={stagger(i, 150)}>
          <p className="font-bold text-stone-900">{title}</p>
          <p className="mt-1 text-sm text-stone-500">{desc}</p>
        </div>
      ))}
    </div>
  );
}

function ReportSkeleton({ keyword }: { keyword: string }) {
  return (
    <div className="space-y-6">
      <p className="text-center text-sm text-stone-400">
        <b className="text-stone-600">{keyword}</b> 분석 중…
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-200/60" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-3xl bg-stone-200/60" />
    </div>
  );
}
