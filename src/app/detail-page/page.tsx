"use client";

import { useEffect, useState } from "react";
import { DetailEditor } from "@/components/detail/DetailEditor";
import { DetailWizard } from "@/components/detail/DetailWizard";
import { ProjectList } from "@/components/detail/ProjectList";
import { PageHeader } from "@/components/ui";
import type { DetailProject } from "@/lib/detailPage";
import { getDetailProject } from "@/lib/detailProjects";

type View = { kind: "list" } | { kind: "wizard" } | { kind: "loading"; id: string } | { kind: "editor"; project: DetailProject };

const BASE = "/detail-page";

/** 새로고침해도 열던 프로젝트로 돌아오도록 ?id= 를 주소에 남긴다 (ClientOnly 안이라 window 사용 가능) */
const initialView = (): View => {
  const id = new URLSearchParams(window.location.search).get("id");
  return id ? { kind: "loading", id } : { kind: "list" };
};
const setUrl = (id?: string) => window.history.replaceState(null, "", id ? `${BASE}?id=${encodeURIComponent(id)}` : BASE);

export default function DetailPageStudio() {
  const [view, setView] = useState<View>(initialView);
  const loadingId = view.kind === "loading" ? view.id : null;

  useEffect(() => {
    if (!loadingId) return;
    getDetailProject(loadingId)
      .then((project) => {
        if (project) return setView({ kind: "editor", project });
        setUrl();
        setView({ kind: "list" });
      })
      .catch(() => setView({ kind: "list" }));
  }, [loadingId]);

  const openEditor = (project: DetailProject) => {
    setUrl(project.id);
    setView({ kind: "editor", project });
  };
  const toList = () => {
    setUrl();
    setView({ kind: "list" });
  };

  if (view.kind === "editor") return <DetailEditor key={view.project.id} initial={view.project} onExit={toList} />;

  return (
    <>
      <PageHeader title="상세페이지 제작" description="상품 정보와 사진만 넣으면 AI가 섹션별 상세페이지를 만들고, 직접 다듬어 JPG로 저장합니다." />
      {view.kind === "wizard" && <DetailWizard onCreated={openEditor} onCancel={toList} />}
      {view.kind === "list" && (
        <ProjectList
          onNew={() => setView({ kind: "wizard" })}
          onOpen={(id) => {
            setUrl(id);
            setView({ kind: "loading", id });
          }}
        />
      )}
      {view.kind === "loading" && <p className="py-20 text-center text-sm text-stone-400">불러오는 중…</p>}
    </>
  );
}
