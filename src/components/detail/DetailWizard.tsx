"use client";

/* eslint-disable @next/next/no-img-element -- data URL 미리보기 */
import { useState, type ReactNode } from "react";
import { Button, Card, Field, TextArea, TextInput } from "@/components/ui";
import { DETAIL_THEMES, VOLUMES, VOLUME_PLANS, createProject, type DetailProject, type DetailSection, type ThemeId, type Volume } from "@/lib/detailPage";
import { GENERATION_METHODS, LIMITS, type DetailGenerateBody, type GenerationMethod, type KeywordGroups } from "@/lib/detailPageAi";
import { errorText, postJson } from "@/lib/http";
import { compressDataUrl, splitTallImage, toResizedDataUrl } from "@/lib/image";
import { useStoreName } from "@/lib/useStoreName";
import { useAppStore } from "@/store/useAppStore";

const stepLabels = (method: GenerationMethod) => ["기본 정보", "만드는 방식", method === "benchmark" ? "참고 캡처" : "특징 고르기", "사진·디자인"];
const LAST_STEP = 3;

type Reference = { id: string; file: File; preview: string };

function StepHeader({ step, method }: { step: number; method: GenerationMethod }) {
  return (
    <ol className="mb-6 grid grid-cols-4 gap-2">
      {stepLabels(method).map((label, i) => (
        <li key={label} className="flex flex-col gap-1.5">
          <span className={`h-1.5 rounded-full ${i <= step ? "bg-emerald-500" : "bg-stone-200"}`} />
          <span className={`text-xs ${i === step ? "font-bold text-emerald-700" : "text-stone-400"}`}>
            {i + 1}. {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border-2 p-5 text-left transition ${active ? "border-emerald-500 bg-emerald-50" : "border-stone-200 bg-white hover:border-stone-300"}`}
    >
      {children}
    </button>
  );
}

/** 레버페이지식 4단계 입력 → AI 초안 생성 */
export function DetailWizard({ onCreated, onCancel }: { onCreated: (project: DetailProject) => void; onCancel: () => void }) {
  const workingProduct = useAppStore((s) => s.workingProduct);
  const setWorkingProduct = useAppStore((s) => s.setWorkingProduct);

  const [step, setStep] = useState(0);
  const [company, setCompany] = useStoreName();
  const [product, setProduct] = useState(workingProduct);
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<GenerationMethod>("keywords");
  const [keywords, setKeywords] = useState<{ product: string; groups: KeywordGroups["groups"] } | null>(null);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [refs, setRefs] = useState<Reference[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [themeId, setThemeId] = useState<ThemeId>("fresh");
  const [volume, setVolume] = useState<Volume>("standard");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const name = product.trim();

  const loadKeywords = async () => {
    setKeywordsLoading(true);
    setError("");
    try {
      const { groups } = await postJson<KeywordGroups>("/api/detail-page/keywords", { product: name, note: note.trim() });
      setKeywords({ product: name, groups });
      setPicked([]);
    } catch (err) {
      setError(errorText(err, "키워드를 불러오지 못했습니다."));
    } finally {
      setKeywordsLoading(false);
    }
  };

  const goNext = () => {
    if (step === 1 && method === "keywords" && keywords?.product !== name) void loadKeywords();
    setStep((s) => s + 1);
  };

  const canNext = [
    name.length > 0,
    true,
    method === "keywords" ? picked.length > 0 || custom.trim().length > 0 : refs.length > 0,
    true,
  ][step];

  const togglePick = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const addRefs = async (files: File[]) => {
    const room = LIMITS.references - refs.length;
    const added = await Promise.all(
      files.slice(0, room).map(async (file) => ({ id: `${file.name}-${file.size}-${Math.random()}`, file, preview: await toResizedDataUrl(file, 480, 0.7) })),
    );
    setRefs((r) => [...r, ...added]);
  };

  const addPhotos = async (files: File[]) => {
    const room = LIMITS.productImages - photos.length;
    const added = await Promise.all(files.slice(0, room).map((f) => toResizedDataUrl(f, 1400, 0.88)));
    setPhotos((p) => [...p, ...added]);
  };

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const tilesPerRef = Math.max(1, Math.floor(LIMITS.referenceTiles / Math.max(1, refs.length)));
      const body: DetailGenerateBody = {
        product: name,
        company: company.trim(),
        note: note.trim(),
        method,
        keywords: method === "keywords" ? picked : [],
        customFeatures: method === "keywords" ? custom.trim() : "",
        references: method === "benchmark" ? (await Promise.all(refs.map((r) => splitTallImage(r.file, { maxTiles: tilesPerRef })))).flat() : [],
        productImages: await Promise.all(photos.map((p) => compressDataUrl(p, 512, 0.8))),
        volume,
      };
      const draft = await postJson<{ projectName: string; sections: DetailSection[] }>("/api/detail-page/generate", body);
      setWorkingProduct(name);
      onCreated(createProject({ name: draft.projectName, product: name, company: body.company, themeId, productImages: photos, sections: draft.sections }));
    } catch (err) {
      setError(errorText(err, "상세페이지를 만들지 못했습니다."));
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <Card className="mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto size-14 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
        <p className="mt-6 text-lg font-bold text-stone-800">AI가 상세페이지 {VOLUME_PLANS[volume].length}개 섹션을 쓰고 있어요</p>
        <p className="mt-2 text-sm text-stone-500">
          {method === "benchmark" ? "참고 상세페이지의 구성을 읽고, " : ""}
          {photos.length > 0 ? "상품 사진을 섹션에 배치하는 중… " : ""}보통 30초~1분 걸립니다.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <StepHeader step={step} method={method} />

      {step === 0 && (
        <div className="space-y-4">
          <Field label="업체명 (농원·스토어 이름)" hint="메인 표지에 표시됩니다. 출고 지연 안내와 같은 값을 씁니다.">
            <TextInput value={company} onChange={(e) => setCompany(e.target.value)} placeholder="예: 햇살농원" />
          </Field>
          <Field label="상품명 *">
            <TextInput value={product} onChange={(e) => setProduct(e.target.value)} placeholder="예: 성주 꿀참외 3kg 가정용" />
          </Field>
          <Field label="알고 있는 사실 (선택)" hint="산지·중량·당도·수확 시기·포장 등. 적어 주면 [입력 필요] 칸이 줄어듭니다.">
            <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 경북 성주, 3kg 10~13과, 당도 13브릭스 이상 선별, 아이스박스 포장" />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {GENERATION_METHODS.map((m) => (
            <Choice key={m.id} active={method === m.id} onClick={() => setMethod(m.id)}>
              <p className="text-2xl">{m.id === "keywords" ? "🏷️" : "🔎"}</p>
              <p className="mt-2 font-bold text-stone-800">{m.label}</p>
              <p className="mt-1 text-sm text-stone-500">{m.hint}</p>
            </Choice>
          ))}
        </div>
      )}

      {step === 2 && method === "keywords" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-700">이 상품에 맞는 특징을 골라 주세요 · {picked.length}개 선택</p>
            <Button variant="ghost" onClick={loadKeywords} disabled={keywordsLoading}>
              🔄 다시 추천
            </Button>
          </div>
          {keywordsLoading && <div className="h-40 animate-pulse rounded-xl bg-stone-100" />}
          {!keywordsLoading &&
            keywords?.groups.map((g) => (
              <div key={g.name}>
                <p className="mb-1.5 text-xs font-bold text-stone-400">{g.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.keywords.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => togglePick(k)}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${picked.includes(k) ? "bg-emerald-600 font-semibold text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          <Field label="직접 쓰는 특징 (선택)" hint="상품만의 이야기·장점. 사실만 적어 주세요.">
            <TextArea rows={3} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="예: 3대째 같은 밭에서 재배, 주문 당일 아침 수확" />
          </Field>
        </div>
      )}

      {step === 2 && method === "benchmark" && (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            잘 팔리는 상세페이지를 <b>전체 화면 캡처</b>해서 올려 주세요(최대 {LIMITS.references}장). AI가 구성과 강조 순서만 참고하고 문장은 새로 씁니다.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {refs.map((r) => (
              <div key={r.id} className="relative overflow-hidden rounded-xl ring-1 ring-stone-200">
                <img src={r.preview} alt="참고 상세페이지" className="h-48 w-full object-cover object-top" />
                <button
                  type="button"
                  onClick={() => setRefs((list) => list.filter((x) => x.id !== r.id))}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            {refs.length < LIMITS.references && <UploadTile label="캡처 올리기" multiple onFiles={addRefs} />}
          </div>
          <p className="text-[11px] text-stone-400">크롬 확장 프로그램(예: GoFullPage)으로 페이지 전체를 한 장으로 캡처하면 편합니다. 다른 판매자의 사진·문구를 그대로 쓰면 저작권 문제가 생길 수 있어요.</p>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">
              상품 사진 <span className="font-normal text-stone-400">(최대 {LIMITS.productImages}장 · 첫 장이 메인 표지)</span>
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {photos.map((src, i) => (
                <div key={i} className="group relative overflow-hidden rounded-xl ring-1 ring-stone-200">
                  <img src={src} alt={`상품 사진 ${i + 1}`} className="aspect-square w-full object-cover" />
                  {i === 0 && <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 text-[10px] font-bold text-white">대표</span>}
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/40 px-1 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
                    {i > 0 ? (
                      <button type="button" onClick={() => setPhotos((p) => [p[i], ...p.filter((_, j) => j !== i)])}>
                        대표로
                      </button>
                    ) : (
                      <span />
                    )}
                    <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
              {photos.length < LIMITS.productImages && <UploadTile label="사진 추가" multiple onFiles={addPhotos} square />}
            </div>
            {photos.length === 0 && <p className="mt-2 text-xs text-amber-700">사진 없이도 만들 수 있지만, 실제 상품 사진이 있어야 구매 전환이 좋아요.</p>}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">디자인 테마</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DETAIL_THEMES.map((t) => (
                <Choice key={t.id} active={themeId === t.id} onClick={() => setThemeId(t.id)}>
                  <div className="flex gap-1">
                    {[t.primary, t.accent, t.tint, t.dark].map((c) => (
                      <span key={c} className="size-5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-stone-700">{t.name}</p>
                </Choice>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">분량</p>
            <div className="grid grid-cols-3 gap-2">
              {VOLUMES.map((v) => (
                <Choice key={v.id} active={volume === v.id} onClick={() => setVolume(v.id)}>
                  <p className="font-bold text-stone-800">{v.label}</p>
                  <p className="text-xs text-stone-500">{v.hint}</p>
                </Choice>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))}>
          {step === 0 ? "취소" : "← 이전"}
        </Button>
        {step < LAST_STEP ? (
          <Button onClick={goNext} disabled={!canNext}>
            다음 →
          </Button>
        ) : (
          <Button onClick={generate} className="px-6">
            ✨ 상세페이지 만들기
          </Button>
        )}
      </div>
    </Card>
  );
}

function UploadTile({ label, multiple, square, onFiles }: { label: string; multiple?: boolean; square?: boolean; onFiles: (files: File[]) => void }) {
  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 text-xs font-semibold text-stone-500 hover:border-emerald-400 hover:text-emerald-700 ${square ? "aspect-square" : "h-48"}`}
    >
      <span className="text-xl">＋</span>
      {label}
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          void onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </label>
  );
}
