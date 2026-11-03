import type { ConversionTiming, CrossSell, Overview } from "@/lib/adInsights";
import { percent, wonShort } from "@/lib/format";
import { DataTable, Metric, Panel, SectionHeader, TableHead, td, th } from "./parts";

const IMPULSE = 0.8;
const SINGLE_UNIT = 1.1;
const MOSTLY_DIRECT = 0.95;

interface Props {
  overview: Overview;
  timing: ConversionTiming;
  cross: CrossSell | null;
}

/** 고객이 언제·무엇을 사는지 — 구매 시점, 옵션 갈아타기, 묶음 구매 */
export function BehaviorPanel({ overview, timing, cross }: Props) {
  const sameDay = timing.sameDayShare;
  const showDirect = timing.directShare !== null && timing.directShare < MOSTLY_DIRECT;
  if (sameDay === null && !cross && !showDirect && overview.unitsPerOrder === null) return null;

  return (
    <Panel>
      <SectionHeader title="고객 행동" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {sameDay !== null && <Metric label="당일 구매" value={percent(sameDay, 0)} hint={sameDay >= IMPULSE ? "바로 사는 고객" : "며칠 고민하는 고객"} />}
        {cross && cross.revenue > 0 && <Metric label="다른 옵션 구매" value={percent(cross.share, 0)} hint={wonShort(cross.revenue)} />}
        {showDirect && <Metric label="직접 전환" value={percent(timing.directShare!, 0)} />}
        {overview.unitsPerOrder !== null && (
          <Metric label="주문당 수량" value={`${overview.unitsPerOrder.toFixed(2)}개`} hint={overview.unitsPerOrder < SINGLE_UNIT ? "묶음 옵션 여지" : "묶음 구매 있음"} />
        )}
      </div>
      {cross && cross.pairs.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-stone-500">광고 → 실제 구매</p>
          <DataTable minWidth="480px">
            <TableHead>
              <tr>
                <th className={th("left")}>상품</th>
                <th className={th("left")}>광고 옵션</th>
                <th className={th("left")}>산 옵션</th>
                <th className={th()}>매출</th>
                <th className={th()}>주문</th>
              </tr>
            </TableHead>
            <tbody>
              {cross.pairs.map((p) => (
                <tr key={`${p.base}${p.from}${p.to}`} className="border-t border-stone-100">
                  <td className={`${td("max-w-40 truncate text-stone-500")}`} title={p.base}>
                    {p.base}
                  </td>
                  <td className={`${td("max-w-36 truncate")}`}>{p.from}</td>
                  <td className={`${td("max-w-36 truncate font-medium text-stone-900")}`}>{p.to}</td>
                  <td className={`${td()} text-right tabular-nums`}>{wonShort(p.revenue)}</td>
                  <td className={`${td()} text-right tabular-nums`}>{p.orders}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}
    </Panel>
  );
}
