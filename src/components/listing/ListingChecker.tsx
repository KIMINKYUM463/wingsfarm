"use client";

import { useState } from "react";
import { Badge, Card, CopyButton, Field, Notice, Select, Stat, TextArea, TextInput } from "@/components/ui";
import { checkListing, highlightParts, listingScore, type CheckField, type Finding, type Severity } from "@/lib/listingCheck";
import { useAppStore } from "@/store/useAppStore";

const SEVERITY: Record<Severity, { label: string; tone: "loss" | "warn" | "info"; mark: string }> = {
  danger: { label: "위험", tone: "loss", mark: "bg-rose-200 text-rose-900" },
  warn: { label: "주의", tone: "warn", mark: "bg-amber-200 text-amber-900" },
  info: { label: "참고", tone: "info", mark: "bg-sky-100 text-sky-900" },
};

const FIELD_LABEL: Record<CheckField, string> = { title: "상품명", body: "상세 문구", origin: "원산지" };

function Highlighted({ text, findings, field }: { text: string; findings: Finding[]; field: CheckField }) {
  if (!text.trim()) return <span className="text-stone-400">(비어 있음)</span>;
  return (
    <>
      {highlightParts(text, findings, field).map((part, i) =>
        part.severity ? (
          <mark key={i} className={`rounded px-0.5 ${SEVERITY[part.severity].mark}`}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** 같은 규칙·같은 표현이 여러 번 걸리면 한 줄로 묶어 보여준다 */
function groupFindings(findings: Finding[]) {
  const map = new Map<string, Finding & { count: number; fields: Set<CheckField> }>();
  for (const f of findings) {
    const key = `${f.id}:${f.match}`;
    const hit = map.get(key);
    if (hit) {
      hit.count += 1;
      hit.fields.add(f.field);
    } else map.set(key, { ...f, count: 1, fields: new Set([f.field]) });
  }
  return [...map.values()];
}

export function ListingChecker({ initialTitle }: { initialTitle: string }) {
  const skus = useAppStore((s) => s.skus);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState("");
  const [origin, setOrigin] = useState("");
  const input = { title, body, origin };
  const findings = checkListing(input);
  const grouped = groupFindings(findings);
  const score = listingScore(findings);
  const count = (s: Severity) => findings.filter((f) => f.severity === s).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      <Card title="검수할 내용">
        <div className="space-y-3">
          {skus.length > 0 && (
            <Field label="내 상품에서 불러오기 (선택)">
              <Select
                value=""
                onChange={(e) => {
                  const sku = skus.find((s) => s.id === e.target.value);
                  if (sku) setTitle(`${sku.productName} ${sku.optionName}`.trim());
                }}
              >
                <option value="">상품 선택…</option>
                {skus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.productName} {s.optionName}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={`상품명 (${[...title].length}자)`}>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 경북 청송 부사 사과 5kg 16~18과 당도 13Brix 선별" />
          </Field>
          <Field label="원산지 표기" hint="상품명·가격 옆에 표시할 그대로 (예: 국내산(경북 청송군), 칠레산)">
            <TextInput value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="국내산(경북 청송군)" />
          </Field>
          <Field label="상세페이지·옵션 문구 (선택)" hint="상세페이지 글, 대표 문구, 옵션명을 붙여 넣으세요">
            <TextArea rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="아삭하고 달콤한 청송 사과를 산지에서 바로 보내드립니다…" />
          </Field>
        </div>
      </Card>

      <div className="space-y-5">
        <Card title="검수 결과">
          <div className="grid grid-cols-4 gap-2">
            <Stat label="점수" value={score} tone={score >= 85 ? "good" : score >= 60 ? "warn" : "loss"} />
            <Stat label="위험" value={count("danger")} tone={count("danger") ? "loss" : "default"} />
            <Stat label="주의" value={count("warn")} tone={count("warn") ? "warn" : "default"} />
            <Stat label="참고" value={count("info")} />
          </div>

          <div className="mt-4 space-y-2 rounded-xl bg-stone-50 p-3 text-sm leading-relaxed">
            {(["title", "origin", "body"] as const).map((field) => (
              <p key={field} className="whitespace-pre-wrap break-words">
                <span className="mr-2 text-xs font-medium text-stone-500">{FIELD_LABEL[field]}</span>
                <Highlighted text={input[field]} findings={findings} field={field} />
              </p>
            ))}
          </div>

          {grouped.length === 0 ? (
            <Notice tone="good" className="mt-4">
              걸린 표현이 없어요. 그래도 사전에 없는 표현이 있을 수 있으니 최종 확인은 직접 해 주세요.
            </Notice>
          ) : (
            <ul className="mt-4 space-y-2">
              {grouped.map((f) => (
                <li key={`${f.id}:${f.match}`} className="rounded-xl border border-stone-200 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={SEVERITY[f.severity].tone}>{SEVERITY[f.severity].label}</Badge>
                    {f.match && <code className="rounded bg-stone-100 px-1.5 text-xs">{f.match}</code>}
                    <span className="text-sm font-medium text-stone-800">{f.message}</span>
                    <span className="text-xs text-stone-400">
                      {[...f.fields].map((x) => FIELD_LABEL[x]).join("·")}
                      {f.count > 1 && ` ${f.count}곳`}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-stone-600">→ {f.fix}</p>
                  <p className="mt-1 text-xs text-stone-400">근거: {f.basis}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Notice>
          규칙 사전으로 점검하는 무료 기능이에요(AI 요금 없음). 걸렸다고 모두 위법은 아니고, 안 걸렸다고 안전한 것도 아니에요. 효능·인증·원산지는 특히 처벌이 무거우니
          애매하면 빼는 게 안전합니다. <CopyButton text={grouped.map((f) => `[${SEVERITY[f.severity].label}] ${f.match ? `'${f.match}' ` : ""}${f.message} → ${f.fix}`).join("\n")} label="결과 복사" />
        </Notice>
      </div>
    </div>
  );
}
