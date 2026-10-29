"use client";

import { useState } from "react";
import { Button, Card, CopyButton, EmptyState, Field, PageHeader, TextInput } from "@/components/ui";
import { SEASON_ITEMS } from "@/lib/data/season";
import { trySaveArchive } from "@/lib/archive";
import { useAppStore } from "@/store/useAppStore";

type Channel = "smartstore" | "coupang";

export default function TagsPage() {
  const month = new Date().getMonth() + 1;
  const inSeason = SEASON_ITEMS.filter((s) => s.months.includes(month)).slice(0, 8);
  const product = useAppStore((s) => s.workingProduct);
  const setProduct = useAppStore((s) => s.setWorkingProduct);
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<Channel>("smartstore");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const limit = channel === "coupang" ? 20 : 10;

  const generate = async () => {
    if (!product.trim()) return setError("상품명을 입력해 주세요.");
    setPending(true);
    setError("");
    setTags([]);
    setTips([]);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: product.trim(), channel, note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const nextTags: string[] = json.tags ?? [];
      const nextTips: string[] = json.tips ?? [];
      setTags(nextTags);
      setTips(nextTips);
      void trySaveArchive({
        kind: "tags",
        title: `${channel === "coupang" ? "쿠팡" : "스마트스토어"} 태그 ${nextTags.length}개`,
        product: product.trim(),
        text: [nextTags.join(", "), ...nextTips.map((t) => `- ${t}`)].join("\n"),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <PageHeader
        title="검색 태그"
        description="스마트스토어(최대 10개)·쿠팡(최대 20개) 검색태그를 AI가 조합합니다. 상품명에 없는 동의어·상태·산지·용도를 채워 노출을 넓힙니다."
      />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card title="입력">
          <div className="space-y-4">
            <Field label="상품명">
              <TextInput value={product} onChange={(e) => setProduct(e.target.value)} placeholder="예: 말랑이 백도복숭아 산지직송" />
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
              <p className="mb-2 text-xs font-medium text-stone-600">채널</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "smartstore" as const, label: "스마트스토어", hint: "최대 10개" },
                    { id: "coupang" as const, label: "쿠팡", hint: "최대 20개" },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChannel(c.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left ${
                      channel === c.id ? "border-transparent bg-[#07140f] text-amber-100" : "border-stone-200 bg-white"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{c.label}</span>
                    <span className={`text-[11px] ${channel === c.id ? "text-white/50" : "text-stone-400"}`}>{c.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <Field label="메모 (선택)" hint="강조할 상태·산지">
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 물렁, 고당도" />
            </Field>
            <Button className="w-full py-3" onClick={generate} disabled={pending || !product.trim()}>
              {pending ? "태그 짜는 중…" : `검색 태그 ${limit}개 만들기`}
            </Button>
            {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          </div>
        </Card>

        <div>
          {!tags.length && !pending && <EmptyState>왼쪽에서 상품명을 넣고 만들면, 붙여넣기용 태그가 여기에 나옵니다.</EmptyState>}
          {pending && (
            <Card>
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-sm text-stone-500">
                <div className="size-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                동의어·산지·용도 태그를 조합하는 중…
              </div>
            </Card>
          )}
          {tags.length > 0 && (
            <Card
              title={`검색 태그 ${tags.length}개`}
              actions={<CopyButton text={tags.join(", ")} label="쉼표로 복사" />}
            >
              <div className="mb-4 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 ring-1 ring-emerald-100">
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={tags.join("\n")} label="줄바꿈 복사" />
                <CopyButton text={tags.join(" ")} label="공백 복사" />
              </div>
              {tips.length > 0 && (
                <ul className="mt-5 space-y-1.5 rounded-xl border border-amber-100 bg-amber-50/80 p-4 text-xs text-amber-950">
                  {tips.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="text-amber-500">✦</span>
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
