"use client";

import { useEffect, useRef, useState } from "react";
import { DetailSectionView } from "@/components/detail/DetailSectionView";
import { DETAIL_WIDTH, SECTION_META, themeById, type DetailProject } from "@/lib/detailPage";

interface Props {
  project: DetailProject;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 내보내기용 섹션 DOM 등록 (선택 테두리·라벨은 섹션 밖에 있어 캡처되지 않는다) */
  registerNode: (id: string, node: HTMLElement | null) => void;
  markPlaceholders: boolean;
}

/** 860px 원본 크기로 그린 뒤 화면 폭에 맞게 축소해서 보여 준다 */
export function DetailCanvas({ project, selectedId, onSelect, registerNode, markPlaceholders }: Props) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });
  const theme = themeById(project.themeId);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const observer = new ResizeObserver(() => setBox({ scale: Math.min(1, o.clientWidth / DETAIL_WIDTH), height: i.offsetHeight }));
    observer.observe(o);
    observer.observe(i);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outer} className="w-full">
      <div
        className="mx-auto overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-stone-200"
        style={{ width: DETAIL_WIDTH * box.scale, height: box.height * box.scale }}
      >
        <div ref={inner} style={{ width: DETAIL_WIDTH, transform: `scale(${box.scale})`, transformOrigin: "top left" }}>
          {project.sections.map((section, index) => {
            const selected = section.id === selectedId;
            return (
              <div
                key={section.id}
                onClick={() => onSelect(section.id)}
                className={`group relative cursor-pointer ${selected ? "z-10 outline-[8px] -outline-offset-[8px] outline-emerald-500 outline-solid" : "hover:outline-[6px] hover:-outline-offset-[6px] hover:outline-emerald-300 hover:outline-solid"}`}
              >
                <DetailSectionView
                  ref={(node) => registerNode(section.id, node)}
                  section={section}
                  theme={theme}
                  productImages={project.productImages}
                  company={project.company}
                  markPlaceholders={markPlaceholders}
                />
                <span
                  className={`pointer-events-none absolute right-5 top-5 rounded-full bg-emerald-600 px-4 py-2 text-[20px] font-bold text-white shadow-lg transition ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                >
                  {String(index + 1).padStart(2, "0")} {SECTION_META[section.type].label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {project.sections.length === 0 && <p className="py-20 text-center text-sm text-stone-400">왼쪽에서 섹션을 추가해 주세요.</p>}
    </div>
  );
}
