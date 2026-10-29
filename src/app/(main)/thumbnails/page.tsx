"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { ThumbnailEditor } from "@/components/thumbnails/ThumbnailEditor";
import { Button, Card, EmptyState, Field, PageHeader, TextInput } from "@/components/ui";
import { SEASON_ITEMS } from "@/lib/data/season";
import {
  SUB_COUNTS,
  allShots,
  planLabel,
  totalShotCount,
  type SubCount,
  type ThumbnailPlan,
  type ThumbnailShot,
} from "@/lib/thumbnailAi";
import { downloadDataUrl, toResizedDataUrl } from "@/lib/image";
import { tryPatchArchiveImage, trySaveArchive } from "@/lib/archive";
import { useAppStore } from "@/store/useAppStore";

type ShotResult = { id: string; title: string; image: string; error?: string; pending?: boolean };

const planText = (plan: ThumbnailPlan) =>
  [plan.productSummary, ...allShots(plan).map((s) => `■ ${s.title}\n${s.scene}`)].join("\n\n");

export default function ThumbnailsPage() {
  const month = new Date().getMonth() + 1;
  const inSeason = SEASON_ITEMS.filter((s) => s.months.includes(month)).slice(0, 8);
  const fileInput = useRef<HTMLInputElement>(null);

  const product = useAppStore((s) => s.workingProduct);
  const setProduct = useAppStore((s) => s.setWorkingProduct);
  const archiveIdRef = useRef<string | null>(null);
  const [note, setNote] = useState("");
  const [includeMain, setIncludeMain] = useState(true);
  const [subCount, setSubCount] = useState<SubCount>(5);
  const [source, setSource] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [plan, setPlan] = useState<ThumbnailPlan | null>(null);
  const [results, setResults] = useState<Record<string, ShotResult>>({});
  const [phase, setPhase] = useState<"idle" | "planning" | "ready" | "generating">("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [editing, setEditing] = useState<{ shotId: string; title: string; image: string } | null>(null);
  const [naming, setNaming] = useState(false);
  const abortRef = useRef(false);

  const shotOpts = { includeMain, subCount };
  const total = totalShotCount(shotOpts);

  const addFile = useCallback(async (file: Blob | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setError("");
    setPlan(null);
    setResults({});
    setPhase("idle");
    try {
      // 이미지 생성 API용으로 긴 변 1280 이하로 줄여 전송
      setSource(await toResizedDataUrl(file, 1280, 0.88));
    } catch {
      setError("사진을 불러오지 못했습니다. JPG·PNG로 다시 올려 주세요.");
    }
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addFile(e.dataTransfer.files[0]);
  };

  const fillProductName = async () => {
    if (!source) return setError("먼저 상품 사진을 올려 주세요.");
    setNaming(true);
    setError("");
    try {
      const res = await fetch("/api/thumbnails/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: source }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setProduct(String(json.product ?? "").trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "상품명 자동 채우기에 실패했습니다.");
    } finally {
      setNaming(false);
    }
  };

  const makePlan = async () => {
    if (!source || !product.trim()) return setError("상품 사진과 상품명을 넣어 주세요.");
    if (total < 1) return setError("메인 또는 서브 썸네일을 하나 이상 선택해 주세요.");
    setPhase("planning");
    setError("");
    setPlan(null);
    setResults({});
    try {
      const res = await fetch("/api/thumbnails/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: source,
          product: product.trim(),
          note,
          includeMain,
          subCount,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPlan(json);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "구성에 실패했습니다.");
      setPhase("idle");
    }
  };

  const generateOne = async (shot: ThumbnailShot): Promise<ShotResult> => {
    const res = await fetch("/api/thumbnails/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: source, product: product.trim(), shot }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "생성 실패");
    return { id: json.id, title: json.title, image: json.image };
  };

  const generateAll = async () => {
    if (!plan || !source) return;
    abortRef.current = false;
    const shots = allShots(plan);
    setPhase("generating");
    setProgress({ done: 0, total: shots.length });
    setResults(Object.fromEntries(shots.map((s) => [s.id, { id: s.id, title: s.title, image: "", pending: true }])));
    archiveIdRef.current = await trySaveArchive({
      kind: "thumbnail",
      title: `썸네일 ${shots.length}장`,
      product: product.trim(),
      text: planText(plan),
    });

    // 동시에 2장씩 — 한도·타임아웃 완화
    const queue = [...shots];
    let done = 0;
    const workers = [0, 1].map(async () => {
      while (queue.length && !abortRef.current) {
        const shot = queue.shift()!;
        try {
          const result = await generateOne(shot);
          if (abortRef.current) return;
          setResults((prev) => ({ ...prev, [shot.id]: result }));
          void tryPatchArchiveImage(archiveIdRef.current, shot.id, result.image);
        } catch (err) {
          if (abortRef.current) return;
          setResults((prev) => ({
            ...prev,
            [shot.id]: {
              id: shot.id,
              title: shot.title,
              image: "",
              error: err instanceof Error ? err.message : "생성 실패",
            },
          }));
        }
        done += 1;
        setProgress({ done, total: shots.length });
      }
    });
    await Promise.all(workers);
    if (!abortRef.current) setPhase("ready");
  };

  const stop = () => {
    abortRef.current = true;
    setPhase("ready");
  };

  const retryOne = async (shot: ThumbnailShot) => {
    setResults((prev) => ({ ...prev, [shot.id]: { id: shot.id, title: shot.title, image: "", pending: true } }));
    try {
      const result = await generateOne(shot);
      setResults((prev) => ({ ...prev, [shot.id]: result }));
      void tryPatchArchiveImage(archiveIdRef.current, shot.id, result.image);
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [shot.id]: { id: shot.id, title: shot.title, image: "", error: err instanceof Error ? err.message : "생성 실패" },
      }));
    }
  };

  const mainResult = plan?.main ? results[plan.main.id] : undefined;
  const subResults = plan?.subs.map((s) => results[s.id]) ?? [];
  const finishedCount = Object.values(results).filter((r) => r?.image).length;
  const plannedTotal = plan ? allShots(plan).length : total;

  return (
    <>
      <PageHeader
        title="썸네일 제조기"
        description="상품 사진 한 장을 올리면, 메인·서브 장수를 골라 AI가 구성을 잡고 참고 사진 기반으로 이미지를 만듭니다."
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card title="입력">
          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInput.current?.click()}
              className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition ${
                dragging ? "border-emerald-500 bg-emerald-50" : "border-stone-300 hover:border-emerald-400 hover:bg-stone-50"
              }`}
            >
              {source ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL 미리보기
                <img src={source} alt="업로드한 상품" className="max-h-44 rounded-lg object-contain" />
              ) : (
                <>
                  <p className="text-3xl" aria-hidden>
                    📷
                  </p>
                  <p className="mt-2 text-sm font-medium text-stone-700">상품 사진 1장 올리기</p>
                  <p className="mt-1 text-xs text-stone-400">드래그 또는 클릭 · JPG/PNG</p>
                </>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void addFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            {source && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setSource("");
                  setPlan(null);
                  setResults({});
                  setPhase("idle");
                }}
              >
                사진 다시 고르기
              </Button>
            )}

            <Field label="상품명">
              <div className="flex gap-2">
                <TextInput
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="예: 제주 감귤, 해남 절임배추"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 whitespace-nowrap"
                  onClick={fillProductName}
                  disabled={!source || naming || phase === "planning" || phase === "generating"}
                >
                  {naming ? "분석 중…" : "AI 채우기"}
                </Button>
              </div>
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {inSeason.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setProduct(s.name)}
                  className={`rounded-full px-2.5 py-1 text-xs ${product === s.name ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"}`}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-stone-700">메인 썸네일</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { v: true, label: "만들기", hint: "히어로 컷 1장" },
                    { v: false, label: "안 함", hint: "서브만 제작" },
                  ] as const
                ).map((o) => (
                  <button
                    key={String(o.v)}
                    type="button"
                    onClick={() => {
                      setIncludeMain(o.v);
                      setPlan(null);
                      setResults({});
                      setPhase("idle");
                    }}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      includeMain === o.v ? "border-transparent bg-[#07140f] text-amber-100" : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{o.label}</span>
                    <span className={`text-xs ${includeMain === o.v ? "text-white/70" : "text-stone-500"}`}>{o.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-stone-700">
                서브 썸네일 <span className="font-normal text-stone-400">({subCount}장)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUB_COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setSubCount(n);
                      setPlan(null);
                      setResults({});
                      setPhase("idle");
                    }}
                    className={`min-w-9 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition ${
                      subCount === n ? "bg-emerald-600 text-white shadow-sm" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-stone-500">0이면 서브 없이 메인만 만듭니다. 장수가 많을수록 시간·요금이 늘어납니다.</p>
            </div>

            <Field label="참고 메모 (선택)" hint="예: 선물용, 사람이 들고 있는 메인 원함">
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="강조하고 싶은 연출" />
            </Field>

            <Button className="w-full py-3" onClick={makePlan} disabled={!source || !product.trim() || total < 1 || phase === "planning" || phase === "generating"}>
              {phase === "planning" ? "구성 잡는 중…" : `① 썸네일 구성 잡기 (${planLabel(shotOpts)})`}
            </Button>
            {plan && (
              <Button className="w-full py-3" variant="secondary" onClick={phase === "generating" ? stop : generateAll} disabled={phase === "planning"}>
                {phase === "generating"
                  ? `생성 중 ${progress.done}/${progress.total} · 중단`
                  : `② 이미지 생성하기 (${finishedCount > 0 ? "이어서/다시" : `${plannedTotal}장`})`}
              </Button>
            )}
            {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          </div>
        </Card>

        <div className="space-y-6">
          {!plan && phase !== "planning" && (
            <EmptyState>왼쪽에서 상품 사진을 올리고 메인·서브 장수를 고른 뒤 구성을 잡으면, 장면 목록과 생성된 이미지가 여기에 표시됩니다.</EmptyState>
          )}
          {phase === "planning" && (
            <Card>
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-stone-500">
                <div className="size-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                상품 사진을 읽고 {planLabel(shotOpts)} 장면을 짜는 중…
              </div>
            </Card>
          )}

          {plan && (
            <>
              {plan.main && (
                <Card title="메인 썸네일" actions={<span className="text-xs text-stone-400">{plan.productSummary}</span>}>
                  <ShotCard
                    shot={plan.main}
                    result={mainResult}
                    badge="MAIN"
                    onRetry={() => void retryOne(plan.main!)}
                    onDownload={() => mainResult?.image && downloadDataUrl(mainResult.image, `${product || "product"}-main.png`)}
                    onEdit={() =>
                      mainResult?.image && setEditing({ shotId: plan.main!.id, title: plan.main!.title, image: mainResult.image })
                    }
                  />
                </Card>
              )}

              {plan.subs.length > 0 && (
                <Card
                  title={`서브 썸네일 ${plan.subs.length}장`}
                  actions={
                    phase === "generating" ? (
                      <span className="text-xs text-emerald-700">
                        {progress.done}/{progress.total}
                      </span>
                    ) : !plan.main ? (
                      <span className="text-xs text-stone-400">{plan.productSummary}</span>
                    ) : undefined
                  }
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {plan.subs.map((shot, i) => (
                      <ShotCard
                        key={shot.id}
                        shot={shot}
                        result={subResults[i]}
                        badge={`${i + 1}`}
                        compact
                        onRetry={() => void retryOne(shot)}
                        onDownload={() => results[shot.id]?.image && downloadDataUrl(results[shot.id].image, `${product || "product"}-sub${i + 1}.png`)}
                        onEdit={() =>
                          results[shot.id]?.image && setEditing({ shotId: shot.id, title: shot.title, image: results[shot.id].image })
                        }
                      />
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {editing && (
        <ThumbnailEditor
          image={editing.image}
          title={editing.title}
          onClose={() => setEditing(null)}
          onApply={(dataUrl) => {
            setResults((prev) => ({
              ...prev,
              [editing.shotId]: {
                ...(prev[editing.shotId] ?? { id: editing.shotId, title: editing.title, image: "" }),
                image: dataUrl,
                error: undefined,
                pending: false,
              },
            }));
            void tryPatchArchiveImage(archiveIdRef.current, editing.shotId, dataUrl);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ShotCard({
  shot,
  result,
  badge,
  compact,
  onRetry,
  onDownload,
  onEdit,
}: {
  shot: ThumbnailShot;
  result?: ShotResult;
  badge: string;
  compact?: boolean;
  onRetry: () => void;
  onDownload: () => void;
  onEdit: () => void;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-stone-200 bg-white ${compact ? "" : "grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]"}`}>
      <div className={`relative bg-stone-100 ${compact ? "aspect-square" : "aspect-square md:aspect-auto md:min-h-72"}`}>
        {result?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.image} alt={shot.title} className="size-full object-cover" />
        ) : result?.pending ? (
          <div className="grid size-full place-items-center bg-linear-to-br from-stone-100 via-emerald-50/40 to-stone-100">
            <div className="flex flex-col items-center gap-3">
              <div className="relative size-12">
                <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-emerald-200 border-t-emerald-600" />
                <div className="absolute inset-2 animate-pulse rounded-full bg-emerald-100/80" />
              </div>
              <p className="animate-pulse text-xs font-medium text-stone-500">생성 중…</p>
            </div>
          </div>
        ) : result?.error ? (
          <div className="grid size-full place-items-center p-3 text-center text-xs text-rose-600">{result.error}</div>
        ) : (
          <div className="grid size-full place-items-center p-4 text-center text-xs text-stone-400">아직 생성 전</div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">{badge}</span>
      </div>
      <div className={`space-y-2 ${compact ? "p-3" : "p-4"}`}>
        <p className="font-semibold text-stone-900">{shot.title}</p>
        <p className={`text-stone-600 ${compact ? "line-clamp-3 text-xs" : "text-sm leading-relaxed"}`}>{shot.scene}</p>
        <div className="flex flex-wrap gap-1">
          {result?.image && (
            <>
              <Button variant="secondary" onClick={onEdit}>
                편집하기
              </Button>
              <Button variant="ghost" onClick={onDownload}>
                다운로드
              </Button>
            </>
          )}
          {(result?.error || result?.image) && (
            <Button variant="ghost" onClick={onRetry}>
              다시 생성
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
