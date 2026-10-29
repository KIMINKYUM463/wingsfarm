"use client";

import Link from "next/link";
import { useState } from "react";
import type { ClaimRecord } from "@/types";
import { Badge, Button, Card, CopyButton, EmptyState, Modal, Notice, PageHeader, Select, Stat, Table, Tabs } from "@/components/ui";
import { ClaimForm, emptyClaim } from "@/components/claims/ClaimForm";
import { GRADE_ADVICE, MIN_SAMPLE, RESOLUTION_LABEL, claimLedgerId, sinceDate, supplierScores, type Grade, type SupplierScore } from "@/lib/claims";
import { CS_GUIDES } from "@/lib/data/cs";
import { growthText, percent, won } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

const TABS = [
  { id: "score", label: "📊 공급처 스코어카드" },
  { id: "list", label: "🧾 클레임 기록" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const PERIODS = [30, 90, 180, 365];

const GRADE_TONE: Record<Grade, "good" | "info" | "warn" | "loss" | "default"> = { A: "good", B: "info", C: "warn", D: "loss", "-": "default" };

/** 공급처에 보낼 품질 피드백 — 감정 없이 숫자와 요청만 */
function feedbackText(score: SupplierScore, days: number) {
  const lines = (Object.entries(score.byType) as [keyof typeof CS_GUIDES, number][]).sort((a, b) => b[1] - a[1]).map(([type, n]) => `- ${CS_GUIDES[type].label}: ${n}건`);
  return [
    `${score.supplier.name} 사장님, 최근 ${days}일 품질 공유드립니다.`,
    `판매 ${score.sold}개 중 클레임 ${score.claims}건${score.claimRate !== null ? ` (${percent(score.claimRate)})` : ""}, 보상 비용 ${won(score.loss)}이 발생했습니다.`,
    ...lines,
    score.topType ? `특히 '${CS_GUIDES[score.topType].label}'이 많아 포장·선별 기준을 한 번 더 맞춰 주시면 감사하겠습니다. 사진 증빙은 필요하시면 바로 보내드릴게요.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function ClaimsPage() {
  const { suppliers, skus, claims, ledger, removeClaim, removeLedgerEntry } = useAppStore();
  const [tab, setTab] = useState<Tab>("score");
  const [days, setDays] = useState(90);
  const [editing, setEditing] = useState<ClaimRecord | null>(null);

  const since = sinceDate(days);
  const scores = supplierScores(suppliers, skus, claims, ledger, since);
  const recent = claims.filter((c) => c.date >= since).sort((a, b) => b.date.localeCompare(a.date));
  const totalLoss = recent.reduce((s, c) => s + c.loss, 0);
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "삭제된 공급처";
  const skuName = (id: string | null) => {
    const sku = skus.find((s) => s.id === id);
    return sku ? `${sku.productName} ${sku.optionName}` : "-";
  };

  return (
    <>
      <PageHeader
        title="클레임·공급처 관리"
        description="클레임을 기록해 두면 공급처별 클레임률과 손실이 쌓여요. 공급처와 단가·물량을 협상하거나 교체를 결정할 근거가 됩니다."
        actions={
          <>
            <Select className="w-auto!" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="기간">
              {PERIODS.map((d) => (
                <option key={d} value={d}>
                  최근 {d}일
                </option>
              ))}
            </Select>
            <Button onClick={() => setEditing(emptyClaim(suppliers[0]?.id ?? ""))} disabled={suppliers.length === 0}>
              + 클레임 기록
            </Button>
          </>
        }
      />
      {suppliers.length === 0 && (
        <Notice tone="warn" className="mb-5">
          공급처가 없어요. <Link href="/settings" className="font-medium underline">설정</Link>에서 공급처와 상품을 먼저 등록하세요.
        </Notice>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`최근 ${days}일 클레임`} value={`${recent.length}건`} />
        <Stat label="보상 손실" value={won(totalLoss)} tone={totalLoss > 0 ? "loss" : "default"} />
        <Stat label="증빙 없는 클레임" value={`${recent.filter((c) => c.evidence.length === 0).length}건`} hint="공급처 비용 청구가 어려워요" />
        <Stat label="교체 검토 공급처" value={`${scores.filter((s) => s.grade === "D").length}곳`} tone={scores.some((s) => s.grade === "D") ? "loss" : "good"} />
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />

      {tab === "score" ? (
        <div className="space-y-4">
          {scores.length === 0 ? (
            <EmptyState>공급처를 등록하면 스코어카드가 만들어져요.</EmptyState>
          ) : (
            scores.map((s) => (
              <Card key={s.supplier.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-stone-800">{s.supplier.name}</span>
                      <Badge tone={GRADE_TONE[s.grade]}>{s.grade === "-" ? "판매 기록 없음" : `${s.grade}등급`}</Badge>
                      {s.lowSample && <Badge>참고용 · {MIN_SAMPLE}개 미만 판매</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
                      {s.lowSample ? `아직 ${s.sold}개만 팔려 클레임 1건에도 등급이 크게 바뀌어요. 더 쌓인 뒤 판단하세요.` : GRADE_ADVICE[s.grade]}
                    </p>
                  </div>
                  {s.claims > 0 && <CopyButton text={feedbackText(s, days)} label="공급처 피드백 문구 복사" />}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Stat label="판매 수량" value={`${s.sold}개`} hint="장부 기준" />
                  <Stat label="클레임" value={`${s.claims}건`} />
                  <Stat label="클레임률" value={s.claimRate === null ? "-" : percent(s.claimRate)} tone={s.grade === "D" ? "loss" : s.grade === "C" ? "warn" : "default"} />
                  <Stat label="보상 손실" value={won(s.loss)} />
                  <Stat label="공급가 변화" value={s.priceChange === null ? "-" : growthText(s.priceChange)} tone={(s.priceChange ?? 0) > 0.05 ? "warn" : "default"} hint="등록 이후" />
                </div>
                {s.claims > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(Object.entries(s.byType) as [keyof typeof CS_GUIDES, number][]).map(([type, n]) => (
                      <Badge key={type} tone={type === s.topType ? "warn" : "default"}>
                        {CS_GUIDES[type].label} {n}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            ))
          )}
          <p className="text-xs text-stone-400">
            등급 기준(경험치): 클레임률 1% 미만 A · 3% 미만 B · 6% 미만 C · 그 이상 D. 판매 수량은 매출 장부에 상품을 연결해 기록한 것만 셉니다.
          </p>
        </div>
      ) : (
        <Card>
          {recent.length === 0 ? (
            <EmptyState>최근 {days}일 클레임이 없어요.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>접수일</th>
                  <th>공급처</th>
                  <th>상품</th>
                  <th>유형</th>
                  <th>처리</th>
                  <th className="text-right">손실</th>
                  <th>증빙</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap text-xs tabular-nums">{c.date.slice(5)}</td>
                    <td className="whitespace-nowrap">{supplierName(c.supplierId)}</td>
                    <td className="max-w-48 truncate text-xs">{skuName(c.skuId)}</td>
                    <td className="whitespace-nowrap">{CS_GUIDES[c.type].label}</td>
                    <td className="whitespace-nowrap text-xs">{RESOLUTION_LABEL[c.resolution]}</td>
                    <td className="text-right tabular-nums">{won(c.loss)}</td>
                    <td>
                      <Badge tone={c.evidence.length >= CS_GUIDES[c.type].evidence.length ? "good" : c.evidence.length ? "warn" : "loss"}>
                        {c.evidence.length}/{CS_GUIDES[c.type].evidence.length}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <Button variant="ghost" onClick={() => setEditing(c)}>
                        수정
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (!confirm("이 클레임 기록을 지울까요? 장부에 넣은 손실도 함께 지워져요.")) return;
                          removeClaim(c.id);
                          removeLedgerEntry(claimLedgerId(c.id));
                        }}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      <Modal wide open={editing !== null} title={editing && claims.some((c) => c.id === editing.id) ? "클레임 수정" : "클레임 기록"} onClose={() => setEditing(null)}>
        {editing && <ClaimForm initial={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
