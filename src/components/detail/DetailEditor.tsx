"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { DetailCanvas } from "@/components/detail/DetailCanvas";
import { SectionInspector, type ImageJob } from "@/components/detail/SectionInspector";
import { SectionList } from "@/components/detail/SectionList";
import { Button, CopyButton, TextInput } from "@/components/ui";
import { trySaveArchive } from "@/lib/archive";
import { canvasToJpeg, captureSection, runWithConcurrency, stitchCanvases } from "@/lib/detailExport";
import {
  DETAIL_THEMES,
  countPlaceholders,
  createSection,
  moveItem,
  newId,
  pendingAiImages,
  projectToText,
  resolveImageSrc,
  type DetailProject,
  type DetailSection,
  type SectionType,
} from "@/lib/detailPage";
import type { SectionCopy } from "@/lib/detailPageAi";
import { saveDetailProject } from "@/lib/detailProjects";
import { errorText, postJson } from "@/lib/http";
import { compressDataUrl, downloadDataUrl, toResizedDataUrl } from "@/lib/image";
import { useHistoryState } from "@/lib/useHistoryState";

const MAX_PRODUCT_IMAGES = 10;
const AUTOSAVE_MS = 700;

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

const downloadSeries = (files: { src: string; name: string }[]) =>
  files.forEach((f, i) => setTimeout(() => downloadDataUrl(f.src, f.name), i * 300));

export function DetailEditor({ initial, onExit }: { initial: DetailProject; onExit: () => void }) {
  const history = useHistoryState(initial);
  const project = history.value;
  const { set, patchAll, undo, redo } = history;

  const [selectedId, setSelectedId] = useState<string | null>(initial.sections[0]?.id ?? null);
  const [jobs, setJobs] = useState<Record<string, ImageJob>>({});
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");
  const [savedProject, setSavedProject] = useState<DetailProject | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [cover, setCover] = useState("");

  const nodes = useRef(new Map<string, HTMLElement>());
  const registerNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  const selected = project.sections.find((s) => s.id === selectedId) ?? null;
  const pending = pendingAiImages(project.sections).filter((s) => !jobs[s.id]?.running);
  const runningCount = Object.values(jobs).filter((j) => j.running).length;

  // ───── 편집 ─────
  const update = useCallback((fn: (p: DetailProject) => DetailProject, key?: string) => set((p) => ({ ...fn(p), updatedAt: Date.now() }), key), [set]);
  const updateSection = (id: string, patch: Partial<DetailSection>, key?: string) =>
    update((p) => ({ ...p, sections: p.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }), key && `${id}:${key}`);

  const addSection = (type: SectionType) => {
    const section = createSection(type);
    update((p) => {
      const at = p.sections.findIndex((s) => s.id === selectedId);
      const sections = [...p.sections];
      sections.splice(at < 0 ? sections.length : at + 1, 0, section);
      return { ...p, sections };
    });
    setSelectedId(section.id);
  };

  const duplicateSection = (id: string) => {
    const copyId = newId();
    update((p) => {
      const at = p.sections.findIndex((s) => s.id === id);
      const sections = [...p.sections];
      sections.splice(at + 1, 0, { ...structuredClone(p.sections[at]), id: copyId });
      return { ...p, sections };
    });
    setSelectedId(copyId);
  };

  const removeSection = (id: string) => {
    update((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== id) }));
    if (id === selectedId) setSelectedId(null);
  };

  const addProductImages = async (files: File[]) => {
    const room = MAX_PRODUCT_IMAGES - project.productImages.length;
    if (room <= 0) return setError(`상품 사진은 ${MAX_PRODUCT_IMAGES}장까지 넣을 수 있어요.`);
    const added = await Promise.all(files.slice(0, room).map((f) => toResizedDataUrl(f, 1400, 0.88)));
    update((p) => ({ ...p, productImages: [...p.productImages, ...added] }));
  };

  const uploadSectionImage = async (id: string, file: File) => {
    const src = await toResizedDataUrl(file, 1600, 0.88);
    update((p) => ({ ...p, sections: p.sections.map((s) => (s.id === id ? { ...s, image: { ...s.image, source: "upload", src } } : s)) }));
  };

  // ───── AI ─────
  const generateImage = async (section: DetailSection) => {
    const { id } = section;
    const prompt = section.image.prompt.trim();
    setJobs((j) => ({ ...j, [id]: { running: true } }));
    try {
      const { image } = await postJson<{ image: string }>("/api/detail-page/image", {
        product: project.product,
        prompt,
        reference: project.productImages[0],
      });
      const src = await compressDataUrl(image, 1600);
      // 기다리는 동안 되돌리기를 해도 사진이 사라지지 않도록 모든 기록에 반영
      patchAll((p) => ({
        ...p,
        sections: p.sections.map((s) =>
          s.id === id && s.image.source === "ai" && s.image.prompt.trim() === prompt ? { ...s, image: { ...s.image, src } } : s,
        ),
      }));
      setJobs((j) => {
        const next = { ...j };
        delete next[id];
        return next;
      });
    } catch (err) {
      setJobs((j) => ({ ...j, [id]: { running: false, error: errorText(err, "사진 생성 실패") } }));
    }
  };

  const generatePending = () => runWithConcurrency(pending, 2, generateImage);

  const rewrite = async (section: DetailSection, instruction: string) => {
    setRewritingId(section.id);
    setError("");
    try {
      const copy = await postJson<SectionCopy>("/api/detail-page/rewrite", {
        product: project.product,
        company: project.company,
        type: section.type,
        copy: { eyebrow: section.eyebrow, headline: section.headline, body: section.body, items: section.items },
        instruction,
      });
      updateSection(section.id, copy);
    } catch (err) {
      setError(errorText(err, "문구 수정 실패"));
    } finally {
      setRewritingId(null);
    }
  };

  // ───── 내보내기 ─────
  const capture = async () => {
    const blanks = countPlaceholders(project.sections);
    if (blanks > 0 && !confirm(`"[입력 필요]"가 남은 섹션이 ${blanks}개 있어요. 그대로 저장할까요?`)) return null;
    flushSync(() => setExporting("이미지 만드는 중…"));
    try {
      const canvases: HTMLCanvasElement[] = [];
      for (const [i, s] of project.sections.entries()) {
        setExporting(`이미지 만드는 중… ${i + 1}/${project.sections.length}`);
        const node = nodes.current.get(s.id);
        if (node) canvases.push(await captureSection(node));
      }
      return canvases;
    } catch (err) {
      console.error("[detail-export]", err);
      setError("이미지로 저장하지 못했습니다. 다시 시도해 주세요.");
      return null;
    } finally {
      setExporting("");
    }
  };

  const fileBase = (project.product || "상세페이지").replace(/[\\/:*?"<>|]/g, "");

  const exportLong = async () => {
    const canvases = await capture();
    if (!canvases?.length) return;
    const parts = stitchCanvases(canvases);
    downloadSeries(parts.map((src, i) => ({ src, name: parts.length > 1 ? `${fileBase}_상세_${i + 1}.jpg` : `${fileBase}_상세.jpg` })));
    void trySaveArchive({
      kind: "detail",
      title: `상세페이지 ${project.sections.length}섹션`,
      product: project.product,
      text: projectToText(project),
      images: Object.fromEntries(parts.map((src, i) => [`상세_${i + 1}`, src])),
    });
  };

  const exportSections = async () => {
    const canvases = await capture();
    if (!canvases?.length) return;
    downloadSeries(canvases.map((c, i) => ({ src: canvasToJpeg(c), name: `${fileBase}_${String(i + 1).padStart(2, "0")}.jpg` })));
  };

  // ───── 저장 ─────
  const coverFrom = useMemo(
    () => project.sections.map((s) => resolveImageSrc(s.image, project.productImages)).find(Boolean) ?? project.productImages[0] ?? "",
    [project.sections, project.productImages],
  );
  useEffect(() => {
    if (!coverFrom) return;
    let alive = true;
    compressDataUrl(coverFrom, 360, 0.8)
      .then((thumb) => alive && setCover(thumb))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [coverFrom]);
  const coverThumb = coverFrom ? cover : "";

  const latest = useRef({ project, coverThumb });
  useEffect(() => {
    latest.current = { project, coverThumb };
    const timer = setTimeout(() => {
      saveDetailProject(project, coverThumb)
        .then(() => {
          setSavedProject(project);
          setSaveFailed(false);
        })
        .catch(() => setSaveFailed(true));
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [project, coverThumb]);

  // 저장 대기 중에 다른 메뉴로 이동해도 마지막 편집을 남긴다
  useEffect(() => {
    const ref = latest;
    return () => void saveDetailProject(ref.current.project, ref.current.coverThumb).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) undo();
      else if (key === "y" || (key === "z" && e.shiftKey)) redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const saveLabel = saveFailed ? "⚠️ 저장 실패" : savedProject === project ? "✓ 저장됨" : "저장 중…";

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Button variant="ghost" onClick={onExit}>
          ← 목록
        </Button>
        <TextInput value={project.name} onChange={(e) => update((p) => ({ ...p, name: e.target.value }), "name")} className="w-56 py-1.5 font-semibold" aria-label="프로젝트 이름" />
        <span className={`text-xs ${saveFailed ? "text-rose-600" : "text-stone-400"}`}>{saveLabel}</span>
        <div className="flex gap-1" role="group" aria-label="되돌리기">
          <Button variant="ghost" onClick={undo} disabled={!history.canUndo} title="되돌리기 (Ctrl+Z)">
            ↶
          </Button>
          <Button variant="ghost" onClick={redo} disabled={!history.canRedo} title="다시하기 (Ctrl+Shift+Z)">
            ↷
          </Button>
        </div>
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="디자인 테마">
          {DETAIL_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.name}
              aria-label={t.name}
              onClick={() => update((p) => ({ ...p, themeId: t.id }))}
              className={`size-6 rounded-full ring-2 ring-offset-1 transition ${project.themeId === t.id ? "ring-stone-800" : "ring-transparent hover:ring-stone-300"}`}
              style={{ background: `linear-gradient(135deg, ${t.primary} 50%, ${t.accent} 50%)` }}
            />
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {pending.length > 0 && (
            <Button onClick={generatePending}>
              📷 AI 사진 {pending.length}장 만들기
            </Button>
          )}
          {runningCount > 0 && <span className="self-center text-xs text-violet-700">사진 {runningCount}장 만드는 중…</span>}
          <CopyButton text={projectToText(project)} label="문구 복사" />
          <Button variant="secondary" onClick={exportSections} disabled={!!exporting}>
            섹션별 저장
          </Button>
          <Button onClick={exportLong} disabled={!!exporting}>
            {exporting || "⬇ 긴 이미지 저장"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
          <button type="button" onClick={() => setError("")} aria-label="닫기">
            ✕
          </button>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_280px] xl:grid-cols-[210px_minmax(0,1fr)_320px]">
        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <SectionList
            sections={project.sections}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={(from, to) => update((p) => ({ ...p, sections: moveItem(p.sections, from, to) }))}
            onDuplicate={duplicateSection}
            onRemove={removeSection}
            onAdd={addSection}
          />
        </aside>

        <DetailCanvas project={project} selectedId={selectedId} onSelect={setSelectedId} registerNode={registerNode} markPlaceholders={!exporting} />

        <aside className="rounded-2xl border border-stone-200 bg-white p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {selected ? (
            <SectionInspector
              section={selected}
              productImages={project.productImages}
              onChange={(patch, key) => updateSection(selected.id, patch, key)}
              onAddProductImages={addProductImages}
              onUploadImage={(file) => uploadSectionImage(selected.id, file)}
              imageJob={jobs[selected.id]}
              onGenerateImage={() => generateImage(selected)}
              rewriting={rewritingId === selected.id}
              onRewrite={(instruction) => rewrite(selected, instruction)}
            />
          ) : (
            <p className="py-10 text-center text-sm text-stone-400">미리보기나 왼쪽 목록에서 섹션을 눌러 수정하세요.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
