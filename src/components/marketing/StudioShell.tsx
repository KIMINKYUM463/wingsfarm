"use client";

import type { ReactNode } from "react";
import { CopyButton } from "@/components/ui";
import { MARKETING_FORMAT_META, marketingToText, type MarketingFormat, type MarketingResult } from "@/lib/marketingAi";
import { MarketingResultView, type ContentImages } from "./results";
import { StudioLoading } from "./StudioLoading";
import { STUDIO_TONE } from "./studioUi";

export interface ImagePlan {
  /** AI가 사진을 넣자고 제안한 자리 수 */
  total: number;
  /** 아직 만들지 않았거나 실패한 자리 수 */
  remaining: number;
  /** 지금 생성 중인 수 */
  running: number;
  onGenerateAll: () => void;
}

export function StudioShell({
  format,
  input,
  result,
  pending,
  error,
  onGenerate,
  canGenerate,
  media,
  imagePlan,
}: {
  format: MarketingFormat;
  input: ReactNode;
  result: MarketingResult | null;
  pending: boolean;
  error: string;
  onGenerate: () => void;
  canGenerate: boolean;
  media: ContentImages;
  imagePlan: ImagePlan | null;
}) {
  const meta = MARKETING_FORMAT_META[format];
  const tone = STUDIO_TONE[format];
  return (
    <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[340px_1fr]">
      <aside className={`flex max-h-[min(72vh,760px)] flex-col border-b border-stone-100 lg:border-b-0 lg:border-r ${tone.surface}`}>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">{input}</div>
        <div className="shrink-0 border-t border-white/60 p-4">
          {error && <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <button
            type="button"
            onClick={onGenerate}
            disabled={pending || !canGenerate}
            className={`w-full rounded-2xl py-3.5 text-[15px] font-bold tracking-tight transition disabled:cursor-not-allowed disabled:opacity-40 ${tone.generate}`}
          >
            {pending ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                스튜디오에서 제작 중…
              </span>
            ) : (
              `${meta.icon} ${meta.title} 제작하기`
            )}
          </button>
          {!canGenerate && <p className="mt-2 text-center text-[11px] text-stone-400">상품명을 입력하면 제작할 수 있어요</p>}
        </div>
      </aside>
      <section className="max-h-[min(72vh,760px)] overflow-y-auto bg-[#faf8f6] p-5">
        {result && !pending && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-stone-400">보관함에 자동 저장됨</span>
            <CopyButton text={marketingToText(result)} label="전체 복사" />
          </div>
        )}
        {result && !pending && imagePlan && imagePlan.total > 0 && <ImagePlanBar plan={imagePlan} />}
        {pending && <StudioLoading format={format} />}
        {!pending && !result && (
          <div className={`flex min-h-[28rem] flex-col items-center justify-center rounded-3xl bg-linear-to-br ${tone.empty} px-8 text-center`}>
            <div className={`grid size-20 place-items-center rounded-full bg-linear-to-br ${meta.accent} text-4xl shadow-xl`}>
              <span aria-hidden>{meta.icon}</span>
            </div>
            <p className="mt-5 text-base font-semibold text-stone-800">캔버스가 비어 있어요</p>
            <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-stone-500">왼쪽에서 옵션을 고르고 제작하면, 결과가 이 자리에 펼쳐집니다.</p>
            <ol className="mt-6 space-y-2 text-left text-xs text-stone-500">
              {["상품을 고르거나 직접 입력", "형식에 맞는 옵션 선택", "제작하기를 누르면 완성"].map((step, i) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-white text-[10px] font-bold text-stone-700 shadow-sm">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
        {!pending && result && <MarketingResultView result={result} media={media} />}
      </section>
    </div>
  );
}

function ImagePlanBar({ plan }: { plan: ImagePlan }) {
  if (plan.running > 0) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-3 text-sm text-stone-600 ring-1 ring-stone-200">
        <span className="size-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
        사진 생성 중… 남은 {plan.running}장 (장당 20~60초)
      </div>
    );
  }
  if (plan.remaining === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-linear-to-r from-amber-50 to-white p-3 ring-1 ring-amber-200">
      <p className="text-sm text-stone-700">
        AI가 사진 <b>{plan.remaining}장</b> 자리를 제안했어요. 이미지 생성은 장당 요금이 들어서 누를 때만 만듭니다.
      </p>
      <button
        type="button"
        onClick={plan.onGenerateAll}
        className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-100 shadow hover:bg-stone-800"
      >
        📷 사진 {plan.remaining}장 만들기
      </button>
    </div>
  );
}
