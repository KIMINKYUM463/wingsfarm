"use client";

import { useState } from "react";
import type { SeasonCategory, SourcingCandidate, SourcingManualScores } from "@/types";
import { Button, Field, Notice, NumberInput, Select, TextArea, TextInput, Toggle } from "@/components/ui";
import { num, uid } from "@/lib/format";
import { errorMessage } from "@/lib/http";
import type { KeywordReport } from "@/lib/keyword";
import { useAppStore } from "@/store/useAppStore";

const CATEGORIES: SeasonCategory[] = ["과일", "채소", "수산", "축산", "가공"];

const MANUAL: { key: keyof SourcingManualScores; label: string; low: string; high: string }[] = [
  { key: "competition", label: "경쟁 강도", low: "대형 셀러 가득", high: "경쟁 약함" },
  { key: "safety", label: "파손·변질 안전", low: "잘 무르고 터짐", high: "튼튼함" },
  { key: "supply", label: "공급 안정성", low: "물량·품질 들쭉날쭉", high: "안정적" },
];

/** 네이버 광고 경쟁도 → 경쟁 점수 기본값 */
const COMPETITION_FROM_AD: Record<string, number> = { 높음: 2, 중간: 3, 낮음: 4 };

export const emptyCandidate = (channelId: string): SourcingCandidate => ({
  id: uid(),
  name: "",
  category: "과일",
  supplyPrice: 0,
  salePrice: 0,
  extraCost: 0,
  channelId,
  taxFree: true,
  monthlySearch: null,
  scores: { competition: 3, safety: 3, supply: 3 },
  note: "",
});

export function SourcingForm({ initial, onDone }: { initial: SourcingCandidate; onDone: () => void }) {
  const channels = useAppStore((s) => s.channels);
  const upsertSourcing = useAppStore((s) => s.upsertSourcing);
  const [c, setC] = useState(initial);
  const [keyword, setKeyword] = useState(initial.name);
  const [loading, setLoading] = useState(false);
  const [searchNote, setSearchNote] = useState("");
  const set = <K extends keyof SourcingCandidate>(key: K, value: SourcingCandidate[K]) => setC((x) => ({ ...x, [key]: value }));
  const setScore = (key: keyof SourcingManualScores, value: number) => setC((x) => ({ ...x, scores: { ...x.scores, [key]: value } }));

  const loadSearch = async () => {
    setLoading(true);
    setSearchNote("");
    try {
      const res = await fetch(`/api/keyword?q=${encodeURIComponent(keyword.trim())}`);
      const report = (await res.json()) as KeywordReport & { error?: string };
      if (!res.ok) throw new Error(report.error);
      if (!report.volume) throw new Error(report.notices.find((n) => n.service === "searchad")?.message ?? "검색수를 받지 못했어요.");
      const competition = COMPETITION_FROM_AD[report.volume.adCompetition];
      setC((x) => ({ ...x, monthlySearch: report.volume!.total, scores: competition ? { ...x.scores, competition } : x.scores }));
      setSearchNote(`월 ${num(report.volume.total)}회 · 광고 경쟁 ${report.volume.adCompetition}${competition ? " → 경쟁 점수에 반영" : ""}`);
    } catch (err) {
      setSearchNote(errorMessage(err, "검색수를 불러오지 못했어요."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="품목·상품">
          <TextInput value={c.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 샤인머스캣 2kg" />
        </Field>
        <Field label="분류">
          <Select value={c.category} onChange={(e) => set("category", e.target.value as SeasonCategory)}>
            {CATEGORIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </Field>
        <Field label="공급가">
          <NumberInput value={c.supplyPrice} onValueChange={(v) => set("supplyPrice", v)} suffix="원" />
        </Field>
        <Field label="예상 판매가">
          <NumberInput value={c.salePrice} onValueChange={(v) => set("salePrice", v)} suffix="원" />
        </Field>
        <Field label="셀러부담 택배·포장비" hint="공급가에 택배비가 포함이면 0">
          <NumberInput value={c.extraCost} onValueChange={(v) => set("extraCost", v)} suffix="원" />
        </Field>
        <Field label="판매 채널">
          <Select value={c.channelId} onChange={(e) => set("channelId", e.target.value)}>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Toggle checked={c.taxFree} onChange={(v) => set("taxFree", v)} label="면세 (가공하지 않은 농·수산물)" />

      <div className="rounded-xl bg-stone-50 p-3">
        <p className="mb-2 text-xs font-medium text-stone-600">검색 수요 (네이버 월간 검색수)</p>
        <div className="flex flex-wrap items-center gap-2">
          <TextInput className="w-44!" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="대표 키워드" aria-label="대표 키워드" />
          <Button variant="secondary" onClick={loadSearch} disabled={loading || !keyword.trim()}>
            {loading ? "불러오는 중…" : "검색수 불러오기"}
          </Button>
          <NumberInput className="w-36" value={c.monthlySearch ?? 0} onValueChange={(v) => set("monthlySearch", v > 0 ? v : null)} suffix="회" aria-label="월간 검색수" />
        </div>
        {searchNote && <p className="mt-1.5 text-xs text-stone-500">{searchNote}</p>}
      </div>

      <div className="space-y-3">
        {MANUAL.map((m) => (
          <div key={m.key}>
            <div className="flex justify-between text-xs">
              <span className="font-medium text-stone-600">{m.label}</span>
              <span className="tabular-nums text-emerald-700">{c.scores[m.key]}점</span>
            </div>
            <input type="range" min={1} max={5} step={1} value={c.scores[m.key]} onChange={(e) => setScore(m.key, Number(e.target.value))} className="w-full accent-emerald-600" aria-label={m.label} />
            <div className="flex justify-between text-[11px] text-stone-400">
              <span>1 {m.low}</span>
              <span>5 {m.high}</span>
            </div>
          </div>
        ))}
      </div>

      <Field label="메모">
        <TextArea rows={2} value={c.note} onChange={(e) => set("note", e.target.value)} placeholder="공급처 후보, 샘플 확인 결과 등" />
      </Field>
      {c.salePrice > 0 && c.salePrice <= c.supplyPrice && <Notice tone="loss">판매가가 공급가보다 낮거나 같아요.</Notice>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          취소
        </Button>
        <Button
          onClick={() => {
            upsertSourcing({ ...c, name: c.name.trim(), note: c.note.trim() });
            onDone();
          }}
          disabled={!c.name.trim() || c.supplyPrice <= 0 || c.salePrice <= 0}
        >
          저장
        </Button>
      </div>
    </div>
  );
}
