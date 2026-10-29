"use client";

import { useState } from "react";
import { Badge, CopyButton } from "@/components/ui";
import { INQUIRY_LABELS, type CsResult } from "@/lib/csAi";
import { CLAIM_TYPES } from "@/lib/data/cs";
import type { Sku } from "@/types";

const SENTIMENT: Record<CsResult["sentiment"], { label: string; tone: "loss" | "warn" | "default" | "good" }> = {
  angry: { label: "😠 많이 화나심", tone: "loss" },
  upset: { label: "😟 속상하심", tone: "warn" },
  neutral: { label: "🙂 보통", tone: "default" },
  positive: { label: "😊 긍정적", tone: "good" },
};

const FOLLOW_UPS = ["더 짧게", "더 정중하게", "공감을 더 담아서", "재발송으로 안내해줘", "전액 환불로 안내해줘"];

const isClaim = (type: CsResult["type"]) => (CLAIM_TYPES as string[]).includes(type);

function Checklist({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-stone-600">{title}</div>
      <ul className="space-y-1 text-sm text-stone-600">
        {items.map((t) => (
          <li key={t}>☐ {t}</li>
        ))}
      </ul>
    </div>
  );
}

/** AI 답변 말풍선. onFollowUp이 있으면(가장 최근 답변) 수정 요청 버튼을 보여준다 */
export function CsReplyBubble({ result, skus, onFollowUp }: { result: CsResult; skus: Sku[]; onFollowUp?: (text: string) => void }) {
  const [reply, setReply] = useState(result.reply);

  if (result.mode === "message") return <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{result.message}</p>;

  const sku = skus.find((s) => s.id === result.matchedSkuId);
  return (
    <div className="space-y-3">
      {result.message && <p className="text-sm leading-relaxed text-stone-800">{result.message}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={isClaim(result.type) ? "loss" : "info"}>{INQUIRY_LABELS[result.type]}</Badge>
        <Badge tone={SENTIMENT[result.sentiment].tone}>{SENTIMENT[result.sentiment].label}</Badge>
        {result.customerName && <Badge>{result.customerName}</Badge>}
        {result.channel && <Badge>{result.channel}</Badge>}
        {sku && <Badge tone="good">{`${sku.productName} ${sku.optionName}`}</Badge>}
      </div>
      <p className="text-sm font-medium text-stone-900">{result.summary}</p>

      {result.extractedText && (
        <details className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
          <summary className="cursor-pointer select-none">읽은 문의 원문 보기</summary>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed">{result.extractedText}</p>
        </details>
      )}

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-800">💌 고객 답변 (수정 가능)</span>
          <CopyButton text={reply} />
        </div>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          className="field-sizing-content min-h-24 w-full resize-none bg-transparent text-sm leading-relaxed text-stone-800 outline-none"
        />
      </div>

      {result.shortReply && (
        <div className="rounded-xl border border-stone-200 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-600">✂️ 짧은 버전 (리뷰 댓글·문자용)</span>
            <CopyButton text={result.shortReply} />
          </div>
          <p className="whitespace-pre-wrap text-sm text-stone-700">{result.shortReply}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Checklist title="📷 추가로 받을 증빙" items={result.evidenceToRequest} />
        <Checklist title="✅ 판매자 할 일" items={result.sellerTodos} />
      </div>

      {onFollowUp && (
        <div className="flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
          {FOLLOW_UPS.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => onFollowUp(text)}
              className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs text-emerald-700 transition hover:bg-emerald-50"
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
