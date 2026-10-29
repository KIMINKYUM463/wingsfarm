"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, CopyButton, EmptyState, Modal, PageHeader, TextInput } from "@/components/ui";
import {
  ARCHIVE_CHANGED,
  ARCHIVE_KIND_LABEL,
  clearArchive,
  listArchive,
  removeArchive,
  type ArchiveItem,
  type ArchiveKind,
} from "@/lib/archive";
import { dataUrlExt, downloadDataUrl } from "@/lib/image";

type Filter = "all" | ArchiveKind;
const FILTERS: Filter[] = ["all", ...(Object.keys(ARCHIVE_KIND_LABEL) as ArchiveKind[])];

const KIND_TONE: Record<ArchiveKind, string> = {
  marketing: "bg-fuchsia-50 text-fuchsia-700",
  thumbnail: "bg-amber-50 text-amber-700",
  detail: "bg-orange-50 text-orange-700",
  tags: "bg-emerald-50 text-emerald-700",
  titles: "bg-sky-50 text-sky-700",
};

const dateText = (ms: number) =>
  new Date(ms).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function useArchiveList() {
  const [items, setItems] = useState<ArchiveItem[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const load = () =>
      listArchive()
        .then(setItems)
        .catch(() => setError("보관함을 열 수 없습니다. 사생활 보호(시크릿) 모드에서는 저장되지 않을 수 있어요."));
    load();
    window.addEventListener(ARCHIVE_CHANGED, load);
    return () => window.removeEventListener(ARCHIVE_CHANGED, load);
  }, []);
  return { items, error };
}

function downloadAll(item: ArchiveItem) {
  Object.entries(item.images).forEach(([key, src], i) => {
    setTimeout(() => downloadDataUrl(src, `${item.product || "wingsfarm-ai"}-${key}.${dataUrlExt(src)}`), i * 250);
  });
}

export default function ArchivePage() {
  const { items, error } = useArchiveList();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<ArchiveItem | null>(null);

  const visible = useMemo(() => {
    const q = query.trim();
    return (items ?? []).filter((i) => (filter === "all" || i.kind === filter) && (!q || i.product.includes(q) || i.title.includes(q)));
  }, [items, filter, query]);

  return (
    <>
      <PageHeader
        title="보관함"
        description="AI로 만든 마케팅 글·썸네일·상세페이지·검색 태그·상품명이 자동으로 저장됩니다. 새로고침해도 사라지지 않아요."
        actions={
          items && items.length > 0 ? (
            <Button variant="danger" onClick={() => confirm("보관함을 모두 비울까요? 되돌릴 수 없습니다.") && void clearArchive()}>
              전체 비우기
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${filter === f ? "bg-emerald-600 font-semibold text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stone-300"}`}
          >
            {f === "all" ? "전체" : ARCHIVE_KIND_LABEL[f]}
            {items && <span className="ml-1 text-xs opacity-70">{f === "all" ? items.length : items.filter((i) => i.kind === f).length}</span>}
          </button>
        ))}
        <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="상품명으로 찾기" className="ml-auto w-56" />
      </div>

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!items && !error && <p className="py-10 text-center text-sm text-stone-400">불러오는 중…</p>}
      {items && visible.length === 0 && (
        <EmptyState>{items.length === 0 ? "아직 저장된 결과가 없습니다. 마케팅·썸네일·태그·상품명에서 AI로 만들면 여기에 쌓여요." : "조건에 맞는 결과가 없습니다."}</EmptyState>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => {
          const images = Object.values(item.images);
          return (
            <article key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md">
              {images.length > 0 && (
                <button type="button" onClick={() => setOpened(item)} className="grid grid-cols-4 gap-0.5 bg-stone-100">
                  {images.slice(0, 4).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- data URL
                    <img key={i} src={src} alt="" className="aspect-square w-full object-cover" />
                  ))}
                </button>
              )}
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${KIND_TONE[item.kind]}`}>{ARCHIVE_KIND_LABEL[item.kind]}</span>
                  <span className="text-stone-400">{dateText(item.createdAt)}</span>
                </div>
                <p className="mt-2 font-semibold text-stone-900">{item.title}</p>
                <p className="text-xs text-stone-500">{item.product}</p>
                {item.text && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-stone-600">{item.text}</p>}
                <div className="mt-auto flex flex-wrap gap-1 pt-3">
                  <Button variant="secondary" onClick={() => setOpened(item)}>
                    펼쳐 보기
                  </Button>
                  {item.text && <CopyButton text={item.text} />}
                  {images.length > 0 && (
                    <Button variant="ghost" onClick={() => downloadAll(item)}>
                      이미지 {images.length}장 받기
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => void removeArchive(item.id)}>
                    삭제
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Modal open={opened !== null} title={opened ? `${ARCHIVE_KIND_LABEL[opened.kind]} · ${opened.title}` : ""} onClose={() => setOpened(null)}>
        {opened && (
          <div className="space-y-4">
            {Object.keys(opened.images).length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(opened.images).map(([key, src]) => (
                  <button key={key} type="button" onClick={() => downloadDataUrl(src, `${opened.product || "wingsfarm-ai"}-${key}.png`)} title="눌러서 다운로드">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
                    <img src={src} alt="" className="w-full rounded-lg object-cover" />
                  </button>
                ))}
              </div>
            )}
            {opened.text && (
              <>
                <div className="flex justify-end">
                  <CopyButton text={opened.text} label="전체 복사" />
                </div>
                <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-stone-50 p-4 font-sans text-sm leading-relaxed text-stone-700">{opened.text}</pre>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
