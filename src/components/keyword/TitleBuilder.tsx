"use client";

import { useState } from "react";
import { CopyButton } from "@/components/ui";
import { stagger } from "@/components/motion";
import { TITLE_LIMIT, composeProductTitle } from "@/lib/titleMaker";
import { volumeText } from "./shared";

export type TitleWord = { word: string; volume?: number };

export function TitleBuilder({
  keyword,
  words,
  picked,
  onPickedChange,
  tag,
}: {
  keyword: string;
  words: TitleWord[];
  /** 제어 컴포넌트로 쓸 때 (상품명 제조기). 없으면 내부 state */
  picked?: string[];
  onPickedChange?: (words: string[]) => void;
  /** [산지직송]처럼 앞에 붙는 꼬리표. 없으면 꼬리표 없이 조합 */
  tag?: string | null;
}) {
  const [local, setLocal] = useState<string[]>([]);
  const selected = picked ?? local;
  const setSelected = onPickedChange ?? setLocal;
  const maxVolume = Math.max(...words.map((w) => w.volume ?? 1), 1);
  const title = composeProductTitle(keyword, selected, tag);
  const tooLong = title.length > TITLE_LIMIT;

  const toggle = (word: string) => setSelected(selected.includes(word) ? selected.filter((w) => w !== word) : [...selected, word]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {words.map((w, i) => {
          const active = selected.includes(w.word);
          const weight = Math.sqrt((w.volume ?? 1) / maxVolume);
          return (
            <button
              key={w.word}
              type="button"
              onClick={() => toggle(w.word)}
              className={`animate-fade-up rounded-full border px-3 py-1 transition hover:-translate-y-0.5 ${
                active ? "border-emerald-600 bg-emerald-600 text-white shadow-md" : "border-stone-200 bg-white text-stone-700 hover:border-emerald-300"
              }`}
              style={{ fontSize: `${12 + weight * 5}px`, ...stagger(i, 100, 15) }}
            >
              {w.word}
              {w.volume !== undefined && (
                <span className={`ml-1 text-[10px] ${active ? "text-emerald-100" : "text-stone-400"}`}>{volumeText(w.volume)}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl bg-[#07140f] p-4 text-white">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>조합된 상품명</span>
          <span className={tooLong ? "text-rose-300" : ""}>
            {title.length} / {TITLE_LIMIT}자 권장
          </span>
        </div>
        <p className="mt-2 min-h-6 break-keep text-base font-semibold leading-relaxed">{title || "꼬리표와 수식어를 골라 주세요"}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-white/40">예: [산지직송] 국내산 파김치 쪽파 · 실제 상품과 맞는 단어만 쓰세요</p>
          <div className="flex shrink-0 gap-1 [&_button]:text-white/70 [&_button:hover]:bg-white/10">
            {selected.length > 0 && (
              <button type="button" onClick={() => setSelected([])} className="rounded-lg px-3 py-2 text-sm transition">
                초기화
              </button>
            )}
            <CopyButton text={title} />
          </div>
        </div>
      </div>
    </div>
  );
}
