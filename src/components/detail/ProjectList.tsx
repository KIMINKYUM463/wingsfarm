"use client";

/* eslint-disable @next/next/no-img-element -- 저장된 표지(data URL) */
import { useEffect, useState } from "react";
import { Button, EmptyState } from "@/components/ui";
import { DETAIL_CHANGED, listDetailSummaries, removeDetailProject, type DetailSummary } from "@/lib/detailProjects";

const dateText = (ms: number) => new Date(ms).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

const FLOW = [
  { icon: "📝", title: "정보 입력", text: "업체명·상품명·아는 사실" },
  { icon: "🏷️", title: "특징 선택", text: "AI 키워드 또는 벤치마킹 캡처" },
  { icon: "✨", title: "AI 초안", text: "섹션별 문구·사진 배치" },
  { icon: "🖌️", title: "편집·저장", text: "문구·사진 수정 후 JPG 저장" },
];

export function ProjectList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const [items, setItems] = useState<DetailSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () =>
      listDetailSummaries()
        .then(setItems)
        .catch(() => setError("저장된 상세페이지를 불러오지 못했습니다. 시크릿 모드에서는 저장되지 않을 수 있어요."));
    load();
    window.addEventListener(DETAIL_CHANGED, load);
    return () => window.removeEventListener(DETAIL_CHANGED, load);
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-500 p-5 text-white sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {FLOW.map((f, i) => (
            <div key={f.title} className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
              <p className="text-xs text-white/70">STEP {i + 1}</p>
              <p className="mt-1 font-bold">
                {f.icon} {f.title}
              </p>
              <p className="mt-0.5 text-xs text-white/80">{f.text}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={onNew} className="rounded-xl bg-white px-6 py-3 font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50">
          ＋ 새 상세페이지
        </button>
      </div>

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {items?.length === 0 && <EmptyState>아직 만든 상세페이지가 없어요. ‘새 상세페이지’로 시작해 보세요.</EmptyState>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {items?.map((p) => (
          <div key={p.id} className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md">
            <button type="button" onClick={() => onOpen(p.id)} className="block w-full text-left">
              <div className="aspect-[4/5] bg-stone-100">
                {p.cover ? <img src={p.cover} alt="" className="size-full object-cover object-top" /> : <div className="grid size-full place-items-center text-4xl">📄</div>}
              </div>
              <div className="p-3">
                <p className="truncate font-semibold text-stone-800">{p.name}</p>
                <p className="mt-0.5 text-xs text-stone-400">
                  {p.sectionCount}섹션 · {dateText(p.updatedAt)}
                </p>
              </div>
            </button>
            <div className="flex justify-end border-t border-stone-100 px-2 py-1">
              <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => confirm(`"${p.name}"을(를) 삭제할까요?`) && void removeDetailProject(p.id)}>
                삭제
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
