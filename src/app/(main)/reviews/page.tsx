"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, CopyButton, Field, Notice, PageHeader, TextArea, TextInput } from "@/components/ui";
import { trySaveArchive } from "@/lib/archive";
import { errorMessage, postJson } from "@/lib/http";
import { ISSUE_OWNER_LABEL, MAX_REVIEW_CHARS, type ReviewAnalysis } from "@/lib/reviewAi";
import { countThemes, splitReviews } from "@/lib/reviewKeywords";
import { useAppStore } from "@/store/useAppStore";

const MAX_REVIEWS = 300;

function analysisText(product: string, a: ReviewAnalysis) {
  return [
    `[${product || "리뷰"}] ${a.summary} (긍정 약 ${Math.round(a.positiveShare)}%)`,
    "",
    "■ 불만",
    ...a.issues.map((i) => `- ${i.topic} (약 ${Math.round(i.share)}%, ${ISSUE_OWNER_LABEL[i.owner]}) 원인: ${i.cause} / 조치: ${i.fix}`),
    "",
    "■ 강점",
    ...a.praises.map((p) => `- ${p.point}`),
    "",
    "■ 상세페이지 반영",
    ...a.detailPageIdeas.map((d) => `- ${d}`),
    "",
    "■ 공급처 메시지",
    a.supplierMessage,
  ].join("\n");
}

export default function ReviewsPage() {
  const workingProduct = useAppStore((s) => s.workingProduct);
  const [product, setProduct] = useState(workingProduct);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ReviewAnalysis | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const reviews = splitReviews(text).slice(0, MAX_REVIEWS);
  const themes = countThemes(reviews);
  const complaints = themes.filter((t) => t.theme.tone === "loss").sort((a, b) => b.count - a.count);
  const praises = themes.filter((t) => t.theme.tone === "good").sort((a, b) => b.count - a.count);
  const tooLong = reviews.join("").length > MAX_REVIEW_CHARS;

  const analyze = async () => {
    setPending(true);
    setError("");
    try {
      const analysis = await postJson<ReviewAnalysis>("/api/reviews", { product: product.trim(), reviews });
      setResult(analysis);
      void trySaveArchive({ kind: "reviews", title: `리뷰 ${reviews.length}개 분석`, product: product.trim(), text: analysisText(product.trim(), analysis) });
    } catch (err) {
      setError(errorMessage(err, "리뷰 분석에 실패했어요."));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <PageHeader title="리뷰 분석" description="내 상품(또는 경쟁 상품) 리뷰를 붙여넣으면 반복되는 불만·강점을 뽑아 공급처 피드백, 상세페이지 개선, 답글까지 만들어 드려요." />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card title="리뷰 붙여넣기">
          <div className="space-y-3">
            <Field label="상품">
              <TextInput value={product} onChange={(e) => setProduct(e.target.value)} placeholder="예: 성주 참외 2kg" />
            </Field>
            <Field label={`리뷰 (${reviews.length}개 인식${reviews.length >= MAX_REVIEWS ? ` · 최대 ${MAX_REVIEWS}개` : ""})`} hint="한 줄에 리뷰 하나, 또는 리뷰 사이를 빈 줄로 나눠 주세요">
              <TextArea rows={14} value={text} onChange={(e) => setText(e.target.value)} placeholder={"달고 맛있어요. 포장도 꼼꼼해요\n두 개가 터져서 왔어요ㅠ\n생각보다 작아요"} />
            </Field>
            <details className="text-xs text-stone-500">
              <summary className="cursor-pointer">리뷰를 한 번에 가져오는 법</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>스마트스토어센터 → 리뷰 → 리뷰 관리 → 엑셀 다운로드 → &lsquo;리뷰내용&rsquo; 열을 복사해 붙여넣기</li>
                <li>쿠팡 윙 → 고객관리 → 상품 리뷰에서 복사</li>
                <li>경쟁 상품은 상품 페이지 리뷰를 &lsquo;낮은 별점순&rsquo;으로 정렬해 복사하면 약점을 빨리 찾아요</li>
              </ul>
            </details>
            <Notice className="text-xs">리뷰 글만 OpenAI로 보내요. 고객 이름·아이디가 섞였다면 지우고 붙여넣는 게 안전해요.</Notice>
            {tooLong && <Notice tone="warn">리뷰가 {MAX_REVIEW_CHARS.toLocaleString("ko-KR")}자를 넘어요. 나눠서 분석해 주세요.</Notice>}
            <Button onClick={analyze} disabled={pending || reviews.length < 3 || tooLong}>
              {pending ? "분석 중… (20~40초)" : "AI로 깊게 분석"}
            </Button>
            {error && <Notice tone="loss">{error}</Notice>}
          </div>
        </Card>

        <div className="space-y-5">
          <Card title="빠른 집계 (무료·즉시)">
            {reviews.length === 0 ? (
              <p className="text-sm text-stone-400">리뷰를 붙여넣으면 바로 집계돼요.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { title: "불만", list: complaints, bar: "bg-rose-400" },
                  { title: "칭찬", list: praises, bar: "bg-emerald-500" },
                ].map((group) => (
                  <div key={group.title}>
                    <p className="mb-2 text-sm font-medium text-stone-700">{group.title}</p>
                    {group.list.length === 0 ? (
                      <p className="text-xs text-stone-400">걸린 키워드 없음</p>
                    ) : (
                      <ul className="space-y-2">
                        {group.list.map((t) => (
                          <li key={t.theme.id} title={t.examples.join("\n")}>
                            <div className="flex justify-between text-xs">
                              <span>{t.theme.label}</span>
                              <span className="tabular-nums text-stone-500">
                                {t.count}개 · {Math.round(t.share * 100)}%
                              </span>
                            </div>
                            <div className="mt-0.5 h-1.5 rounded-full bg-stone-100">
                              <div className={`h-full rounded-full ${group.bar}`} style={{ width: `${Math.max(4, t.share * 100)}%` }} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
            {complaints.some((t) => ["damage", "spoiled", "size"].includes(t.theme.id) && t.share >= 0.05) && (
              <Notice tone="warn" className="mt-3 text-xs">
                파손·상함·크기 불만이 5%를 넘어요. 공급처와 포장·선별 기준을 맞추고,{" "}
                <Link href="/claims" className="font-medium underline">
                  클레임 기록
                </Link>
                으로 공급처별 비율을 관리하세요.
              </Notice>
            )}
          </Card>

          {result && (
            <>
              <Card title="AI 분석" actions={<CopyButton text={analysisText(product, result)} label="전체 복사" />}>
                <p className="text-sm leading-relaxed text-stone-700">{result.summary}</p>
                <p className="mt-1 text-xs text-stone-500">긍정 리뷰 약 {Math.round(result.positiveShare)}% (추정)</p>
                <ul className="mt-4 space-y-3">
                  {result.issues.map((issue, i) => (
                    <li key={i} className="rounded-xl border border-stone-200 p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-stone-800">{issue.topic}</span>
                        <Badge tone="loss">약 {Math.round(issue.share)}%</Badge>
                        <Badge>{ISSUE_OWNER_LABEL[issue.owner]} 몫</Badge>
                      </div>
                      {issue.examples.map((ex, j) => (
                        <p key={j} className="mt-1 text-xs italic text-stone-500">&ldquo;{ex}&rdquo;</p>
                      ))}
                      <p className="mt-2 text-sm text-stone-600">원인: {issue.cause}</p>
                      <p className="text-sm text-emerald-800">→ {issue.fix}</p>
                    </li>
                  ))}
                </ul>
              </Card>

              <div className="grid gap-5 sm:grid-cols-2">
                <Card title="강점 (상세·썸네일에 쓰기)">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
                    {result.praises.map((p, i) => (
                      <li key={i}>{p.point}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs font-medium text-stone-500">상세페이지 반영</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-stone-700">
                    {result.detailPageIdeas.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </Card>
                <Card title="공급처에 보낼 메시지" actions={<CopyButton text={result.supplierMessage} />}>
                  <p className="whitespace-pre-wrap text-sm text-stone-700">{result.supplierMessage}</p>
                </Card>
              </div>

              <Card title="리뷰 답글 템플릿">
                <ul className="space-y-3">
                  {result.replyTemplates.map((r, i) => (
                    <li key={i} className="rounded-xl bg-stone-50 p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-500">{r.situation}</span>
                        <CopyButton text={r.text} />
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-stone-700">{r.text}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
