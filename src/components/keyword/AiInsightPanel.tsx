"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RobotAvatar } from "@/components/RobotAvatar";
import { stagger } from "@/components/motion";
import { CopyButton } from "@/components/ui";
import { insightToText, type KeywordInsight, type Verdict } from "@/lib/keywordAi";

/** "AI 분석" 버튼 + 누르면 오른쪽에서 나오는 AI 패널 */
export function AiInsightLauncher({ keyword, context = "", className = "" }: { keyword: string; context?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-linear-to-r from-[#07140f] via-emerald-900 to-[#07140f] py-2 pl-2 pr-5 text-sm font-bold text-amber-200 shadow-lg ring-1 ring-amber-300/40 transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(16,185,129,0.35)] ${className}`}
      >
        <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/25 to-transparent transition-all duration-700 group-hover:left-full" />
        <span className="grid size-8 place-items-center rounded-full bg-white/10">
          <RobotAvatar size={24} />
        </span>
        AI 분석
      </button>
      {open && createPortal(<AiInsightPanel keyword={keyword} context={context} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function useAiInsight(keyword: string, context: string) {
  const [result, setResult] = useState<{ data?: KeywordInsight; error?: string }>({});
  const [pending, setPending] = useState(true);
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(
    (refresh: boolean) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      fetch("/api/keyword/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, context, refresh }),
        signal: controller.signal,
      })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error);
          setResult({ data: json });
        })
        .catch((err: Error) => {
          if (err.name !== "AbortError") setResult({ error: err.message || "AI 분석에 실패했습니다." });
        })
        .finally(() => {
          if (!controller.signal.aborted) setPending(false);
        });
    },
    [keyword, context],
  );

  useEffect(() => {
    run(false);
    return () => controllerRef.current?.abort();
  }, [run]);

  const refresh = () => {
    setPending(true);
    setResult({});
    run(true);
  };

  return { ...result, pending, refresh };
}

function AiInsightPanel({ keyword, context, onClose }: { keyword: string; context: string; onClose: () => void }) {
  const { data, error, pending, refresh } = useAiInsight(keyword, context);

  useEffect(() => {
    // 캡처 단계에서 먼저 받아, 뒤에 열린 팝업까지 Esc로 함께 닫히지 않게 한다
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <aside
      className="fixed inset-y-0 right-0 z-60 flex w-full max-w-md animate-slide-in-right flex-col bg-stone-50 shadow-[-24px_0_60px_-12px_rgba(0,0,0,0.35)]"
      onClick={(e) => e.stopPropagation()}
      aria-label={`${keyword} AI 분석`}
    >
      <header className="relative overflow-hidden bg-[#07140f] px-6 pb-5 pt-6 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 animate-float rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="grid size-14 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
            <RobotAvatar size={44} thinking={pending} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-amber-300/80">Wings AI</p>
            <p className="mt-1 truncate text-xl font-bold">&lsquo;{keyword}&rsquo; 분석 리포트</p>
            <p className="mt-0.5 text-xs text-white/50">네이버 검색·쇼핑 데이터 기반</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid size-9 place-items-center rounded-full bg-white/10 text-white/70 transition hover:rotate-90 hover:bg-white/20 hover:text-white"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {pending ? (
          <Thinking />
        ) : error ? (
          <Bubble index={0}>
            <p className="text-sm text-rose-600">{error}</p>
          </Bubble>
        ) : (
          data && <InsightBody data={data} />
        )}
      </div>

      {data && !pending && (
        <footer className="flex items-center justify-between gap-2 border-t border-stone-200 bg-white px-5 py-3">
          <button type="button" onClick={refresh} className="rounded-lg px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100">
            ↻ 다시 분석
          </button>
          <CopyButton text={insightToText(keyword, data)} label="전체 복사" />
        </footer>
      )}
    </aside>
  );
}

const THINKING_STEPS = ["검색량 데이터 읽는 중", "고객층 살펴보는 중", "연관 키워드 훑어보는 중", "시즌 흐름 계산하는 중", "후킹 포인트 뽑는 중", "상품명 다듬는 중"];

function Thinking() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1)), 2200);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="space-y-3">
      {THINKING_STEPS.slice(0, step + 1).map((label, i) => (
        <div key={label} className="flex animate-fade-up items-center gap-3 text-sm">
          {i < step ? (
            <span className="grid size-5 place-items-center rounded-full bg-emerald-500 text-[10px] text-white">✓</span>
          ) : (
            <span className="flex size-5 items-center justify-center gap-0.5">
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-1 animate-bounce rounded-full bg-emerald-600" style={{ animationDelay: `${d * 150}ms` }} />
              ))}
            </span>
          )}
          <span className={i < step ? "text-stone-400" : "font-medium text-stone-800"}>{label}…</span>
        </div>
      ))}
      <p className="pt-2 text-xs text-stone-400">꼼꼼히 분석하느라 30초~1분 정도 걸려요 · 한 번 분석한 키워드는 6시간 동안 바로 열려요</p>
    </div>
  );
}

/** 글자가 하나씩 타이핑되듯 나타난다 (text가 바뀌면 key로 다시 시작) */
function Typewriter({ text, speed = 28 }: { text: string; speed?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCount((c) => (c >= text.length ? c : c + 1)), speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return (
    <>
      {text.slice(0, count)}
      {count < text.length && <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-current align-middle" />}
    </>
  );
}

const VERDICT_CLASS: Record<Verdict, string> = {
  "강력 추천": "bg-emerald-600 text-white",
  추천: "bg-emerald-100 text-emerald-800",
  보통: "bg-amber-100 text-amber-800",
  신중: "bg-rose-100 text-rose-700",
};

function Bubble({ index, title, icon, aside, children }: { index: number; title?: string; icon?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="animate-fade-up rounded-2xl rounded-tl-md border border-stone-200 bg-white p-4 shadow-sm" style={stagger(index, 0, 140)}>
      {title && (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-stone-900">
            <span aria-hidden>{icon}</span>
            {title}
          </h3>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

function Chips({ items, tone = "stone" }: { items: string[]; tone?: "stone" | "emerald" }) {
  const cls = tone === "emerald" ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-700";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className={`rounded-full px-2.5 py-1 text-xs ${cls}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

function InsightBody({ data }: { data: KeywordInsight }) {
  return (
    <div className="space-y-3">
      <Bubble index={0}>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${VERDICT_CLASS[data.verdict]}`}>{data.verdict}</span>
        <p className="mt-2.5 text-lg font-bold leading-snug text-stone-900">
          <Typewriter key={data.headline} text={data.headline} />
        </p>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">{data.verdictReason}</p>
      </Bubble>

      <Bubble index={1} title="핵심 인사이트" icon="📊">
        <ol className="space-y-2">
          {data.insights.map((t, i) => (
            <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-stone-700">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
      </Bubble>

      <Bubble index={2} title="타깃 고객" icon="👥">
        <p className="mb-2 text-sm font-semibold text-stone-900">{data.target.persona}</p>
        <Chips items={data.target.needs} tone="emerald" />
      </Bubble>

      <Bubble index={3} title="후킹 포인트" icon="🎯" aside={<span className="text-[11px] text-stone-400">썸네일·상세 첫 화면용</span>}>
        <ul className="space-y-2">
          {data.hookingPoints.map((h) => (
            <li key={h.copy} className="group relative rounded-xl border-l-4 border-amber-400 bg-linear-to-r from-amber-50 to-white py-2.5 pl-3 pr-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-stone-900">&ldquo;{h.copy}&rdquo;</p>
                <span className="shrink-0 opacity-0 transition group-hover:opacity-100">
                  <CopyButton text={h.copy} />
                </span>
              </div>
              <p className="mt-0.5 text-xs text-stone-500">{h.why}</p>
            </li>
          ))}
        </ul>
      </Bubble>

      <Bubble index={4} title="셀링 포인트" icon="✅">
        <ul className="space-y-1.5">
          {data.sellingPoints.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-stone-700">
              <span className="text-emerald-600">✓</span>
              {t}
            </li>
          ))}
        </ul>
      </Bubble>

      <Bubble index={5} title="추천 상품명" icon="🏷️">
        <ul className="space-y-2">
          {data.productTitles.map((t) => (
            <li key={t} className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2">
              <span className="text-sm text-stone-800">{t}</span>
              <span className="flex shrink-0 items-center gap-1">
                <span className={`text-[11px] ${t.length > 50 ? "text-rose-500" : "text-stone-400"}`}>{t.length}자</span>
                <CopyButton text={t} />
              </span>
            </li>
          ))}
        </ul>
      </Bubble>

      <Bubble index={6} title="키워드 전략" icon="🔑" aside={<CopyButton text={data.keywords.tags.join(",")} label="태그 복사" />}>
        <p className="text-xs text-stone-400">메인</p>
        <p className="mb-2 text-base font-bold text-emerald-700">{data.keywords.main}</p>
        <p className="mb-1 text-xs text-stone-400">서브</p>
        <div className="mb-2">
          <Chips items={data.keywords.sub} tone="emerald" />
        </div>
        <p className="mb-1 text-xs text-stone-400">태그</p>
        <Chips items={data.keywords.tags} />
      </Bubble>

      <Bubble index={7} title="판매 타이밍" icon="🗓️">
        <p className="text-sm leading-relaxed text-stone-700">{data.timing}</p>
      </Bubble>

      <Bubble index={8} title="주의할 점" icon="⚠️">
        <ul className="space-y-1.5">
          {data.cautions.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-stone-700">
              <span className="text-amber-500">•</span>
              {t}
            </li>
          ))}
        </ul>
      </Bubble>
    </div>
  );
}
