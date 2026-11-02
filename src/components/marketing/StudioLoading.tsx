"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { MARKETING_FORMAT_META, type MarketingFormat } from "@/lib/marketingAi";
import { STUDIO_TONE } from "./studioUi";

const LOADING_COPY: Record<MarketingFormat, { title: string; beats: string[] }> = {
  shorts: {
    title: "컷을 나누고 자막 타이밍을 맞추는 중…",
    beats: ["첫 3초 후킹 잡는 중", "장면 타임라인 배치", "자막 호흡 다듬기"],
  },
  threads: {
    title: "첫 줄을 벼리는 중…",
    beats: ["스크롤 스톱 한 줄", "이어질 이야기 뼈대", "마지막 CTA 조율"],
  },
  carousel: {
    title: "장표 리듬과 아트디렉션을 잡는 중…",
    beats: ["표지 임팩트 잡기", "중간 장 메시지 배치", "색·타이포 톤 맞추기"],
  },
  blog: {
    title: "소제목과 문단 호흡을 맞추는 중…",
    beats: ["검색 제목 다듬기", "소제목 뼈대 잡기", "본문·사진 자리 배치"],
  },
  review: {
    title: "상황에 맞는 답글을 고르는 중…",
    beats: ["톤 맞추기", "답글 버전 고르기", "금칙어 한 번 더 점검"],
  },
  chat: {
    title: "짧은 메시지를 다듬는 중…",
    beats: ["채널별 길이 맞추기", "핵심만 남기기", "따뜻한 마무리"],
  },
  live: {
    title: "분 단위 진행표를 짜는 중…",
    beats: ["오프닝 후킹", "구간별 목표 잡기", "클로징 CTA"],
  },
  ads: {
    title: "15자·45자 소재를 다듬는 중…",
    beats: ["제목 글자수 맞추기", "설명 한 줄 압축", "클릭 유도 키워드"],
  },
};

function LoadingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-current animate-mk-dot"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}

function ShortsScene() {
  return (
    <div className="relative mx-auto w-28">
      <div className="aspect-[9/16] overflow-hidden rounded-[1.35rem] bg-linear-to-br from-rose-500 via-orange-500 to-amber-400 p-1.5 shadow-xl shadow-orange-300/40 ring-4 ring-white/70">
        <div className="relative flex h-full flex-col justify-between rounded-[1.05rem] bg-stone-950/90 p-3">
          <div className="flex items-center justify-between text-[9px] text-white/50">
            <span>0:00</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">REC</span>
          </div>
          <div className="space-y-2">
            {[72, 48, 60].map((w, i) => (
              <div
                key={i}
                className="h-2 rounded-full bg-white/25"
                style={{ width: `${w}%`, animation: `mk-type 1.5s ease-in-out ${i * 0.18}s infinite` }}
              />
            ))}
          </div>
          <div className="space-y-1.5">
            <div className="flex gap-1">
              {[40, 70, 55, 85, 45].map((h, i) => (
                <div
                  key={i}
                  className="h-8 flex-1 origin-bottom rounded-sm bg-orange-400/80 animate-mk-wave"
                  style={{ height: `${h}%`, minHeight: 8, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-full origin-left rounded-full bg-orange-400 animate-mk-scrub" />
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -right-3 top-8 grid size-9 place-items-center rounded-full bg-white text-lg shadow-md animate-bob">
        🎬
      </div>
    </div>
  );
}

function ThreadsScene() {
  return (
    <div className="relative mx-auto w-56 space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm animate-mk-rise"
          style={{ animationDelay: `${i * 0.35}s` }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="size-6 rounded-full bg-stone-900" />
            <span className="h-2 w-16 rounded-full bg-stone-200" />
          </div>
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-stone-100" style={{ width: `${88 - i * 12}%` }} />
            <div className="h-2 rounded-full bg-stone-100" style={{ width: `${64 - i * 8}%` }} />
          </div>
        </div>
      ))}
      <div className="absolute -left-2 bottom-4 text-2xl animate-bob">🧵</div>
    </div>
  );
}

function CarouselScene() {
  return (
    <div className="relative mx-auto h-44 w-44">
      {[-14, 0, 14].map((rot, i) => (
        <div
          key={rot}
          className="absolute left-1/2 top-1/2 h-36 w-28 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 via-fuchsia-500 to-rose-400 shadow-lg ring-2 ring-white animate-mk-fan"
          style={
            {
              "--mk-r": `${rot}deg`,
              zIndex: i + 1,
              marginLeft: i * 10,
              animationDelay: `${i * 0.12}s`,
            } as CSSProperties
          }
        >
          <div className="flex h-full flex-col justify-end p-3 text-white">
            <div className="mb-2 h-2 w-10 rounded-full bg-white/40" />
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-white/50" />
              <div className="h-1.5 w-2/3 rounded-full bg-white/35" />
            </div>
          </div>
        </div>
      ))}
      <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1.5 rounded-full bg-fuchsia-400 animate-mk-dot"
            style={{ width: i === 1 ? 18 : 6, animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function BlogScene() {
  return (
    <div className="relative mx-auto w-60 overflow-hidden rounded-2xl border border-emerald-100 bg-white p-4 shadow-md">
      <div className="mb-3 h-20 overflow-hidden rounded-xl bg-linear-to-r from-emerald-700 to-teal-500">
        <div className="h-full w-full bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.25)_50%,transparent_70%)] bg-[length:200%_100%] animate-shimmer" />
      </div>
      <div className="space-y-2.5">
        {[92, 100, 78, 88, 64].map((w, i) => (
          <div
            key={i}
            className="h-2.5 rounded-full bg-emerald-100 animate-mk-type"
            style={{ width: `${w}%`, animationDelay: `${i * 0.14}s`, maxWidth: "100%" }}
          />
        ))}
      </div>
      <div className="absolute -right-1 top-6 text-2xl animate-bob">✍️</div>
    </div>
  );
}

function ReviewScene() {
  return (
    <div className="relative mx-auto flex w-56 flex-col gap-3">
      {["칭찬 답글", "클레임 케어", "리뷰 요청"].map((label, i) => (
        <div
          key={label}
          className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm animate-mk-rise ${
            i % 2 === 0 ? "self-start bg-sky-100 text-sky-900" : "self-end bg-indigo-100 text-indigo-900"
          }`}
          style={{ animationDelay: `${i * 0.4}s` }}
        >
          <p className="text-[10px] font-semibold opacity-60">{label}</p>
          <div className="mt-1 flex gap-0.5 text-amber-400">
            {Array.from({ length: 5 - (i % 2) }).map((_, j) => (
              <span key={j} className="animate-mk-dot" style={{ animationDelay: `${j * 0.08 + i * 0.2}s` }}>
                ★
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="absolute -right-1 bottom-2 text-2xl animate-bob">💬</div>
    </div>
  );
}

function ChatScene() {
  return (
    <div className="relative mx-auto w-52 rounded-[1.5rem] border border-teal-100 bg-white p-3 shadow-md">
      <div className="mb-3 flex items-center gap-2 border-b border-stone-100 pb-2">
        <span className="size-7 rounded-full bg-linear-to-br from-cyan-500 to-emerald-500" />
        <span className="h-2 w-20 rounded-full bg-stone-200" />
      </div>
      <div className="space-y-2">
        <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-md bg-teal-500 px-3 py-2 animate-mk-rise">
          <div className="h-1.5 w-16 rounded-full bg-white/70" />
        </div>
        <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-stone-100 px-3 py-2 animate-mk-rise" style={{ animationDelay: "0.35s" }}>
          <div className="h-1.5 w-20 rounded-full bg-stone-300" />
          <div className="mt-1 h-1.5 w-12 rounded-full bg-stone-200" />
        </div>
        <div className="ml-auto flex max-w-[70%] items-center gap-1 rounded-2xl rounded-br-md bg-teal-500/90 px-3 py-2 animate-mk-rise" style={{ animationDelay: "0.7s" }}>
          <LoadingDots />
        </div>
      </div>
      <div className="absolute -left-2 top-8 text-2xl animate-bob">📱</div>
    </div>
  );
}

function LiveScene() {
  return (
    <div className="relative mx-auto w-60 overflow-hidden rounded-2xl bg-stone-950 p-4 text-white shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold tracking-wide">
          <span className="size-1.5 animate-ping rounded-full bg-white" />
          LIVE
        </span>
        <span className="text-[10px] text-white/50">12:04</span>
      </div>
      <div className="mb-4 flex h-16 items-end justify-center gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <span
            key={i}
            className="w-2 origin-bottom rounded-full bg-linear-to-t from-rose-500 to-pink-300 animate-mk-wave"
            style={{ height: `${30 + ((i * 17) % 50)}%`, minHeight: 10, animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        {["오프닝", "상품 소개", "특가 CTA"].map((label, i) => (
          <div key={label} className="flex items-center gap-2 text-[10px] text-white/70">
            <span className="w-10 tabular-nums text-rose-300">{`${i * 3}`.padStart(2, "0")}:00</span>
            <span
              className="h-1.5 flex-1 rounded-full bg-white/15 overflow-hidden"
            >
              <span
                className="block h-full rounded-full bg-rose-400 animate-mk-scrub"
                style={{ animationDelay: `${i * 0.25}s` }}
              />
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="absolute -right-1 top-10 text-2xl animate-bob">📡</div>
    </div>
  );
}

function AdsScene() {
  const [chars, setChars] = useState(0);
  useEffect(() => {
    let n = 0;
    const id = window.setInterval(() => {
      n = n >= 15 ? 0 : n + 1;
      setChars(n);
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto w-56 space-y-3">
      <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-md animate-mk-rise">
        <p className="text-[10px] font-semibold tracking-wide text-indigo-500 uppercase">광고 제목</p>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="h-3 flex-1 overflow-hidden rounded-md bg-indigo-50">
            <div
              className="h-full rounded-md bg-linear-to-r from-blue-600 to-violet-500 transition-[width] duration-100 ease-out"
              style={{ width: `${(chars / 15) * 100}%` }}
            />
          </div>
          <span className="tabular-nums text-xs font-bold text-indigo-700">{chars}/15</span>
        </div>
        <p className="mt-3 text-[10px] font-semibold tracking-wide text-indigo-400 uppercase">설명</p>
        <div className="mt-2 space-y-1.5">
          <div className="h-2 w-full rounded-full bg-indigo-100 animate-mk-type" />
          <div className="h-2 w-4/5 rounded-full bg-indigo-50 animate-mk-type" style={{ animationDelay: "0.2s" }} />
        </div>
      </div>
      <div className="absolute -right-2 -top-2 grid size-10 place-items-center rounded-full bg-linear-to-br from-blue-600 to-violet-500 text-lg text-white shadow-lg animate-bob">
        📢
      </div>
    </div>
  );
}

const SCENES: Record<MarketingFormat, () => ReactNode> = {
  shorts: ShortsScene,
  threads: ThreadsScene,
  carousel: CarouselScene,
  blog: BlogScene,
  review: ReviewScene,
  chat: ChatScene,
  live: LiveScene,
  ads: AdsScene,
};

export function StudioLoading({ format }: { format: MarketingFormat }) {
  const copy = LOADING_COPY[format];
  const Scene = SCENES[format];
  const meta = MARKETING_FORMAT_META[format];
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setBeat((b) => (b + 1) % copy.beats.length);
    }, 1800);
    return () => clearInterval(id);
  }, [copy.beats.length]);

  return (
    <div
      className={`flex min-h-[28rem] flex-col items-center justify-center gap-6 overflow-hidden rounded-3xl bg-linear-to-br ${STUDIO_TONE[format].empty} px-6 py-10 text-center`}
      role="status"
      aria-live="polite"
      aria-label={copy.title}
    >
      <div className="w-full max-w-sm animate-fade-in">
        <Scene />
      </div>

      <div className="space-y-2">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
          <span className={`grid size-6 place-items-center rounded-full bg-linear-to-br ${meta.accent} text-sm text-white shadow`}>
            <span aria-hidden>{meta.icon}</span>
          </span>
          {meta.studio}
        </p>
        <p className="text-sm font-semibold text-stone-800 sm:text-base">{copy.title}</p>
        <p
          key={beat}
          className="flex items-center justify-center gap-2 text-xs text-stone-500 animate-fade-in"
        >
          {copy.beats[beat]}
          <span className="text-stone-400">
            <LoadingDots />
          </span>
        </p>
      </div>
    </div>
  );
}
