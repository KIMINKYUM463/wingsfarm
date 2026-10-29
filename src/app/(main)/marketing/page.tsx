"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { MoleculeHub } from "@/components/marketing/MoleculeHub";
import { StudioShell, type ImagePlan } from "@/components/marketing/StudioShell";
import type { ImageStatus } from "@/components/marketing/results";
import { ChipGroup, MemoField, ProductField, ProductImageUpload, STUDIO_TONE, Segmented, StudioModal } from "@/components/marketing/studioUi";
import { BRAND } from "@/lib/brand";
import { SEASON_ITEMS } from "@/lib/data/season";
import { toResizedDataUrl } from "@/lib/image";
import { tryPatchArchiveImage, trySaveArchive } from "@/lib/archive";
import {
  ADS_GOALS,
  BLOG_LENGTHS,
  BLOG_TONES,
  CAROUSEL_AUDIENCES,
  CAROUSEL_COUNTS,
  CAROUSEL_MOODS,
  CHAT_PURPOSES,
  DETAIL_FOCUSES,
  LIVE_DURATIONS,
  LIVE_DURATION_MAX,
  LIVE_DURATION_MIN,
  LIVE_STYLES,
  MARKETING_FORMATS,
  MARKETING_FORMAT_META,
  REVIEW_TYPES,
  SHORTS_DURATIONS,
  SHORTS_HOOKS,
  THREAD_LENGTHS,
  THREAD_STYLES,
  clampLiveDuration,
  marketingToText,
  type MarketingFormat,
  type MarketingResult,
} from "@/lib/marketingAi";
import { useAppStore } from "@/store/useAppStore";

const BLOG_ART_DIRECTION = "Naver blog editorial food photography, natural light, clean plate";

type ImageJob = { key: number; headline: string; imagePrompt: string; artDirection: string };

/**
 * AI가 사진을 넣자고 한 자리 목록.
 * 상품 사진을 올렸으면 카드뉴스 1장·블로그 대표 사진은 그 사진을 쓰므로 생성하지 않는다(요금 절약).
 */
function imageJobsFor(result: MarketingResult, hasProductImage: boolean): ImageJob[] {
  if (result.format === "carousel") {
    return result.slides
      .filter((s) => s.showImage && !(s.number === 1 && hasProductImage))
      .map((s) => ({ key: s.number, headline: s.headline, imagePrompt: s.imagePrompt, artDirection: result.artDirection }));
  }
  if (result.format === "blog") {
    const hero = hasProductImage ? [] : [{ key: 0, headline: result.title, imagePrompt: result.heroImagePrompt, artDirection: BLOG_ART_DIRECTION }];
    const sections = result.sections.flatMap((s, i) =>
      s.showImage ? [{ key: i + 1, headline: s.heading, imagePrompt: s.imagePrompt, artDirection: BLOG_ART_DIRECTION }] : [],
    );
    return [...hero, ...sections];
  }
  return [];
}

/** 콘텐츠 캘린더에서 /marketing?studio=shorts&note=... 로 들어오면 해당 스튜디오를 연다 (ClientOnly 아래라 window 사용 가능) */
const initialStudio = (): MarketingFormat | null => {
  const studio = new URLSearchParams(window.location.search).get("studio");
  return MARKETING_FORMATS.find((f) => f === studio) ?? null;
};

export default function MarketingPage() {
  const month = new Date().getMonth() + 1;
  const inSeason = useMemo(() => SEASON_ITEMS.filter((s) => s.months.includes(month)).slice(0, 10), [month]);

  const product = useAppStore((s) => s.workingProduct);
  const setProduct = useAppStore((s) => s.setWorkingProduct);
  const [open, setOpen] = useState<MarketingFormat | null>(initialStudio);
  const [note, setNote] = useState(() => new URLSearchParams(window.location.search).get("note")?.slice(0, 300) ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MarketingResult | null>(null);
  const archiveIdRef = useRef<string | null>(null);

  const [duration, setDuration] = useState<(typeof SHORTS_DURATIONS)[number]>(30);
  const [hookStyle, setHookStyle] = useState<(typeof SHORTS_HOOKS)[number]["id"]>("curiosity");
  const [onCamera, setOnCamera] = useState(false);
  const [threadStyle, setThreadStyle] = useState<(typeof THREAD_STYLES)[number]["id"]>("story");
  const [threadLength, setThreadLength] = useState<(typeof THREAD_LENGTHS)[number]>(7);
  const [slideCount, setSlideCount] = useState<(typeof CAROUSEL_COUNTS)[number]>(6);
  const [mood, setMood] = useState<(typeof CAROUSEL_MOODS)[number]["id"]>("editorial");
  const [audience, setAudience] = useState<(typeof CAROUSEL_AUDIENCES)[number]["id"]>("home");
  const [blogLength, setBlogLength] = useState<(typeof BLOG_LENGTHS)[number]>(1500);
  const [blogTone, setBlogTone] = useState<(typeof BLOG_TONES)[number]["id"]>("guide");
  const [detailFocus, setDetailFocus] = useState<(typeof DETAIL_FOCUSES)[number]["id"]>("fresh");
  const [reviewType, setReviewType] = useState<(typeof REVIEW_TYPES)[number]["id"]>("praise");
  const [chatPurpose, setChatPurpose] = useState<(typeof CHAT_PURPOSES)[number]["id"]>("ship");
  const [liveDuration, setLiveDuration] = useState(30);
  const [liveStyle, setLiveStyle] = useState<(typeof LIVE_STYLES)[number]["id"]>("warm");
  const [adsGoal, setAdsGoal] = useState<(typeof ADS_GOALS)[number]["id"]>("click");

  const [productImage, setProductImage] = useState("");
  const [images, setImages] = useState<Record<number, string>>({});
  const [imageStatus, setImageStatus] = useState<Record<number, ImageStatus>>({});

  const jobs = useMemo(() => (result ? imageJobsFor(result, Boolean(productImage)) : []), [result, productImage]);

  const resetResult = () => {
    setResult(null);
    setError("");
    setPending(false);
    setImages({});
    setImageStatus({});
    archiveIdRef.current = null;
  };

  const openStudio = (f: MarketingFormat) => {
    resetResult();
    setOpen(f);
  };

  const closeStudio = () => {
    resetResult();
    setOpen(null);
  };

  const onProductImageFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("이미지 파일(JPG·PNG·WebP)만 올릴 수 있어요.");
    try {
      setError("");
      setProductImage(await toResizedDataUrl(file, 1280, 0.88));
    } catch {
      setError("사진을 불러오지 못했습니다. JPG·PNG로 다시 올려 주세요.");
    }
  };

  const generateImage = async (job: ImageJob) => {
    const name = product.trim();
    const prompt = job.imagePrompt.trim() || `Photorealistic Korean farm produce photo of ${name}, appetizing, natural light, no text`;
    setImageStatus((prev) => ({ ...prev, [job.key]: "pending" }));
    try {
      const res = await fetch("/api/marketing/carousel-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: name,
          slideNumber: Math.min(12, Math.max(1, job.key || 1)),
          headline: job.headline,
          imagePrompt: prompt,
          artDirection: job.artDirection,
          ...(productImage ? { image: productImage } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "이미지 생성 실패");
      const src = json.image as string;
      setImages((prev) => ({ ...prev, [job.key]: src }));
      setImageStatus((prev) => ({ ...prev, [job.key]: "done" }));
      void tryPatchArchiveImage(archiveIdRef.current, job.key, src);
    } catch {
      setImageStatus((prev) => ({ ...prev, [job.key]: "error" }));
    }
  };

  const remainingJobs = jobs.filter((j) => !images[j.key] && imageStatus[j.key] !== "pending");

  const generateAllImages = async () => {
    for (const job of remainingJobs) await generateImage(job);
  };

  const retryImage = (key: number) => {
    const job = jobs.find((j) => j.key === key);
    if (job) void generateImage(job);
  };

  const imagePlan: ImagePlan | null = jobs.length
    ? {
        total: jobs.length,
        remaining: remainingJobs.length,
        running: jobs.filter((j) => imageStatus[j.key] === "pending").length,
        onGenerateAll: () => void generateAllImages(),
      }
    : null;

  const optionsByFormat: Record<MarketingFormat, object> = {
    shorts: { shorts: { duration, hookStyle, onCamera } },
    threads: { threads: { style: threadStyle, length: threadLength } },
    carousel: { carousel: { slides: slideCount, mood, audience } },
    blog: { blog: { length: blogLength, tone: blogTone } },
    detail: { detail: { focus: detailFocus } },
    review: { review: { type: reviewType } },
    chat: { chat: { purpose: chatPurpose } },
    live: { live: { duration: clampLiveDuration(liveDuration), style: liveStyle } },
    ads: { ads: { goal: adsGoal } },
  };

  const generate = async () => {
    if (!open) return;
    const name = product.trim();
    if (!name) return setError("상품을 입력해 주세요.");
    resetResult();
    setPending(true);
    const format = open;
    try {
      const res = await fetch("/api/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, product: name, note, ...optionsByFormat[format] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const marketing = json as MarketingResult;
      setResult(marketing);
      archiveIdRef.current = await trySaveArchive({
        kind: "marketing",
        title: MARKETING_FORMAT_META[format].title,
        product: name,
        text: marketingToText(marketing),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  const productField = (placeholder: string) => <ProductField product={product} setProduct={setProduct} inSeason={inSeason} placeholder={placeholder} />;
  const memo = (placeholder: string) => <MemoField value={note} onChange={setNote} placeholder={placeholder} />;
  const imageUpload = (hint: string) => (
    <ProductImageUpload productImage={productImage} onFile={(f) => void onProductImageFile(f)} onClear={() => setProductImage("")} hint={hint} />
  );

  const inputByFormat: Record<MarketingFormat, ReactNode> = {
    shorts: (
      <>
        {productField("예: 해남 절임배추 20kg")}
        <Segmented label="영상 길이" values={SHORTS_DURATIONS} value={duration} onChange={setDuration} suffix="초" />
        <ChipGroup label="첫 3초 후킹" options={SHORTS_HOOKS} value={hookStyle} onChange={setHookStyle} />
        <ChipGroup
          label="출연"
          options={[
            { id: "off", label: "얼굴 없이", hint: "손·상품·산지" },
            { id: "on", label: "얼굴 출연", hint: "토킹헤드 OK" },
          ]}
          value={onCamera ? "on" : "off"}
          onChange={(v) => setOnCamera(v === "on")}
        />
        {memo("촬영 장소, 강조 컷…")}
      </>
    ),
    threads: (
      <>
        {productField("예: 샤인머스캣 선물")}
        <ChipGroup label="글의 뼈대" options={THREAD_STYLES} value={threadStyle} onChange={setThreadStyle} />
        <Segmented label="포스트 수" values={THREAD_LENGTHS} value={threadLength} onChange={setThreadLength} suffix="개" />
        {memo("산지 에피소드, 금지할 말투…")}
      </>
    ),
    carousel: (
      <>
        {productField("예: 제주 감귤 로얄과")}
        {imageUpload("올리면 표지에 쓰고, 중간 장 이미지 생성 시 참고 사진으로도 활용해요.")}
        <Segmented label="장수" values={CAROUSEL_COUNTS} value={slideCount} onChange={setSlideCount} suffix="장" />
        <ChipGroup label="디자인 무드" options={CAROUSEL_MOODS} value={mood} onChange={setMood} />
        <ChipGroup label="타깃 독자" options={CAROUSEL_AUDIENCES.map((a) => ({ id: a.id, label: a.label }))} value={audience} onChange={setAudience} />
        {memo("브랜드 색, 꼭 넣을 문장…")}
      </>
    ),
    blog: (
      <>
        {productField("예: 제주 한라봉 선물")}
        {imageUpload("올리면 대표 사진으로 쓰고, 본문 중간 사진 생성 시 참고해요.")}
        <Segmented label="분량(자)" values={BLOG_LENGTHS} value={blogLength} onChange={setBlogLength} />
        <ChipGroup label="글의 톤" options={BLOG_TONES} value={blogTone} onChange={setBlogTone} />
        {memo("반드시 넣을 키워드, 산지 이야기…")}
      </>
    ),
    detail: (
      <>
        {productField("예: 해남 절임배추")}
        <ChipGroup label="강조 포인트" options={DETAIL_FOCUSES} value={detailFocus} onChange={setDetailFocus} />
        {memo("중량, 등급, 꼭 넣을 혜택…")}
      </>
    ),
    review: (
      <>
        {productField("예: 사과 배 선물세트")}
        <ChipGroup label="상황" options={REVIEW_TYPES} value={reviewType} onChange={setReviewType} />
        {memo("보상 정책, 꼭 넣을 말…")}
      </>
    ),
    chat: (
      <>
        {productField("예: 샤인머스캣")}
        <ChipGroup label="목적" options={CHAT_PURPOSES} value={chatPurpose} onChange={setChatPurpose} />
        {memo("택배사, 이벤트명…")}
      </>
    ),
    live: (
      <>
        {productField("예: 제주 감귤 라이브")}
        <LiveDurationField value={liveDuration} onChange={setLiveDuration} />
        <ChipGroup label="호스트 톤" options={LIVE_STYLES} value={liveStyle} onChange={setLiveStyle} />
        {memo("특가 멘트, 구성 세트…")}
      </>
    ),
    ads: (
      <>
        {productField("예: 산지직송 사과 5kg")}
        <ChipGroup label="소재 목표" options={ADS_GOALS} value={adsGoal} onChange={setAdsGoal} />
        {memo("핵심 키워드, 금지 표현…")}
        <p className="rounded-xl bg-indigo-50/80 p-3 text-[11px] leading-relaxed text-indigo-900">
          네이버 쇼핑·검색광고 관례: 제목 약 15자 · 설명 약 45자. 글자 수는 코드로 다시 세어 넘치면 빨간 표시가 납니다.
        </p>
      </>
    ),
  };

  return (
    <>
      <PageHeader title={`${BRAND} 마케팅`} description="만들고 싶은 형식을 고르면 팝업 스튜디오가 열립니다. 결과는 보관함에 자동 저장돼요." />

      <div className="flex min-h-[58vh] flex-col items-center py-6">
        <p className="mb-4 text-base text-stone-500 sm:text-lg">어떤 콘텐츠를 만들까요?</p>
        <MoleculeHub onPick={openStudio} />
      </div>

      {open && (
        <StudioModal format={open} onClose={closeStudio}>
          <StudioShell
            format={open}
            input={inputByFormat[open]}
            result={result}
            pending={pending}
            error={error}
            onGenerate={generate}
            canGenerate={!!product.trim()}
            media={{ productImage, images, status: imageStatus, onRetry: retryImage }}
            imagePlan={imagePlan}
          />
        </StudioModal>
      )}
    </>
  );
}

function LiveDurationField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">길이(분)</p>
        <p className="text-sm font-bold tabular-nums text-rose-700">
          {value}
          <span className="ml-0.5 text-[11px] font-semibold text-rose-500/80">분</span>
        </p>
      </div>
      <div className="mb-3 inline-flex rounded-2xl border border-stone-200/80 bg-white p-1 shadow-sm">
        {LIVE_DURATIONS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${value === v ? STUDIO_TONE.live.selected : "text-stone-500 hover:text-stone-800"}`}
          >
            {v}분
          </button>
        ))}
      </div>
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-[11px] text-stone-400">
          <span>
            직접 조절 ({LIVE_DURATION_MIN}~{LIVE_DURATION_MAX}분)
          </span>
          {!(LIVE_DURATIONS as readonly number[]).includes(value) && <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-600">중간 값</span>}
        </span>
        <input
          type="range"
          min={LIVE_DURATION_MIN}
          max={LIVE_DURATION_MAX}
          step={1}
          value={value}
          onChange={(e) => onChange(clampLiveDuration(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-rose-100 accent-rose-600"
        />
        <span className="mt-1 flex justify-between text-[10px] tabular-nums text-stone-400">
          <span>{LIVE_DURATION_MIN}</span>
          <span>30</span>
          <span>{LIVE_DURATION_MAX}</span>
        </span>
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={LIVE_DURATION_MIN}
          max={LIVE_DURATION_MAX}
          step={1}
          value={value}
          onChange={(e) => onChange(clampLiveDuration(e.target.value, value))}
          className="w-20 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-stone-800 shadow-sm outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
          aria-label="라이브 길이(분)"
        />
        <span className="text-xs text-stone-500">분 · 15·30·45는 빠른 선택, 그 사이 값도 OK</span>
      </div>
    </div>
  );
}
