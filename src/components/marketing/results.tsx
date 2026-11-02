"use client";

import { useState } from "react";
import { Button, CopyButton } from "@/components/ui";
import type { MarketingResult } from "@/lib/marketingAi";
import { Hashtags, TipList } from "./studioUi";

type Of<F extends MarketingResult["format"]> = Extract<MarketingResult, { format: F }>;
export type ImageStatus = "pending" | "done" | "error";

export interface ContentImages {
  /** 업로드한 상품 사진 (카드뉴스 표지·블로그 대표 사진 대체용) */
  productImage: string;
  /** 키 = 카드뉴스 장 번호 / 블로그 0=대표, 1~=섹션 */
  images: Record<number, string>;
  status: Record<number, ImageStatus>;
  onRetry: (key: number) => void;
}

const hashtagText = (caption: string, tags: string[]) => `${caption}\n\n${tags.map((h) => `#${h}`).join(" ")}`;

export function MarketingResultView({ result, media }: { result: MarketingResult; media: ContentImages }) {
  switch (result.format) {
    case "shorts":
      return <ShortsStudio data={result} />;
    case "threads":
      return <ThreadsStudio data={result} />;
    case "carousel":
      return <CarouselStudio data={result} media={media} />;
    case "blog":
      return <BlogStudio data={result} media={media} />;
    case "review":
      return <ReviewStudio data={result} />;
    case "chat":
      return <ChatStudio data={result} />;
    case "live":
      return <LiveStudio data={result} />;
    case "ads":
      return <AdsStudio data={result} />;
  }
}

function ShortsStudio({ data }: { data: Of<"shorts"> }) {
  return (
    <div className="space-y-5">
      <div className="relative mx-auto w-full max-w-[280px]">
        <div className="absolute -inset-3 rounded-[2rem] bg-linear-to-b from-rose-200/40 to-amber-100/30 blur-xl" />
        <div className="relative overflow-hidden rounded-[1.75rem] border-[6px] border-stone-900 bg-stone-950 shadow-2xl">
          <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-stone-700" />
          <div className="space-y-3 p-4 pb-6 text-white">
            <p className="text-[10px] tracking-[0.3em] text-rose-300 uppercase">Hook · 0–3s</p>
            <p className="text-xl font-black leading-snug">{data.hook}</p>
            <p className="text-xs text-white/50">{data.title}</p>
            <div className="flex gap-2 text-[10px] text-white/40">
              <span>{data.durationSec}s</span>
              <span>·</span>
              <span>{data.musicMood}</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-stone-500">템포 · {data.pacing}</p>

      <ol className="relative space-y-0 border-l-2 border-rose-200 pl-6">
        {data.scenes.map((s, i) => (
          <li key={s.time + i} className="relative pb-6">
            <span className="absolute -left-[1.55rem] top-1 size-3 rounded-full border-2 border-white bg-rose-500 shadow" />
            <p className="text-[11px] font-bold tracking-wide text-rose-600 uppercase">{s.time}</p>
            <div className="mt-2 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-stone-800">
                <span className="font-semibold text-stone-400">CAM </span>
                {s.visual}
              </p>
              <p className="mt-2 text-sm text-stone-800">
                <span className="font-semibold text-stone-400">VO </span>
                {s.voice}
              </p>
              <p className="mt-2 rounded-lg bg-stone-900 px-3 py-2 text-center text-sm font-semibold text-amber-200">{s.onScreen}</p>
              {s.sfx && <p className="mt-2 text-xs text-stone-400">SFX · {s.sfx}</p>}
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl bg-linear-to-r from-stone-900 to-rose-950 p-4 text-white">
        <p className="text-xs text-white/50">CTA</p>
        <p className="mt-1 text-sm font-medium">{data.cta}</p>
        <div className="mt-3 flex items-start justify-between gap-2">
          <pre className="flex-1 whitespace-pre-wrap font-sans text-xs leading-relaxed text-white/70">{data.caption}</pre>
          <CopyButton text={hashtagText(data.caption, data.hashtags)} />
        </div>
        <div className="mt-3">
          <Hashtags tags={data.hashtags} />
        </div>
      </div>
      <TipList tips={data.tips} />
    </div>
  );
}

function ThreadsStudio({ data }: { data: Of<"threads"> }) {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl border border-stone-800 bg-[#0a0a0a] p-4 text-white">
        <p className="text-[11px] text-emerald-400/80">Threads · opener</p>
        <p className="mt-2 text-lg font-bold leading-snug">{data.hook}</p>
        <p className="mt-2 text-xs text-white/40">{data.voiceNote}</p>
      </div>

      <div className="space-y-3">
        {data.posts.map((p, i) => (
          <article key={i} className="relative rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            {i < data.posts.length - 1 && <span className="absolute top-full left-8 h-3 w-px bg-stone-200" aria-hidden />}
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-linear-to-br from-stone-800 to-emerald-800 text-xs font-bold text-white">{i + 1}</span>
              <span className="text-xs text-stone-400">포스트</span>
              <span className="ml-auto">
                <CopyButton text={p.text} />
              </span>
            </div>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800">{p.text}</p>
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-500">한 번에 붙여넣기</span>
          <CopyButton text={hashtagText(data.fullCopy, data.hashtags)} label="전체 복사" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.hashtags.map((h) => (
            <span key={h} className="rounded-full bg-stone-200/80 px-2 py-0.5 text-[11px] text-stone-600">
              #{h}
            </span>
          ))}
        </div>
      </div>
      <TipList tips={data.tips} />
    </div>
  );
}

function CarouselStudio({ data, media }: { data: Of<"carousel">; media: ContentImages }) {
  const { productImage, images, status, onRetry } = media;
  const [index, setIndex] = useState(0);
  const slide = data.slides[Math.min(index, data.slides.length - 1)];
  /** 1장(표지)은 따로 만든 이미지가 없으면 업로드한 상품 사진을 쓴다 */
  const imageFor = (n: number) => images[n] || (n === 1 ? productImage : "");
  const wantsImageFor = (s: { number: number; showImage?: boolean }) => Boolean(s.showImage) || (s.number === 1 && Boolean(productImage));
  const midImage = imageFor(slide.number);
  const wantsImage = wantsImageFor(slide);

  return (
    <div className="space-y-5">
      <p className="text-center text-xs tracking-wide text-violet-700/80">{data.artDirection}</p>

      <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[1.5rem] shadow-2xl ring-1 ring-black/10">
        <div className="absolute inset-0 bg-linear-to-br from-[#1a1025] via-violet-950 to-rose-900" />
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 0, transparent 40%)" }} />
        <div className="relative flex h-full flex-col p-6 text-white">
          <div className="shrink-0">
            <p className="text-[10px] tracking-[0.4em] text-fuchsia-200/70 uppercase">
              {slide.number} / {data.slides.length}
            </p>
            <h3 className="mt-3 font-serif text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{slide.headline}</h3>
          </div>

          {wantsImage && (
            <div className="relative my-4 min-h-0 flex-1 overflow-hidden rounded-2xl ring-1 ring-white/20">
              {midImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={midImage} alt="" className="h-full w-full object-cover" />
              ) : status[slide.number] === "pending" ? (
                <div className="flex h-full min-h-[140px] items-center justify-center bg-black/30 text-xs text-white/70">이미지 생성 중…</div>
              ) : (
                <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 bg-black/30 px-4 text-center text-xs text-white/70">
                  <p>{status[slide.number] === "error" ? "이미지 생성 실패" : "이미지 대기"}</p>
                  <button type="button" className="rounded-full bg-white/15 px-3 py-1 text-[11px] hover:bg-white/25" onClick={() => onRetry(slide.number)}>
                    {status[slide.number] === "error" ? "다시 생성" : "이 장만 만들기"}
                  </button>
                </div>
              )}
            </div>
          )}

          <p className={`whitespace-pre-wrap text-sm leading-relaxed text-white/75 ${wantsImage ? "shrink-0" : "mt-4 flex-1"}`}>{slide.body}</p>

          <div className="mt-auto space-y-2 rounded-xl bg-black/25 p-3 text-[11px] text-white/60 backdrop-blur-sm">
            <p>🎨 {slide.visual}</p>
            <p>🎛 {slide.colorNote}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          ←
        </Button>
        <div className="flex gap-1.5">
          {data.slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}장`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition ${i === index ? "w-8 bg-violet-600" : "w-2 bg-stone-300"}`}
            />
          ))}
        </div>
        <Button variant="ghost" disabled={index >= data.slides.length - 1} onClick={() => setIndex((i) => i + 1)}>
          →
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {data.slides.map((s, i) => {
          const src = imageFor(s.number);
          return (
            <button
              key={s.number}
              type="button"
              onClick={() => setIndex(i)}
              className={`rounded-xl border p-3 text-left transition ${i === index ? "border-violet-400 bg-violet-50" : "border-stone-200 hover:border-violet-200"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-violet-700">{s.number}장</p>
                {wantsImageFor(s) && (
                  <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-700">
                    {src ? "사진" : status[s.number] === "pending" ? "생성중" : "이미지"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-semibold text-stone-900">{s.headline}</p>
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="mt-2 h-16 w-full rounded-lg object-cover" />
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-stone-900 p-4 text-white">
        <p className="text-xs text-fuchsia-300/80">Closing CTA</p>
        <p className="mt-1 text-sm font-medium">{data.closingCta}</p>
        <div className="mt-3 flex justify-between gap-2">
          <pre className="whitespace-pre-wrap font-sans text-xs text-white/60">{data.caption}</pre>
          <CopyButton text={hashtagText(data.caption, data.hashtags)} />
        </div>
        <div className="mt-3">
          <Hashtags tags={data.hashtags} />
        </div>
      </div>
      <TipList tips={data.tips} />
    </div>
  );
}

function BlogImageSlot({ src, status, caption, onRetry }: { src?: string; status?: ImageStatus; caption?: string; onRetry: () => void }) {
  return (
    <figure className="overflow-hidden rounded-xl">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={caption || ""} className="aspect-[16/10] w-full object-cover" />
      ) : status === "pending" ? (
        <div className="flex aspect-[16/10] items-center justify-center bg-emerald-50 text-xs text-emerald-700/70">사진 생성 중…</div>
      ) : (
        <div
          className={`flex aspect-[16/10] flex-col items-center justify-center gap-2 px-4 text-center text-xs ${
            status === "error" ? "bg-rose-50 text-rose-700/80" : "bg-stone-100 text-stone-400"
          }`}
        >
          <p>{status === "error" ? "사진 생성 실패" : "사진 자리"}</p>
          <button
            type="button"
            className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-stone-700 ring-1 ring-stone-200 hover:ring-emerald-300"
            onClick={onRetry}
          >
            {status === "error" ? "다시 생성" : "이 사진만 만들기"}
          </button>
        </div>
      )}
      {caption ? <figcaption className="mt-1.5 text-center text-[11px] text-stone-500">{caption}</figcaption> : null}
    </figure>
  );
}

function BlogStudio({ data, media }: { data: Of<"blog">; media: ContentImages }) {
  const { productImage, images, status, onRetry } = media;
  const heroSrc = images[0] || productImage;

  return (
    <div className="space-y-6">
      <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <header className="bg-linear-to-r from-emerald-800 to-teal-600 px-5 py-6 text-white">
          <p className="text-[11px] tracking-[0.3em] text-white/60 uppercase">Blog</p>
          <h3 className="mt-1 text-2xl font-black leading-snug">{data.title}</h3>
          <p className="mt-2 text-sm text-white/80">{data.subtitle}</p>
        </header>
        <div className="space-y-5 p-5">
          <BlogImageSlot src={heroSrc} status={status[0]} caption="대표 사진" onRetry={() => onRetry(0)} />
          <p className="rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-500">
            <span className="font-semibold text-stone-600">메타 설명 · </span>
            {data.metaDescription}
          </p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{data.intro}</div>
          {data.sections.map((s, i) => (
            <section key={`${s.heading}-${i}`} className="space-y-3">
              <h4 className="text-lg font-bold text-emerald-900">{s.heading}</h4>
              {s.showImage && <BlogImageSlot src={images[i + 1]} status={status[i + 1]} caption={s.imageCaption || undefined} onRetry={() => onRetry(i + 1)} />}
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{s.body}</div>
            </section>
          ))}
        </div>
      </article>

      {data.faq.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold tracking-wide text-stone-500 uppercase">FAQ</p>
          {data.faq.map((f) => (
            <div key={f.q} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-semibold text-stone-900">Q. {f.q}</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">A. {f.a}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-emerald-950 p-4 text-white">
        <p className="text-xs text-emerald-300/80">CTA</p>
        <p className="mt-1 text-sm font-medium">{data.closingCta}</p>
        <div className="mt-3">
          <Hashtags tags={data.tags} />
        </div>
      </div>
      <TipList tips={data.tips} />
    </div>
  );
}

function CopyCard({ title, badge, text }: { title: string; badge?: string; text: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          {badge && <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">{badge}</span>}
          <p className={`text-sm font-bold text-stone-900 ${badge ? "mt-1" : ""}`}>{title}</p>
        </div>
        <CopyButton text={text} />
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{text}</p>
    </div>
  );
}

function ReviewStudio({ data }: { data: Of<"review"> }) {
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">{data.toneNote}</p>
      {data.replies.map((r) => (
        <CopyCard key={r.label} title={r.label} text={r.text} />
      ))}
      <TipList tips={data.tips} />
    </div>
  );
}

function ChatStudio({ data }: { data: Of<"chat"> }) {
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">{data.purposeNote}</p>
      {data.messages.map((m) => (
        <CopyCard key={`${m.channel}-${m.title}`} badge={m.channel} title={m.title} text={m.body} />
      ))}
      <TipList tips={data.tips} />
    </div>
  );
}

function LiveStudio({ data }: { data: Of<"live"> }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-linear-to-r from-red-600 to-pink-500 p-5 text-white">
        <p className="text-[11px] tracking-[0.3em] text-white/70 uppercase">Live · {data.durationMin}분</p>
        <h3 className="mt-1 text-2xl font-black">{data.title}</h3>
      </div>
      <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
        <p className="text-xs font-bold text-rose-700 uppercase">오프닝</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-stone-800">{data.opening}</p>
      </div>
      <div className="space-y-3">
        {data.segments.map((s) => (
          <div key={s.time} className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs font-bold text-rose-600">
              {s.time} · {s.goal}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-800">{s.script}</p>
            <p className="mt-2 text-xs text-stone-500">화면: {s.onScreen}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-stone-900 p-4 text-white">
        <p className="text-xs text-rose-300/80">클로징</p>
        <p className="mt-1 whitespace-pre-wrap text-sm">{data.closing}</p>
      </div>
      <TipList tips={data.tips} />
    </div>
  );
}

function AdsCopyList({ label, items, limit }: { label: string; items: { text: string; chars: number }[]; limit: number }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold tracking-wide text-stone-500 uppercase">
        {label} · {limit}자 이내
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.text} className="flex items-start justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm leading-relaxed text-stone-900">{item.text}</p>
              <p className={`mt-0.5 text-[11px] ${item.chars > limit ? "font-bold text-rose-600" : "text-stone-400"}`}>
                {item.chars}/{limit}자{item.chars > limit && " · 초과"}
              </p>
            </div>
            <CopyButton text={item.text} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AdsStudio({ data }: { data: Of<"ads"> }) {
  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900">{data.goalNote}</p>
      <AdsCopyList label="제목" items={data.headlines} limit={15} />
      <AdsCopyList label="설명" items={data.descriptions} limit={45} />
      <TipList tips={data.tips} />
    </div>
  );
}
