"use client";

import { useState } from "react";
import { Button, CopyButton, Notice } from "@/components/ui";
import { splitRelatedSpend, type SpendKeyword } from "@/lib/adOptions";
import type { AdRow } from "@/lib/coupangAds";
import { won } from "@/lib/format";

interface Judgement {
  product: string;
  keyword: string;
  unrelated: boolean;
  reason: string;
}

export function IrrelevantKeywords({ rows, costMultiplier }: { rows: AdRow[]; costMultiplier: number }) {
  const { related, products } = splitRelatedSpend(rows, costMultiplier);
  const [items, setItems] = useState<Judgement[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ads/irrelevant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products }),
      });
      const data = (await res.json()) as { items?: Judgement[]; error?: string };
      if (!res.ok) throw new Error(data.error || "분석을 끝내지 못했어요");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석을 끝내지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const unrelated = items?.filter((i) => i.unrelated) ?? [];

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">상품과 안 맞는 키워드</h3>
          <p className="mt-1 text-sm text-stone-500">
            매출이 없어도 상품명에 있는 품목(마늘 상품의 깐마늘처럼)은 제외하지 않아요. 품목이 안 들어간 키워드만 한 번 더 봐요.
          </p>
        </div>
        <Button type="button" variant="secondary" disabled={busy || products.length === 0} onClick={ask}>
          {busy ? "보는 중" : "안 맞는 키워드 찾기"}
        </Button>
      </div>

      <p className="mt-3 text-sm text-stone-600">
        관련으로 둔 키워드 <b className="tabular-nums">{related.length}</b>개
        {related.length > 0 && <span className="text-stone-400"> · {preview(related)}</span>}
      </p>

      {products.length === 0 ? (
        <p className="mt-2 text-sm text-stone-400">품목이 안 들어간, 매출 0원 키워드가 없어요.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {products.slice(0, 5).map((p) => (
            <li key={p.product} className="text-stone-700">
              <span className="font-medium">{shortName(p.product)}</span>
              <span className="text-stone-400"> · {p.keywords.map((k) => k.keyword).slice(0, 6).join(", ")}</span>
              <span className="tabular-nums text-stone-500"> · {won(p.spend)}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <Notice tone="loss" className="mt-3">
          {error}
        </Notice>
      )}

      {unrelated.length > 0 && (
        <div className="mt-4 border-t border-stone-100 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-stone-800">빼는 편이 나은 키워드 {unrelated.length}개</p>
            <CopyButton text={unrelated.map((i) => i.keyword).join("\n")} label="제외 복사" />
          </div>
          <ul className="space-y-2">
            {unrelated.map((item) => (
              <li key={`${item.product}-${item.keyword}`} className="text-sm">
                <span className="font-medium text-stone-900">{item.keyword}</span>
                <span className="text-stone-500"> — {item.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function shortName(name: string) {
  const trimmed = name.replace(/\[[^\]]*\]/g, "").trim();
  return trimmed.length > 28 ? `${trimmed.slice(0, 28)}…` : trimmed || name;
}

function preview(related: SpendKeyword[]) {
  return related
    .slice(0, 4)
    .map((k) => k.keyword)
    .join(", ");
}
