"use client";

import { useState } from "react";
import { Card, CopyButton, Field, Notice, NumberInput, Select, Table, TextInput } from "@/components/ui";
import { won } from "@/lib/format";
import { checkListing } from "@/lib/listingCheck";
import { toTsv } from "@/lib/table";

const PURPOSES = ["", "가정용", "선물용", "흠과(못난이)"];

/** 옵션명 검수에서 의미 없는 규칙 (여러 옵션명을 이어 붙여 검사하므로 반복·길이는 제외) */
const SKIP_RULES = new Set(["repeat", "length"]);

function fruitCount(kg: number, minGram: number, maxGram: number) {
  if (minGram <= 0 || maxGram < minGram) return "";
  return `${Math.floor((kg * 1000) / maxGram)}~${Math.ceil((kg * 1000) / minGram)}과`;
}

/** 중량 옵션 권장가 → 마켓 옵션명·추가금 (가장 싼 옵션이 기본가, 나머지는 +추가금) */
export function OptionNameMaker({ rows }: { rows: { kg: number; price: number | null }[] }) {
  const [label, setLabel] = useState("");
  const [minGram, setMinGram] = useState(0);
  const [maxGram, setMaxGram] = useState(0);
  const [purpose, setPurpose] = useState("");

  const priced = rows.filter((r): r is { kg: number; price: number } => r.price !== null);
  const base = priced.length ? Math.min(...priced.map((r) => r.price)) : 0;
  const options = priced.map((r) => {
    const count = fruitCount(r.kg, minGram, maxGram);
    return { name: [label.trim(), `${r.kg}kg`, count && `(${count})`, purpose].filter(Boolean).join(" "), addon: r.price - base, price: r.price };
  });
  const findings = checkListing({ title: `${label} ${purpose}`, body: "", origin: "-" }).filter((f) => f.field === "title" && !SKIP_RULES.has(f.id));
  const tsv = toTsv([["옵션값", "옵션가(추가금)", "판매가"], ...options.map((o) => [o.name, String(o.addon), String(o.price)])]);

  return (
    <Card title="옵션명 만들기" actions={<CopyButton text={tsv} label="표 복사" />}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="품종·특징 (선택)">
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="부사" />
        </Field>
        <Field label="개당 최소 g">
          <NumberInput value={minGram} onValueChange={setMinGram} suffix="g" min={0} />
        </Field>
        <Field label="개당 최대 g">
          <NumberInput value={maxGram} onValueChange={setMaxGram} suffix="g" min={0} />
        </Field>
        <Field label="용도">
          <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p || "표기 안 함"}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-3">
        <Table>
          <thead>
            <tr>
              <th>옵션값</th>
              <th className="text-right">옵션가 (추가금)</th>
              <th className="text-right">판매가</th>
            </tr>
          </thead>
          <tbody>
            {options.map((o) => (
              <tr key={o.name}>
                <td className="font-medium">{o.name}</td>
                <td className="text-right tabular-nums">{o.addon === 0 ? "기본가" : `+${won(o.addon)}`}</td>
                <td className="text-right tabular-nums">{won(o.price)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {findings.length > 0 && (
        <Notice tone="warn" className="mt-3 text-xs">
          {findings.map((f) => `'${f.match}' — ${f.message}. ${f.fix}`).join(" / ")}
        </Notice>
      )}
      <p className="mt-3 text-xs text-stone-500">
        스마트스토어는 가장 싼 옵션 가격을 판매가로 두고 나머지를 추가금으로 넣어요. 추가금이 판매가 대비 너무 크면 마켓 규정(판매가 구간별 허용 범위)에 막히니, 옵션 가격이 크게 벌어지면
        상품을 나누세요. 개당 중량을 넣으면 과수(예: 16~20과)가 붙어 크기 클레임이 줄어요.
      </p>
    </Card>
  );
}
