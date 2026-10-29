"use client";

import { useMemo, useState } from "react";
import { MarginBoard } from "@/components/margin/MarginBoard";
import { Badge, Card, Field, NumberInput, PageHeader, Select, Stat, StatusBadge, Table, TextInput, Toggle } from "@/components/ui";
import { calcMargin, marginStatus, solvePriceForMargin, type MarginInput } from "@/lib/margin";
import { num, percent, won } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

type Mode = "board" | "single" | "options";

const MODES: { id: Mode; label: string }[] = [
  { id: "board", label: "전체 상품 (역마진 점검)" },
  { id: "single", label: "단일 상품" },
  { id: "options", label: "중량 옵션" },
];

/** 대시보드에서 /margin?tab=board 로 들어오면 해당 탭을 연다 (ClientOnly 아래라 window 사용 가능) */
const initialMode = (): Mode => {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return MODES.some((m) => m.id === tab) ? (tab as Mode) : "single";
};
type Ending = "round100" | "end900";
type FormState = Omit<MarginInput, "saleFeeRate" | "paymentFeeRate" | "shippingFeeRate">;

/** 900원 끝자리: 23,400 → 23,900 / 23,950 → 24,900 */
const applyEnding = (price: number, ending: Ending) =>
  ending === "end900" ? Math.ceil((price + 100) / 1000) * 1000 - 100 : Math.ceil(price / 100) * 100;

const parseWeights = (text: string) =>
  [...new Set(text.split(/[,\s]+/).map(Number).filter((n) => n > 0))].sort((a, b) => a - b);

export default function MarginPage() {
  const { channels, costs, skus } = useAppStore();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [targetMargin, setTargetMargin] = useState(costs.targetMargin);
  const [taxFree, setTaxFree] = useState(true);

  const [form, setForm] = useState<FormState>({
    supplyPrice: 20000,
    extraShippingCost: 0,
    packagingCost: 0,
    salePrice: 29900,
    customerShippingFee: costs.customerShippingFee,
    adRate: costs.adRate,
    lossRate: costs.lossRate,
    taxFree: true,
  });

  const [perKg, setPerKg] = useState(5500);
  const [boxCost, setBoxCost] = useState(3500);
  const [weightsText, setWeightsText] = useState("2, 3, 5, 10");
  const [ending, setEnding] = useState<Ending>("end900");

  const channel = channels.find((c) => c.id === channelId) ?? channels[0];
  const update = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const loadSku = (skuId: string) => {
    const sku = skus.find((s) => s.id === skuId);
    if (!sku) return;
    setForm((f) => ({
      ...f,
      supplyPrice: sku.supplyPrice,
      extraShippingCost: sku.extraShippingCost,
      packagingCost: sku.packagingCost,
      taxFree: sku.taxFree,
      salePrice: sku.listings[channelId] ?? Object.values(sku.listings)[0] ?? f.salePrice,
    }));
    setTaxFree(sku.taxFree);
    setMode("single");
  };

  const singleRows = useMemo(
    () =>
      channels.map((ch) => {
        const base = {
          ...form,
          taxFree,
          saleFeeRate: ch.saleFeeRate,
          paymentFeeRate: ch.paymentFeeRate,
          shippingFeeRate: ch.shippingFeeRate,
        };
        const { salePrice, ...withoutPrice } = base;
        return {
          channel: ch,
          result: calcMargin(base),
          breakEven: solvePriceForMargin(withoutPrice, 0, 10),
          target: solvePriceForMargin(withoutPrice, targetMargin, costs.roundUnit),
          salePrice,
        };
      }),
    [channels, form, taxFree, targetMargin, costs.roundUnit],
  );

  const optionRows = useMemo(() => {
    if (!channel) return [];
    return parseWeights(weightsText).map((kg) => {
      const base: Omit<MarginInput, "salePrice"> = {
        supplyPrice: perKg * kg,
        extraShippingCost: boxCost,
        packagingCost: 0,
        customerShippingFee: costs.customerShippingFee,
        saleFeeRate: channel.saleFeeRate,
        paymentFeeRate: channel.paymentFeeRate,
        shippingFeeRate: channel.shippingFeeRate,
        adRate: costs.adRate,
        lossRate: costs.lossRate,
        taxFree,
      };
      const raw = solvePriceForMargin(base, targetMargin, 1);
      const price = raw ? applyEnding(raw, ending) : null;
      const result = price ? calcMargin({ ...base, salePrice: price }) : null;
      return { kg, cost: base.supplyPrice + boxCost, price, result, perKgPrice: price ? price / kg : null };
    });
  }, [channel, weightsText, perKg, boxCost, targetMargin, ending, taxFree, costs]);

  const inverted = new Set(
    optionRows.filter((r, i) => i > 0 && r.perKgPrice && optionRows[i - 1].perKgPrice && r.perKgPrice >= optionRows[i - 1].perKgPrice!).map((r) => r.kg),
  );

  const current = singleRows.find((r) => r.channel.id === channel?.id);
  if (!channel || !current) return null;
  const { result } = current;
  const status = marginStatus(result.marginRate, targetMargin);

  const breakdown = [
    { label: "공급가·택배·포장", value: result.cost, color: "bg-stone-400" },
    { label: "채널 수수료", value: result.channelFee, color: "bg-sky-400" },
    { label: "광고비", value: result.adCost, color: "bg-violet-400" },
    { label: "CS 손실 적립", value: result.lossReserve, color: "bg-amber-400" },
    { label: "부가세", value: result.vat, color: "bg-rose-300" },
    { label: "순이익", value: Math.max(0, result.profit), color: "bg-emerald-500" },
  ];

  return (
    <>
      <PageHeader
        title="가격·마진"
        description="등록 상품 전체의 역마진을 점검하고, 한 상품의 실마진이나 2·3·5kg 중량 옵션 가격을 설계합니다."
        actions={
          <Select className="w-56" defaultValue="" onChange={(e) => loadSku(e.target.value)}>
            <option value="">등록 상품에서 불러오기…</option>
            {skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.productName} {s.optionName}
              </option>
            ))}
          </Select>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex rounded-xl border border-stone-200 bg-white p-1">
          {MODES.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                mode === tab.id ? "bg-emerald-600 text-white shadow-sm" : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {mode !== "board" && (
          <>
            <div className="w-44">
              <Field label="판매 채널">
                <Select value={channel.id} onChange={(e) => setChannelId(e.target.value)}>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="w-36">
              <Field label="목표 마진율">
                <NumberInput value={targetMargin} onValueChange={setTargetMargin} suffix="%" />
              </Field>
            </div>
            <div className="pb-2">
              <Toggle checked={taxFree} onChange={setTaxFree} label="면세 상품" />
            </div>
          </>
        )}
      </div>

      {mode === "board" ? (
        <MarginBoard />
      ) : mode === "single" ? (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card title="입력">
            <div className="grid grid-cols-2 gap-3">
              <Field label="판매가">
                <NumberInput value={form.salePrice} onValueChange={update("salePrice")} suffix="원" />
              </Field>
              <Field label="고객결제 배송비" hint="무료배송이면 0">
                <NumberInput value={form.customerShippingFee} onValueChange={update("customerShippingFee")} suffix="원" />
              </Field>
              <Field label="공급가(매입가)">
                <NumberInput value={form.supplyPrice} onValueChange={update("supplyPrice")} suffix="원" />
              </Field>
              <Field label="셀러부담 택배비" hint="공급가에 미포함 시">
                <NumberInput value={form.extraShippingCost} onValueChange={update("extraShippingCost")} suffix="원" />
              </Field>
              <Field label="포장비" hint="아이스팩·보냉박스 등">
                <NumberInput value={form.packagingCost} onValueChange={update("packagingCost")} suffix="원" />
              </Field>
              <Field label="광고비율" hint="판매가 대비">
                <NumberInput value={form.adRate} onValueChange={update("adRate")} suffix="%" />
              </Field>
              <Field label="CS 손실 적립률" hint="파손·상함 환불 대비">
                <NumberInput value={form.lossRate} onValueChange={update("lossRate")} suffix="%" />
              </Field>
            </div>
            <p className="mt-4 rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-500">
              {channel.name} 수수료: 판매 {channel.saleFeeRate}% · 결제 {channel.paymentFeeRate}% · 배송비 {channel.shippingFeeRate}%
              <br />
              요율은 설정 메뉴에서 본인 카테고리 기준으로 수정하세요.
            </p>
          </Card>

          <div className="space-y-6">
            <Card title={<span className="flex items-center gap-2">결과 <StatusBadge status={status} /></span>}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="개당 순이익" value={won(result.profit)} tone={status} />
                <Stat label="마진율" value={percent(result.marginRate)} tone={status} hint={`마크업 ${percent(result.markupRate)}`} />
                <Stat label="정산 예정액" value={won(result.settlement)} hint="매출 − 채널수수료" />
                <Stat label="손익분기 ROAS" value={result.breakEvenRoas ? `${num(result.breakEvenRoas)}%` : "불가"} hint="이보다 광고효율이 낮으면 적자" />
                <Stat label="손익분기 판매가" value={current.breakEven ? won(current.breakEven) : "-"} />
                <Stat label={`목표 ${targetMargin}% 판매가`} value={current.target ? won(current.target) : "달성 불가"} tone="good" />
                <Stat label="부가세 부담" value={won(result.vat)} hint={taxFree ? "면세 상품" : "매출세액−매입세액"} />
                <Stat label="총 매출" value={won(result.revenue)} />
              </div>

              <div className="mt-5">
                <div className="flex h-4 overflow-hidden rounded-full bg-stone-100">
                  {breakdown.map((b) => (
                    <div key={b.label} className={b.color} style={{ width: `${(b.value / Math.max(result.revenue, 1)) * 100}%` }} title={b.label} />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                  {breakdown.map((b) => (
                    <span key={b.label} className="flex items-center gap-1">
                      <span className={`size-2 rounded-full ${b.color}`} />
                      {b.label} {won(b.value)}
                    </span>
                  ))}
                </div>
              </div>
            </Card>

            <Card title="채널별 비교" actions={<Badge tone="info">같은 판매가·원가 기준</Badge>}>
              <Table>
                <thead>
                  <tr>
                    <th>채널</th>
                    <th className="text-right">수수료</th>
                    <th className="text-right">순이익</th>
                    <th className="text-right">마진율</th>
                    <th className="text-right">손익분기가</th>
                    <th className="text-right">목표마진 판매가</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {singleRows.map(({ channel: ch, result: r, breakEven, target }) => (
                    <tr key={ch.id} className={ch.id === channel.id ? "bg-emerald-50/50" : ""}>
                      <td className="font-medium">{ch.name}</td>
                      <td className="text-right tabular-nums">{won(r.channelFee)}</td>
                      <td className="text-right tabular-nums">{won(r.profit)}</td>
                      <td className="text-right tabular-nums">{percent(r.marginRate)}</td>
                      <td className="text-right tabular-nums">{breakEven ? won(breakEven) : "-"}</td>
                      <td className="text-right tabular-nums font-semibold">{target ? won(target) : "불가"}</td>
                      <td>
                        <StatusBadge status={marginStatus(r.marginRate, targetMargin)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <Card title="입력">
            <div className="space-y-3">
              <Field label="kg당 공급단가" hint="산지 경락가·공급처 단가">
                <NumberInput value={perKg} onValueChange={setPerKg} suffix="원" />
              </Field>
              <Field label="박스당 고정비" hint="택배비 + 박스·완충재 등 중량과 무관한 비용">
                <NumberInput value={boxCost} onValueChange={setBoxCost} suffix="원" />
              </Field>
              <Field label="옵션 중량(kg)" hint="쉼표로 구분">
                <TextInput value={weightsText} onChange={(e) => setWeightsText(e.target.value)} />
              </Field>
              <Field label="가격 끝자리">
                <Select value={ending} onChange={(e) => setEnding(e.target.value as Ending)}>
                  <option value="end900">900원으로 끝내기 (예: 23,900)</option>
                  <option value="round100">100원 단위 올림</option>
                </Select>
              </Field>
            </div>
            <p className="mt-4 rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-500">
              광고비율 {costs.adRate}% · CS 손실 {costs.lossRate}% · 고객결제 배송비 {won(costs.customerShippingFee)}
              <br />
              {channel.name} 수수료로 계산 · 요율·기본비용은 설정에서 변경
            </p>
          </Card>

          <Card title="옵션별 권장가">
            <Table>
              <thead>
                <tr>
                  <th>옵션</th>
                  <th className="text-right">원가</th>
                  <th className="text-right">권장 판매가</th>
                  <th className="text-right">순이익</th>
                  <th className="text-right">마진율</th>
                  <th className="text-right">소비자 kg당</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {optionRows.map((r) => (
                  <tr key={r.kg}>
                    <td className="font-medium">{r.kg}kg</td>
                    <td className="text-right tabular-nums">{won(r.cost)}</td>
                    <td className="text-right text-base font-bold tabular-nums text-emerald-700">{r.price ? won(r.price) : "달성 불가"}</td>
                    <td className="text-right tabular-nums">{r.result ? won(r.result.profit) : "-"}</td>
                    <td className="text-right tabular-nums">{r.result ? percent(r.result.marginRate) : "-"}</td>
                    <td className="text-right tabular-nums">{r.perKgPrice ? won(r.perKgPrice) : "-"}</td>
                    <td>{inverted.has(r.kg) && <Badge tone="warn">kg당 단가 역전</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="mt-4 space-y-2 rounded-lg bg-stone-50 p-4 text-xs leading-relaxed text-stone-600">
              <p>
                <b>왜 옵션별로 따로 계산하나요?</b> 박스당 고정비 {won(boxCost)}은(는) 2kg이든 10kg이든 똑같이 들어서, 작은 옵션일수록 원가
                부담이 큽니다. 같은 마진율을 적용하면 큰 옵션의 kg당 가격이 자연스럽게 내려가 &quot;큰 걸 사면 이득&quot;이라는 인식을 줍니다.
              </p>
              {inverted.size > 0 && (
                <p className="text-amber-700">
                  ⚠ 일부 옵션에서 큰 용량의 kg당 가격이 더 비쌉니다. 끝자리 반올림 영향일 수 있으니 해당 옵션 가격을 조금 낮추거나 목표 마진을
                  조정하세요.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
