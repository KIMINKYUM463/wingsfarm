"use client";

import { useState } from "react";
import { SECTION_META, SECTION_TYPES, type DetailSection, type SectionType } from "@/lib/detailPage";

interface Props {
  sections: DetailSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (type: SectionType) => void;
}

const iconBtn = "grid size-6 place-items-center rounded text-[11px] text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:opacity-30";

/** 섹션(프레임) 목록 — 끌어서 순서 바꾸기, 복제, 삭제, 추가 */
export function SectionList({ sections, selectedId, onSelect, onMove, onDuplicate, onRemove, onAdd }: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      {sections.map((s, i) => {
        const meta = SECTION_META[s.type];
        const selected = s.id === selectedId;
        return (
          <div
            key={s.id}
            draggable
            onDragStart={() => setDragFrom(i)}
            onDragEnd={() => setDragFrom(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragFrom !== null) onMove(dragFrom, i);
              setDragFrom(null);
            }}
            onClick={() => onSelect(s.id)}
            className={`group relative cursor-pointer rounded-xl border px-2.5 py-2 transition ${
              selected ? "border-emerald-400 bg-emerald-50" : "border-stone-200 bg-white hover:border-stone-300"
            } ${dragFrom === i ? "opacity-40" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-stone-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span aria-hidden>{meta.icon}</span>
              <span className="flex-1 truncate text-xs font-semibold text-stone-700">{meta.label}</span>
              <div
                className={`absolute right-1 top-1 gap-0.5 rounded-lg bg-white/95 shadow-sm ring-1 ring-stone-200 ${selected ? "flex" : "hidden group-hover:flex"}`}
                onClick={(e) => e.stopPropagation()}
              >
                <button type="button" className={iconBtn} disabled={i === 0} onClick={() => onMove(i, i - 1)} aria-label="위로">
                  ▲
                </button>
                <button type="button" className={iconBtn} disabled={i === sections.length - 1} onClick={() => onMove(i, i + 1)} aria-label="아래로">
                  ▼
                </button>
                <button type="button" className={iconBtn} onClick={() => onDuplicate(s.id)} aria-label="복제">
                  ⧉
                </button>
                <button type="button" className={`${iconBtn} hover:text-rose-600`} onClick={() => onRemove(s.id)} aria-label="삭제">
                  ✕
                </button>
              </div>
            </div>
            <p className="mt-0.5 truncate pl-6 text-[11px] text-stone-400">{s.headline.replace(/\n/g, " ") || "(제목 없음)"}</p>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setAdding((v) => !v)}
        className="mt-1 rounded-xl border border-dashed border-stone-300 py-2 text-xs font-semibold text-stone-500 hover:border-emerald-400 hover:text-emerald-700"
      >
        {adding ? "닫기" : "+ 섹션 추가"}
      </button>
      {adding && (
        <div className="grid grid-cols-2 gap-1.5">
          {SECTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              title={SECTION_META[type].hint}
              onClick={() => {
                onAdd(type);
                setAdding(false);
              }}
              className="rounded-lg bg-white px-2 py-1.5 text-left text-[11px] text-stone-600 ring-1 ring-stone-200 hover:ring-emerald-400"
            >
              {SECTION_META[type].icon} {SECTION_META[type].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
