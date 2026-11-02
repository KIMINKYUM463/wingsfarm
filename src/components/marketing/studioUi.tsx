"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { TextInput } from "@/components/ui";
import { MARKETING_FORMAT_META, type MarketingFormat } from "@/lib/marketingAi";

export const STUDIO_TONE: Record<
  MarketingFormat,
  { selected: string; generate: string; empty: string; spin: string; pillOn: string; surface: string }
> = {
  shorts: {
    selected: "border-transparent bg-linear-to-br from-rose-500 to-orange-500 text-white shadow-md shadow-orange-200/70",
    generate: "bg-linear-to-r from-rose-500 via-orange-500 to-amber-400 text-white shadow-lg shadow-orange-200/80 hover:brightness-105",
    empty: "from-rose-50 via-orange-50/80 to-amber-50",
    spin: "border-orange-200 border-t-orange-500",
    pillOn: "bg-orange-500 text-white",
    surface: "bg-linear-to-b from-orange-50/70 to-white",
  },
  threads: {
    selected: "border-transparent bg-linear-to-br from-stone-900 to-emerald-800 text-amber-100 shadow-md",
    generate: "bg-linear-to-r from-stone-900 via-stone-800 to-emerald-800 text-amber-100 shadow-lg hover:brightness-110",
    empty: "from-stone-100 via-emerald-50 to-stone-50",
    spin: "border-stone-200 border-t-stone-800",
    pillOn: "bg-stone-900 text-white",
    surface: "bg-linear-to-b from-stone-50 to-white",
  },
  carousel: {
    selected: "border-transparent bg-linear-to-br from-violet-600 to-fuchsia-500 text-white shadow-md shadow-fuchsia-200/70",
    generate: "bg-linear-to-r from-violet-600 via-fuchsia-500 to-rose-400 text-white shadow-lg shadow-fuchsia-200/70 hover:brightness-105",
    empty: "from-violet-50 via-fuchsia-50 to-rose-50",
    spin: "border-fuchsia-200 border-t-fuchsia-600",
    pillOn: "bg-violet-600 text-white",
    surface: "bg-linear-to-b from-violet-50/70 to-white",
  },
  blog: {
    selected: "border-transparent bg-linear-to-br from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-200/70",
    generate: "bg-linear-to-r from-emerald-600 via-teal-500 to-sky-500 text-white shadow-lg shadow-emerald-200/70 hover:brightness-105",
    empty: "from-emerald-50 via-teal-50 to-sky-50",
    spin: "border-emerald-200 border-t-emerald-600",
    pillOn: "bg-emerald-600 text-white",
    surface: "bg-linear-to-b from-emerald-50/70 to-white",
  },
  review: {
    selected: "border-transparent bg-linear-to-br from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-200/70",
    generate: "bg-linear-to-r from-sky-600 via-blue-500 to-indigo-500 text-white shadow-lg shadow-sky-200/70 hover:brightness-105",
    empty: "from-sky-50 via-blue-50 to-indigo-50",
    spin: "border-sky-200 border-t-sky-600",
    pillOn: "bg-sky-600 text-white",
    surface: "bg-linear-to-b from-sky-50/70 to-white",
  },
  chat: {
    selected: "border-transparent bg-linear-to-br from-cyan-500 to-emerald-500 text-white shadow-md shadow-cyan-200/70",
    generate: "bg-linear-to-r from-cyan-600 via-teal-500 to-emerald-400 text-white shadow-lg shadow-cyan-200/70 hover:brightness-105",
    empty: "from-cyan-50 via-teal-50 to-emerald-50",
    spin: "border-teal-200 border-t-teal-600",
    pillOn: "bg-teal-600 text-white",
    surface: "bg-linear-to-b from-teal-50/70 to-white",
  },
  live: {
    selected: "border-transparent bg-linear-to-br from-red-500 to-pink-500 text-white shadow-md shadow-rose-200/70",
    generate: "bg-linear-to-r from-red-600 via-rose-500 to-pink-400 text-white shadow-lg shadow-rose-200/70 hover:brightness-105",
    empty: "from-red-50 via-rose-50 to-pink-50",
    spin: "border-rose-200 border-t-rose-600",
    pillOn: "bg-rose-600 text-white",
    surface: "bg-linear-to-b from-rose-50/70 to-white",
  },
  ads: {
    selected: "border-transparent bg-linear-to-br from-blue-600 to-violet-500 text-white shadow-md shadow-indigo-200/70",
    generate: "bg-linear-to-r from-blue-700 via-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-200/70 hover:brightness-105",
    empty: "from-blue-50 via-indigo-50 to-violet-50",
    spin: "border-indigo-200 border-t-indigo-600",
    pillOn: "bg-indigo-600 text-white",
    surface: "bg-linear-to-b from-indigo-50/70 to-white",
  },
};

export const ToneCtx = createContext<(typeof STUDIO_TONE)[MarketingFormat]>(STUDIO_TONE.shorts);

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">{children}</p>;
}

export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const tone = useContext(ToneCtx);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`rounded-2xl border px-3.5 py-2.5 text-left transition ${
                active ? tone.selected : "border-stone-200/80 bg-white text-stone-700 hover:border-stone-300 hover:shadow-sm"
              }`}
            >
              <span className="block text-sm font-semibold">{o.label}</span>
              {o.hint && <span className={`mt-0.5 block text-[11px] leading-snug ${active ? "text-white/70" : "text-stone-400"}`}>{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Segmented<T extends number>({
  label,
  values,
  value,
  onChange,
  suffix = "",
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
  suffix?: string;
}) {
  const tone = useContext(ToneCtx);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="inline-flex rounded-2xl border border-stone-200/80 bg-white p-1 shadow-sm">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${value === v ? tone.selected : "text-stone-500 hover:text-stone-800"}`}
          >
            {v}
            {suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MemoField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <FieldLabel>메모</FieldLabel>
      <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="rounded-2xl" />
    </div>
  );
}

export function Hashtags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((h) => (
        <span key={h} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80">
          #{h}
        </span>
      ))}
    </div>
  );
}

export function TipList({ tips }: { tips: string[] }) {
  if (!tips.length) return null;
  return (
    <ul className="space-y-1.5 rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-xs text-amber-950">
      {tips.map((t) => (
        <li key={t} className="flex gap-2">
          <span className="text-amber-500">✦</span>
          {t}
        </li>
      ))}
    </ul>
  );
}

export function StudioModal({ format, onClose, children }: { format: MarketingFormat; onClose: () => void; children: ReactNode }) {
  const meta = MARKETING_FORMAT_META[format];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <ToneCtx.Provider value={STUDIO_TONE[format]}>
      <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-[#07140f]/50 p-3 backdrop-blur-md sm:p-6" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={meta.title}
          className="flex max-h-[94vh] w-full max-w-6xl animate-pop-in flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)] ring-1 ring-black/5"
          onClick={(e) => e.stopPropagation()}
        >
          <header className={`relative shrink-0 overflow-hidden bg-linear-to-r ${meta.accent} px-6 py-6 text-white`}>
            <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 left-1/3 size-40 rounded-full bg-black/10 blur-2xl" />
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/15 text-white/85 backdrop-blur-sm transition hover:rotate-90 hover:bg-white/25 hover:text-white"
            >
              ✕
            </button>
            <div className="relative flex items-center gap-4 pr-12">
              <span className="grid size-14 place-items-center rounded-2xl bg-white/20 text-3xl shadow-inner backdrop-blur-sm">{meta.icon}</span>
              <div>
                <p className="text-[11px] font-medium tracking-[0.35em] text-white/70 uppercase">{meta.studio}</p>
                <h2 className="mt-0.5 text-2xl font-black tracking-tight">{meta.title}</h2>
                <p className="mt-0.5 text-sm text-white/80">{meta.blurb}</p>
              </div>
            </div>
          </header>
          {children}
        </div>
      </div>
    </ToneCtx.Provider>
  );
}

export function ProductImageUpload({
  productImage,
  onFile,
  onClear,
  hint,
}: {
  productImage: string;
  onFile: (file?: File | null) => void;
  onClear: () => void;
  hint: string;
}) {
  const fileInput = (
    <input
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        onFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );
  return (
    <div>
      <FieldLabel>상품 사진</FieldLabel>
      <p className="mb-2 text-[11px] leading-relaxed text-stone-500">{hint}</p>
      {productImage ? (
        <div className="relative overflow-hidden rounded-2xl ring-1 ring-stone-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={productImage} alt="상품 참고 사진" className="aspect-[4/3] w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-linear-to-t from-black/55 to-transparent p-3">
            <label className="cursor-pointer rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-stone-800 shadow-sm">
              바꾸기
              {fileInput}
            </label>
            <button type="button" onClick={onClear} className="rounded-full bg-black/40 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm">
              제거
            </button>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 px-4 py-7 text-center transition hover:border-violet-300 hover:bg-violet-50">
          <span className="text-sm font-semibold text-violet-800">사진 업로드</span>
          <span className="text-[11px] text-violet-600/80">JPG · PNG · WebP</span>
          {fileInput}
        </label>
      )}
    </div>
  );
}

export function ProductField({
  product,
  setProduct,
  inSeason,
  placeholder,
}: {
  product: string;
  setProduct: (v: string) => void;
  inSeason: { name: string }[];
  placeholder: string;
}) {
  const tone = useContext(ToneCtx);
  return (
    <div>
      <FieldLabel>상품</FieldLabel>
      <TextInput value={product} onChange={(e) => setProduct(e.target.value)} placeholder={placeholder} className="rounded-2xl border-stone-200 bg-white shadow-sm" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {inSeason.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => setProduct(s.name)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              product === s.name ? tone.pillOn : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stone-300"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
