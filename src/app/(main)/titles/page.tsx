"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TitleBuilder, type TitleWord } from "@/components/keyword/TitleBuilder";
import { keywordHref, useKeywordReport } from "@/components/keyword/shared";
import { Button, Card, CopyButton, EmptyState, Field, PageHeader, TextInput } from "@/components/ui";
import { normalizeKeyword } from "@/lib/keyword";
import { TITLE_LIMIT, TITLE_PRESETS, TITLE_TAGS, parseProductTitle, type TitleIdeas } from "@/lib/titleMaker";
import { trySaveArchive } from "@/lib/archive";
import { useAppStore } from "@/store/useAppStore";

function TitleMakerView({ keyword }: { keyword: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(keyword);
  const { data, error, loading } = useKeywordReport(keyword);
  const addRecentKeyword = useAppStore((s) => s.addRecentKeyword);
  const recent = useAppStore((s) => s.recentKeywords);
  const workingProduct = useAppStore((s) => s.workingProduct);
  const setWorkingProduct = useAppStore((s) => s.setWorkingProduct);

  const [tag, setTag] = useState<string>("산지직송");
  const [picked, setPicked] = useState<string[]>([]);
  const [customWord, setCustomWord] = useState("");
  const [extraWords, setExtraWords] = useState<TitleWord[]>([]);
  const [note, setNote] = useState("");
  const [ai, setAi] = useState<{ data?: TitleIdeas; error?: string; pending?: boolean }>({});

  useEffect(() => {
    if (keyword) addRecentKeyword(keyword);
  }, [keyword, addRecentKeyword]);

  const searchWords = useMemo(() => data?.titleWords ?? [], [data]);
  const allWords = useMemo(() => {
    const seen = new Set<string>();
    const merged: TitleWord[] = [];
    for (const w of [...searchWords, ...extraWords]) {
      if (seen.has(w.word)) continue;
      seen.add(w.word);
      merged.push(w);
    }
    return merged;
  }, [searchWords, extraWords]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = normalizeKeyword(draft);
    if (next) router.push(`/titles?q=${encodeURIComponent(next)}`);
  };

  const addCustom = () => {
    const word = customWord.trim().replace(/\s+/g, "");
    if (!word) return;
    setExtraWords((prev) => (prev.some((w) => w.word === word) ? prev : [...prev, { word }]));
    setPicked((prev) => (prev.includes(word) ? prev : [...prev, word]));
    setCustomWord("");
  };

  const addPreset = (word: string) => {
    setExtraWords((prev) => (prev.some((w) => w.word === word) ? prev : [...prev, { word }]));
    setPicked((prev) => (prev.includes(word) ? prev : [...prev, word]));
  };

  const generateAi = async () => {
    if (!keyword) return;
    setAi({ pending: true });
    try {
      const res = await fetch("/api/titles/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, modifiers: [...picked, ...allWords.map((w) => w.word)].slice(0, 40), note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const ideas = json as TitleIdeas;
      setAi({ data: ideas });
      void trySaveArchive({
        kind: "titles",
        title: `AI 상품명 ${ideas.titles.length}개`,
        product: keyword,
        text: [...ideas.titles.map((t) => `${t.title}\n  └ ${t.why}`), ...ideas.tips.map((t) => `- ${t}`)].join("\n"),
      });
    } catch (err) {
      setAi({ error: err instanceof Error ? err.message : "생성에 실패했습니다." });
    }
  };

  const applyTitle = (title: string) => {
    const parsed = parseProductTitle(title, keyword);
    if (parsed.tag) setTag(parsed.tag);
    setExtraWords((prev) => {
      const next = [...prev];
      parsed.words.forEach((w) => {
        if (!next.some((x) => x.word === w) && !searchWords.some((x) => x.word === w)) next.push({ word: w });
      });
      return next;
    });
    setPicked(parsed.words);
  };

  return (
    <>
      <PageHeader
        title="상품명 제조기"
        description="[산지직송] 국내산 파김치 쪽파처럼, 앞꼬리표 + 수식어로 네이버·쿠팡용 상품명을 만듭니다."
      />

      <Card className="mb-6">
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <TextInput
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="메인 키워드 (예: 절임배추, 제주감귤)"
            className="min-w-64 flex-1"
          />
          <Button type="submit" disabled={!normalizeKeyword(draft)}>
            수식어 불러오기
          </Button>
        </form>
        {recent.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recent.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => router.push(`/titles?q=${encodeURIComponent(k)}`)}
                className={`rounded-full px-3 py-1 text-xs transition ${k === keyword ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
              >
                {k}
              </button>
            ))}
          </div>
        )}
      </Card>

      {!keyword ? (
        <EmptyState>위에서 메인 키워드를 입력하면 연관 수식어와 조합판이 열려요.</EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card title="앞꼬리표 [ ]">
              <p className="mb-3 text-xs text-stone-500">상품명 맨 앞의 대괄호. 하나만 고르세요.</p>
              <div className="flex flex-wrap gap-1.5">
                {TITLE_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTag(t)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      tag === t ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-200 bg-white text-stone-700 hover:border-emerald-300"
                    }`}
                  >
                    [{t}]
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTag("")}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                    !tag ? "border-stone-500 bg-stone-800 text-white" : "border-stone-200 text-stone-500 hover:bg-stone-50"
                  }`}
                >
                  없음
                </button>
              </div>
            </Card>

            <Card
              title={`‘${keyword}’ 수식어`}
              actions={
                data && (
                  <a href={keywordHref(keyword)} className="text-xs text-emerald-700 hover:underline">
                    키워드 정밀 분석 →
                  </a>
                )
              }
            >
              {loading && <p className="py-8 text-center text-sm text-stone-400">연관 키워드에서 수식어를 뽑는 중…</p>}
              {error && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error} · 아래 프리셋·직접 추가로도 만들 수 있어요.</p>}
              {!loading && allWords.length === 0 && !error && (
                <p className="mb-3 text-sm text-stone-500">검색어 기반 수식어가 없어요. 프리셋을 쓰거나 단어를 직접 추가해 주세요.</p>
              )}
              {(allWords.length > 0 || !loading) && (
                <TitleBuilder keyword={keyword} words={allWords} picked={picked} onPickedChange={setPicked} tag={tag || null} />
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                <TextInput value={customWord} onChange={(e) => setCustomWord(e.target.value)} placeholder="수식어 직접 추가 (예: 20kg)" className="w-48" />
                <Button variant="secondary" type="button" onClick={addCustom} disabled={!customWord.trim()}>
                  추가
                </Button>
              </div>
            </Card>

            <Card title="자주 쓰는 수식어">
              <div className="space-y-4">
                {TITLE_PRESETS.map((group) => (
                  <div key={group.category}>
                    <p className="mb-1.5 text-xs font-semibold text-stone-500">{group.category}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.words.map((word) => (
                        <button
                          key={word}
                          type="button"
                          onClick={() => addPreset(word)}
                          className={`rounded-full border px-2.5 py-1 text-xs transition ${
                            picked.includes(word) ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-stone-200 text-stone-600 hover:border-emerald-300"
                          }`}
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="AI 상품명 추천">
              <Field label="참고 메모 (선택)" hint="예: 선물용 3kg, 해남산, 백화점 납품용">
                <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="강조하고 싶은 점" />
              </Field>
              <p className="mt-2 text-[11px] text-stone-400">AI도 [산지직송] 국내산 … 형식으로 추천합니다.</p>
              <Button className="mt-3 w-full" onClick={generateAi} disabled={ai.pending}>
                {ai.pending ? "상품명 고르는 중…" : "✨ AI로 5개 추천받기"}
              </Button>
              {ai.error && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{ai.error}</p>}
              {ai.data && (
                <ul className="mt-4 space-y-3">
                  {ai.data.titles.map((t) => (
                    <li key={t.title} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-stone-900">{t.title}</p>
                        <span className={`shrink-0 text-[11px] ${t.title.length > TITLE_LIMIT ? "text-rose-500" : "text-stone-400"}`}>
                          {t.title.length}자
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">{t.why}</p>
                      <div className="mt-2 flex gap-1">
                        <Button variant="ghost" onClick={() => applyTitle(t.title)}>
                          조합판에 적용
                        </Button>
                        <CopyButton text={t.title} />
                        <Button
                          variant="ghost"
                          onClick={() => setWorkingProduct(t.title)}
                          title="검색 태그·썸네일·마케팅 화면에 이 상품명이 자동으로 채워집니다"
                        >
                          {workingProduct === t.title ? "작업 상품 ✓" : "작업 상품으로"}
                        </Button>
                      </div>
                    </li>
                  ))}
                  {ai.data.tips.length > 0 && (
                    <li className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="mb-1 font-semibold">주의할 점</p>
                      <ul className="list-disc space-y-0.5 pl-4">
                        {ai.data.tips.map((tip) => (
                          <li key={tip}>{tip}</li>
                        ))}
                      </ul>
                    </li>
                  )}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

export default function TitlesPage() {
  return (
    <Suspense fallback={<PageHeader title="상품명 제조기" description="불러오는 중…" />}>
      <TitlesGate />
    </Suspense>
  );
}

function TitlesGate() {
  const keyword = normalizeKeyword(useSearchParams().get("q"));
  return <TitleMakerView key={keyword || "empty"} keyword={keyword} />;
}
