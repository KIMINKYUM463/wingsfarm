import type { ConversionTiming, CrossSell, Overview } from "@/lib/adInsights";
import { percent, wonShort } from "@/lib/format";
import { Panel, Ring, SectionHeader } from "./parts";

/** 1일 안 구매가 이 비중을 넘으면 "바로 사는 고객"으로 본다 */
const IMPULSE = 0.8;
/** 주문당 수량이 이보다 적으면 묶음 구매가 거의 없다 */
const SINGLE_UNIT = 1.1;
/** 직접 전환이 이 이상이면 간접 전환이 없다고 보고 카드를 숨긴다 */
const MOSTLY_DIRECT = 0.95;

interface Props {
  overview: Overview;
  timing: ConversionTiming;
  cross: CrossSell | null;
}

/** 고객이 언제·무엇을 사는지 — 구매 시점, 옵션 갈아타기, 묶음 구매 */
export function BehaviorPanel({ overview, timing, cross }: Props) {
  const cards = [
    timing.sameDayShare !== null && {
      id: "timing",
      value: timing.sameDayShare,
      color: "#10b981",
      title: "클릭한 날 바로 구매",
      body:
        timing.sameDayShare >= IMPULSE
          ? "광고를 보고 하루 안에 사요. 1일 기준 성과로 빠르게 판단해도 되고, 상세페이지 첫 화면이 승부예요."
          : "구매까지 며칠 고민하는 고객이 많아요. 14일 기준으로 판단하고 리뷰·후기를 상세 위쪽에 두세요.",
    },
    cross &&
      cross.revenue > 0 && {
        id: "cross",
        value: cross.share,
        color: "#8b5cf6",
        title: "광고한 옵션이 아닌 다른 옵션 구매",
        body: `광고 매출 ${wonShort(cross.revenue)}이 광고한 것과 다른 ${cross.otherProduct > 0 ? "상품·옵션" : "옵션"}에서 났어요. 실제로 팔리는 옵션을 대표 옵션으로 두세요.`,
      },
    timing.directShare !== null &&
      timing.directShare < MOSTLY_DIRECT && {
      id: "direct",
      value: timing.directShare,
      color: "#f59e0b",
      title: "쿠팡 기준 직접 전환",
      body: "쿠팡이 광고 상품을 클릭해 바로 산 것으로 분류한 매출 비중이에요. 나머지는 광고를 거쳐 다른 상품을 산 간접 전환이에요.",
    },
  ].filter(Boolean) as { id: string; value: number; color: string; title: string; body: string }[];

  if (!cards.length && overview.unitsPerOrder === null) return null;

  return (
    <Panel>
      <SectionHeader eyebrow="Customer" title="고객은 어떻게 사나" description="광고를 본 고객이 언제, 무엇을 샀는지 보면 상세페이지·옵션 구성에서 고칠 점이 보여요." />
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className="space-y-4">
          {cards.map((c) => (
            <div key={c.id} className="flex items-center gap-4">
              <Ring value={c.value} size={76} stroke={8} color={c.color}>
                <span className="text-base font-bold tabular-nums text-stone-900">{percent(c.value, 0)}</span>
              </Ring>
              <div className="min-w-0">
                <p className="font-semibold text-stone-900">{c.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-stone-500">{c.body}</p>
              </div>
            </div>
          ))}
          {overview.unitsPerOrder !== null && (
            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-sm text-stone-700">
                주문 1건에 평균 <b className="tabular-nums">{overview.unitsPerOrder.toFixed(2)}개</b>
                {overview.unitsPerOrder < SINGLE_UNIT ? " — 한 번에 하나씩만 사요. 2개 묶음·선물 세트 옵션으로 객단가를 올릴 여지가 있어요." : " — 여러 개를 함께 사는 고객이 있어요. 묶음 옵션을 앞에 두세요."}
              </p>
            </div>
          )}
        </div>

        {cross && cross.pairs.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-stone-500">광고 → 실제로 산 옵션 (매출 순)</p>
            <ul className="space-y-1.5">
              {cross.pairs.map((p) => (
                <li key={`${p.base}${p.from}${p.to}`} className="flex items-center gap-2 rounded-xl border border-stone-100 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] text-stone-400" title={p.base}>
                      {p.base}
                    </span>
                    <span className="flex items-center gap-1.5 text-stone-700">
                      <span className="truncate">{p.from}</span>
                      <span className="text-violet-500">→</span>
                      <b className="truncate text-stone-900">{p.to}</b>
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block font-semibold text-stone-900">{wonShort(p.revenue)}</span>
                    <span className="block text-[11px] text-stone-400">{p.orders}건</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
