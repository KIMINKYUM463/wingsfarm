"use client";

/* eslint-disable @next/next/no-img-element -- data URL 미리보기 */
import { useState, type ReactNode } from "react";
import { Button, Select, TextArea, TextInput } from "@/components/ui";
import { SECTION_META, SECTION_TYPES, type DetailItem, type DetailSection, type ImageSource, type SectionBg } from "@/lib/detailPage";
import { IMAGE_STYLES, REWRITE_PRESETS } from "@/lib/detailPageAi";

export type ImageJob = { running: true } | { running: false; error: string };

interface Props {
  section: DetailSection;
  productImages: string[];
  onChange: (patch: Partial<DetailSection>, coalesceKey?: string) => void;
  onAddProductImages: (files: File[]) => void;
  onUploadImage: (file: File) => void;
  imageJob?: ImageJob;
  onGenerateImage: () => void;
  rewriting: boolean;
  onRewrite: (instruction: string) => void;
}

const BG_OPTIONS: { id: SectionBg; label: string }[] = [
  { id: "light", label: "밝게" },
  { id: "tint", label: "연하게" },
  { id: "dark", label: "진하게" },
];

const SOURCE_OPTIONS: { id: ImageSource; label: string }[] = [
  { id: "none", label: "없음" },
  { id: "product", label: "상품 사진" },
  { id: "ai", label: "AI 사진" },
  { id: "upload", label: "직접 올리기" },
];

function Block({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-t border-stone-100 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-bold tracking-wide text-stone-400">{title}</h3>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Pills<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${value === o.id ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FilePick({ label, multiple, onFiles }: { label: string; multiple?: boolean; onFiles: (files: File[]) => void }) {
  return (
    <label className="block cursor-pointer rounded-lg border border-dashed border-stone-300 px-3 py-2 text-center text-xs font-semibold text-stone-500 hover:border-emerald-400 hover:text-emerald-700">
      {label}
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </label>
  );
}

/** 선택한 섹션의 문구·사진·배경을 고치는 오른쪽 패널 */
export function SectionInspector({ section, productImages, onChange, onAddProductImages, onUploadImage, imageJob, onGenerateImage, rewriting, onRewrite }: Props) {
  const [instruction, setInstruction] = useState("");
  const { image } = section;
  const setItems = (items: DetailItem[], key?: string) => onChange({ items }, key);
  const setImage = (patch: Partial<DetailSection["image"]>, key?: string) => onChange({ image: { ...image, ...patch } }, key);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          {SECTION_META[section.type].icon}
        </span>
        <Select value={section.type} onChange={(e) => onChange({ type: e.target.value as DetailSection["type"] })} className="py-1.5 text-sm font-semibold">
          {SECTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {SECTION_META[t].label}
            </option>
          ))}
        </Select>
      </div>
      {section.type !== "hero" && <Pills options={BG_OPTIONS} value={section.bg} onChange={(bg) => onChange({ bg })} />}

      <Block title="문구">
        <TextInput value={section.eyebrow} onChange={(e) => onChange({ eyebrow: e.target.value }, "eyebrow")} placeholder="작은 제목 (예: POINT 01)" />
        <TextArea rows={2} value={section.headline} onChange={(e) => onChange({ headline: e.target.value }, "headline")} placeholder="큰 제목" className="font-semibold" />
        <TextArea rows={4} value={section.body} onChange={(e) => onChange({ body: e.target.value }, "body")} placeholder="본문 (Enter로 줄바꿈)" />
      </Block>

      {section.type !== "hero" && (
        <Block
          title={`항목 ${section.items.length}개`}
          action={
            <button type="button" className="text-xs font-semibold text-emerald-700" onClick={() => setItems([...section.items, { title: "", text: "" }])}>
              + 추가
            </button>
          }
        >
          {section.items.map((item, i) => (
            <div key={i} className="relative rounded-lg bg-stone-50 p-2 pr-7">
              <TextInput
                value={item.title}
                onChange={(e) => setItems(section.items.map((it, j) => (j === i ? { ...it, title: e.target.value } : it)), `item${i}t`)}
                placeholder="제목·항목명·질문"
                className="mb-1 py-1.5 text-xs font-semibold"
              />
              <TextArea
                rows={2}
                value={item.text}
                onChange={(e) => setItems(section.items.map((it, j) => (j === i ? { ...it, text: e.target.value } : it)), `item${i}x`)}
                placeholder="설명·값·답변"
                className="py-1.5 text-xs"
              />
              <button
                type="button"
                aria-label="항목 삭제"
                onClick={() => setItems(section.items.filter((_, j) => j !== i))}
                className="absolute right-1.5 top-2 text-xs text-stone-400 hover:text-rose-600"
              >
                ✕
              </button>
            </div>
          ))}
        </Block>
      )}

      <Block title="사진">
        <Pills options={SOURCE_OPTIONS} value={image.source} onChange={(source) => setImage({ source })} />

        {image.source === "product" && (
          <>
            <div className="grid grid-cols-4 gap-1.5">
              {productImages.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImage({ productIndex: i })}
                  className={`overflow-hidden rounded-lg ring-2 ${image.productIndex === i ? "ring-emerald-500" : "ring-transparent hover:ring-stone-300"}`}
                >
                  <img src={src} alt={`상품 사진 ${i + 1}`} className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
            <FilePick label="+ 상품 사진 추가" multiple onFiles={onAddProductImages} />
          </>
        )}

        {image.source === "ai" && (
          <>
            {image.src && <img src={image.src} alt="AI 사진" className="aspect-[3/2] w-full rounded-lg object-cover" />}
            <TextArea rows={4} value={image.prompt} onChange={(e) => setImage({ prompt: e.target.value }, "prompt")} placeholder="사진 장면 설명 (영어 권장, 한국어도 가능)" className="text-xs" />
            <div className="flex flex-wrap gap-1">
              {IMAGE_STYLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setImage({ prompt: [image.prompt.trim(), s.text].filter(Boolean).join(", ") })}
                  className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700 hover:bg-violet-100"
                >
                  + {s.label}
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={onGenerateImage} disabled={imageJob?.running || image.prompt.trim().length < 8}>
              {imageJob?.running ? "사진 만드는 중… (30초~1분)" : image.src ? "🔄 다시 만들기" : "📷 이 사진 만들기"}
            </Button>
            {imageJob && !imageJob.running && <p className="text-xs text-rose-600">{imageJob.error}</p>}
            <p className="text-[11px] text-stone-400">첫 번째 상품 사진을 참고해 같은 상품이 나오도록 만듭니다.</p>
          </>
        )}

        {image.source === "upload" && (
          <>
            {image.src && <img src={image.src} alt="올린 사진" className="aspect-[3/2] w-full rounded-lg object-cover" />}
            <FilePick label={image.src ? "다른 사진으로 바꾸기" : "사진 올리기"} onFiles={(files) => files[0] && onUploadImage(files[0])} />
          </>
        )}
      </Block>

      <Block title="AI로 문구 다시 쓰기">
        <div className="flex flex-wrap gap-1">
          {REWRITE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={rewriting}
              onClick={() => onRewrite(p.instruction)}
              className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <TextInput value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="직접 요청 (예: 당도 12브릭스 넣어줘)" className="py-1.5 text-xs" />
          <Button variant="secondary" disabled={rewriting || instruction.trim().length < 2} onClick={() => onRewrite(instruction.trim())} className="shrink-0 text-xs">
            적용
          </Button>
        </div>
        {rewriting && <p className="text-xs text-emerald-700">다시 쓰는 중…</p>}
        <p className="text-[11px] text-stone-400">마음에 안 들면 Ctrl+Z로 되돌릴 수 있어요.</p>
      </Block>
    </div>
  );
}
