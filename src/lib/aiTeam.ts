import type { SeasonCategory } from "@/types";
import { growthText } from "./format.ts";
import { changeRate, priceIcon, splitItemName, type KamisPrice } from "./kamis.ts";

/** 대시보드 트렌드에서 넘겨받는 품목 (trend가 null이면 제철 정보만 있음) */
export type Product = {
  name: string;
  category: SeasonCategory;
  inSeason: boolean;
  trend: { score: number; growth: number } | null;
};

export type Lane = {
  id: string;
  name: string;
  image: string;
  color: string;
  /** 이 라인이 고르는 기준 */
  label: string;
  category?: SeasonCategory;
  sort: "score" | "growth";
};

export const LANES: Lane[] = [
  { id: "fruit", name: "과일 소싱 AI", image: "/robots/trend.webp", color: "#f472b6", label: "과일 · 많이 찾는 순", category: "과일", sort: "score" },
  { id: "veg", name: "채소 소싱 AI", image: "/robots/orders.webp", color: "#34d399", label: "채소 · 많이 찾는 순", category: "채소", sort: "score" },
  { id: "rising", name: "급상승 소싱 AI", image: "/robots/ads.webp", color: "#fbbf24", label: "전체 · 급상승 순", sort: "growth" },
];

export const STAGES = [
  { id: "find", label: "잘 팔리는 상품 포착", icon: "🔥", href: "/keywords" },
  { id: "farm", label: "산지 찾기", icon: "🗺️", href: "/farm-map" },
  { id: "price", label: "도매 시세 확인", icon: "💰", href: "/prices" },
  { id: "done", label: "소싱 목록에 담기", icon: "📦", href: "/margin" },
] as const;

const LAST_STAGE = STAGES.length - 1;
/** 한 단계에 머무는 틱 수 */
export const STAGE_TICKS = 3;
const QUEUE_SIZE = 6;

/** 라인마다 계속 돌릴 품목 순서. 실시간 검색 데이터가 없으면 지금 제철인 품목 */
export function laneQueue(lane: Lane, products: Product[], minScore: number): Product[] {
  const inLane = products.filter((p) => !lane.category || p.category === lane.category);
  const ranked = inLane.filter((p) => p.trend && p.trend.score >= minScore);
  if (ranked.length === 0) return inLane.filter((p) => p.inSeason).slice(0, QUEUE_SIZE);
  const key = (p: Product) => (lane.sort === "score" ? p.trend!.score : p.trend!.growth);
  return [...ranked].sort((a, b) => key(b) - key(a)).slice(0, QUEUE_SIZE);
}

export type LaneState = { cursor: number; stage: number; wait: number };
export type LineState = { lanes: LaneState[]; done: number };
export type LineEvent = { lane: number; product: Product };

/** 라인마다 한 단계씩 어긋나게 시작해 동시에 움직이지 않게 한다 */
export const initialLine = (): LineState => ({ lanes: LANES.map((_, i) => ({ cursor: 0, stage: 0, wait: STAGE_TICKS + i })), done: 0 });

export function stepLine(state: LineState, queues: Product[][]): { state: LineState; events: LineEvent[] } {
  const events: LineEvent[] = [];
  let done = state.done;
  const lanes = state.lanes.map((s, i) => {
    const queue = queues[i] ?? [];
    if (queue.length === 0) return s;
    if (s.wait > 1) return { ...s, wait: s.wait - 1 };
    if (s.stage < LAST_STAGE) {
      const stage = s.stage + 1;
      if (stage === LAST_STAGE) {
        done += 1;
        events.push({ lane: i, product: queue[s.cursor % queue.length] });
      }
      return { ...s, stage, wait: STAGE_TICKS };
    }
    return { cursor: (s.cursor + 1) % queue.length, stage: 0, wait: STAGE_TICKS };
  });
  return { state: { lanes, done }, events };
}

/** 산지 지도에서 찾은 결과 (null = 인증 산지 데이터에 없음) */
export type FarmFact = { total: number; regions: number; topRegion: string } | null;
export type PriceFact = { cls: KamisPrice["cls"]; unit: string; price: number; monthChange: number | null } | null;
/** undefined = 아직 불러오는 중 */
export type Facts = { farm: FarmFact | undefined; price: PriceFact | undefined };

/** 품목명이 같은 시세 중 도매를 먼저 */
export function findPrice(name: string, items: KamisPrice[]): PriceFact {
  const same = items.filter((i) => i.today && splitItemName(i.name).main === name);
  const hit = same.find((i) => i.cls === "도매") ?? same[0];
  return hit ? { cls: hit.cls, unit: hit.unit, price: hit.today!, monthChange: changeRate(hit.today, hit.monthAgo) } : null;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const arrow = (rate: number) => `${rate > 0 ? "▲" : rate < 0 ? "▼" : "–"}${Math.abs(Math.round(rate * 100))}%`;

export const farmText = (farm: FarmFact | undefined) =>
  farm === undefined ? "전국 산지 지도에서 찾는 중…" : farm ? `${farm.topRegion} 등 ${farm.regions}개 시군구 · 산지 ${farm.total.toLocaleString("ko-KR")}곳` : "인증 산지 데이터에 없어요 · 공급처 직접 찾기";

export const priceText = (price: PriceFact | undefined) =>
  price === undefined
    ? "도매 시세 조회 중…"
    : price
      ? `${price.cls} ${price.unit} ${won(price.price)}${price.monthChange === null ? "" : ` · 한 달 ${arrow(price.monthChange)}`}`
      : "시세 조사 품목이 아니에요";

/** 지금 단계에서 로봇이 말하는 내용 */
export function stageText(stage: number, product: Product, facts: Facts) {
  switch (STAGES[stage].id) {
    case "find":
      return product.trend
        ? `'${product.name}' 검색 관심도 ${Math.round(product.trend.score)} · 4주 대비 ${growthText(product.trend.growth)}`
        : `'${product.name}' 지금 제철이에요`;
    case "farm":
      return farmText(facts.farm);
    case "price":
      return priceText(facts.price);
    default:
      return `'${product.name}' 소싱 목록에 담았어요!`;
  }
}

const KAMIS_CATEGORY: Record<SeasonCategory, string> = { 과일: "과일류", 채소: "채소류", 수산: "수산물", 축산: "축산물", 가공: "" };
export const productIcon = (product: Pick<Product, "name" | "category">) => priceIcon({ name: product.name, category: KAMIS_CATEGORY[product.category] });
