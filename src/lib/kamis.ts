/** KAMIS 시세 화면·마진 연결에서 쓰는 타입과 계산 (클라이언트·서버 공용) */
import type { Sku } from "@/types";

export interface KamisPrice {
  cls: "도매" | "소매";
  category: string;
  /** 예: "사과/후지(10kg)" — KAMIS 품목명 */
  name: string;
  unit: string;
  latestDate: string;
  today: number | null;
  dayAgo: number | null;
  monthAgo: number | null;
  yearAgo: number | null;
}

export interface KamisResponse {
  items: KamisPrice[];
  updatedAt: string;
  error?: string;
  missingKey?: boolean;
}

export const changeRate = (now: number | null, before: number | null) => (now && before ? now / before - 1 : null);

/** KAMIS 품목명의 첫 단어 (예: "사과/후지" → "사과") */
export const baseItemName = (name: string) => name.split(/[/(\s]/)[0];

/** 내 상품명에 KAMIS 품목명이 들어 있으면 연결 (도매 우선) */
export function matchSkuPrices(skus: Sku[], items: KamisPrice[]) {
  const wholesale = items.filter((i) => i.cls === "도매" && i.today);
  return skus
    .map((sku) => {
      const match = wholesale.find((i) => {
        const base = baseItemName(i.name);
        return base.length >= 1 && sku.productName.replace(/\s/g, "").includes(base);
      });
      return match ? { sku, price: match, monthChange: changeRate(match.today, match.monthAgo) } : null;
    })
    .filter((x) => x !== null);
}

/** 한 달 새 10% 넘게 오르면 공급가 인상에 대비 */
export const PRICE_ALERT_RATE = 0.1;

/** "오이/가시계통" → 품목 "오이" + 품종 "가시계통" (품목·단위와 겹치는 품종은 생략) */
export function splitItemName(name: string, unit = "") {
  const [main, ...rest] = name.split("/");
  const sub = rest
    .join("/")
    .replace(unit, "")
    .replace(/[()]/g, " ")
    .trim();
  return { main: main.trim(), sub: sub && sub !== main.trim() ? sub : "" };
}

export const CATEGORY_ICON: Record<string, string> = {
  식량작물: "🌾",
  채소류: "🥬",
  특용작물: "🌿",
  과일류: "🍎",
  축산물: "🥩",
  수산물: "🐟",
};

/** 품목명에 들어 있으면 그 아이콘 (위에서부터 먼저 맞는 것) */
const ITEM_ICONS: [string, string][] = [
  ["방울토마토", "🍅"], ["토마토", "🍅"], ["고구마", "🍠"], ["감자", "🥔"], ["쌀", "🍚"],
  ["콩", "🫘"], ["팥", "🫘"], ["녹두", "🫘"], ["땅콩", "🥜"], ["호두", "🌰"], ["밤", "🌰"],
  ["배추", "🥬"], ["상추", "🥬"], ["시금치", "🥬"], ["열무", "🥬"], ["깻잎", "🌿"],
  ["오이", "🥒"], ["호박", "🎃"], ["가지", "🍆"], ["당근", "🥕"], ["양파", "🧅"], ["마늘", "🧄"],
  ["생강", "🫚"], ["피망", "🫑"], ["파프리카", "🫑"], ["고추", "🌶️"], ["브로콜리", "🥦"], ["버섯", "🍄"],
  ["딸기", "🍓"], ["수박", "🍉"], ["참외", "🍈"], ["멜론", "🍈"], ["사과", "🍎"], ["배", "🍐"],
  ["복숭아", "🍑"], ["포도", "🍇"], ["감귤", "🍊"], ["오렌지", "🍊"], ["레몬", "🍋"], ["바나나", "🍌"],
  ["참다래", "🥝"], ["키위", "🥝"], ["파인애플", "🍍"], ["체리", "🍒"], ["망고", "🥭"], ["아보카도", "🥑"],
  ["돼지", "🐖"], ["닭", "🐔"], ["계란", "🥚"], ["달걀", "🥚"], ["우유", "🥛"], ["소", "🐄"],
  ["오징어", "🦑"], ["새우", "🦐"], ["게", "🦀"], ["굴", "🦪"], ["전복", "🐚"], ["홍합", "🐚"],
];

export function priceIcon(item: Pick<KamisPrice, "name" | "category">) {
  const main = splitItemName(item.name).main;
  return ITEM_ICONS.find(([key]) => main.includes(key))?.[1] ?? CATEGORY_ICON[item.category] ?? "📦";
}
