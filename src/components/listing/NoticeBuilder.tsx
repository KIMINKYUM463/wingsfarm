"use client";

import { useState } from "react";
import { Card, CopyButton, Field, Notice, NumberInput, Select, Tabs, TextArea, TextInput, Toggle } from "@/components/ui";
import { NOTICE_FIELDS, NOTICE_KINDS, buildNoticeText, buildOriginLabel, buildQualityLine, missingNoticeFields, type NoticeKind, type QualitySpec } from "@/lib/productNotice";

function Output({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-stone-500">{label}</span>
        <CopyButton text={text} />
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-stone-800">{text || <span className="text-stone-400">입력하면 여기에 만들어져요</span>}</p>
    </div>
  );
}

export function NoticeBuilder() {
  const [kind, setKind] = useState<NoticeKind>("fresh");
  const [values, setValues] = useState<Record<string, string>>({});
  const [domestic, setDomestic] = useState(true);
  const [region, setRegion] = useState("");
  const [spec, setSpec] = useState<QualitySpec>({ totalKg: 0, minGram: 0, maxGram: 0, brix: 0, grade: "" });
  const setSpecField = <K extends keyof QualitySpec>(key: K, value: QualitySpec[K]) => setSpec((s) => ({ ...s, [key]: value }));

  const originLabel = buildOriginLabel({ domestic, region });
  const qualityLine = buildQualityLine(spec);
  const missing = missingNoticeFields(kind, values);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <Card title="원산지 표기">
          <div className="space-y-3">
            <Toggle checked={domestic} onChange={setDomestic} label="국내산" />
            <Field label={domestic ? "시·도 + 시·군" : "국가명"} hint={domestic ? "시·군까지 적으면 신뢰도가 올라가요" : "'수입산'만 쓰면 위반이에요. 반드시 나라 이름을 적으세요"}>
              <TextInput value={region} onChange={(e) => setRegion(e.target.value)} placeholder={domestic ? "경북 성주군" : "칠레"} />
            </Field>
            <Output label="상품명·가격 옆에 붙일 문구" text={originLabel} />
            <p className="text-xs text-stone-500">
              온라인 판매는 상품명·가격 근처에 상품명과 같거나 더 큰 글씨로 표시해야 해요. 상세페이지에만 있으면 미표시로 볼 수 있어요.
            </p>
          </div>
        </Card>

        <Card title="크기·당도·등급 한 줄">
          <div className="grid grid-cols-2 gap-3">
            <Field label="총 중량">
              <NumberInput value={spec.totalKg} onValueChange={(v) => setSpecField("totalKg", v)} suffix="kg" step={0.5} min={0} />
            </Field>
            <Field label="선별 당도">
              <NumberInput value={spec.brix} onValueChange={(v) => setSpecField("brix", v)} suffix="Brix" min={0} />
            </Field>
            <Field label="개당 최소">
              <NumberInput value={spec.minGram} onValueChange={(v) => setSpecField("minGram", v)} suffix="g" min={0} />
            </Field>
            <Field label="개당 최대">
              <NumberInput value={spec.maxGram} onValueChange={(v) => setSpecField("maxGram", v)} suffix="g" min={0} />
            </Field>
            <Field label="표준규격 등급">
              <Select value={spec.grade} onChange={(e) => setSpecField("grade", e.target.value as QualitySpec["grade"])}>
                <option value="">표기 안 함</option>
                <option value="특">특</option>
                <option value="상">상</option>
                <option value="보통">보통</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Output label="상세페이지 상단·옵션 설명에 쓸 문구" text={qualityLine} />
          </div>
          <p className="mt-2 text-xs text-stone-500">
            2026년 한국소비자원 조사에서 과일 선물세트 절반가량이 크기·당도를 &lsquo;대과·고당도&rsquo;처럼 모호하게 적어 개선 권고를 받았어요. 수치로 적으면 클레임도 줄어요.
          </p>
        </Card>
      </div>

      <Card title="상품정보제공고시">
        <Tabs tabs={NOTICE_KINDS.map((k) => ({ id: k.id, label: k.label }))} value={kind} onChange={setKind} className="mb-2" />
        <p className="mb-3 text-xs text-stone-500">{NOTICE_KINDS.find((k) => k.id === kind)!.hint}</p>
        <div className="space-y-3">
          {NOTICE_FIELDS[kind].map((f) => {
            const props = { value: values[f.key] ?? "", placeholder: f.placeholder, onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [f.key]: e.target.value })) };
            return (
              <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`}>
                {f.multiline ? <TextArea rows={2} {...props} /> : <TextInput {...props} />}
              </Field>
            );
          })}
        </div>
        {missing.length > 0 && (
          <Notice tone="warn" className="mt-3">
            필수 칸 {missing.length}개가 비어 있어요: {missing.map((f) => f.label.split(/[ (,]/)[0]).join(", ")}. 비워 두면 &lsquo;상세페이지 참조&rsquo;로 채워지는데, 상세에도 없으면 고시 위반이에요.
          </Notice>
        )}
        <div className="mt-3">
          <Output label="마켓 고시 입력칸·상세 하단에 붙여 넣기" text={buildNoticeText(kind, values)} />
        </div>
      </Card>
    </div>
  );
}
