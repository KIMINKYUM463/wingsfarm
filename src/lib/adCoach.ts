/**
 * 상품별 광고 코칭 (순수 함수) — 상품마다 "뺄 키워드 / 더 태울 키워드"를 나누고,
 * 클릭률·전환율을 같은 보고서의 다른 상품과 비교해 썸네일 문제인지 리뷰·상세페이지 문제인지 짚는다.
 */
import { MIN_PRODUCT_CLICKS, placementKind, productKeyOf, type AnalysisContext } from "./adInsights.ts";
import { groupRows, SCALE_MULTIPLIER, summarize, type AdGroup, type AdMetrics, type AdRow } from "./coupangAds.ts";
import { percent } from "./format.ts";

/** 검색 노출이 이보다 적으면 클릭률을 판단하지 않는다 */
export const MIN_SEARCH_IMPRESSIONS = 1000;
/** 다른 상품 평균의 이 비율 밑이면 "낮다" */
export const WEAK_RATIO = 0.7;

export type IssueKind = "thumbnail" | "conversion" | "margin";

export interface CoachIssue {
  kind: IssueKind;
  title: string;
  detail: string;
  tips: string[];
}

export interface ProductCoach {
  key: string;
  metrics: AdMetrics;
  breakEven: number | null;
  profit: number | null;
  /** 검색 영역 클릭률 — 썸네일은 검색 결과에서 가장 크게 작용한다 */
  searchCtr: number | null;
  /** 같은 보고서의 다른 상품 평균 (비교 기준) */
  peerCtr: number | null;
  peerCvr: number | null;
  /** 제외 키워드를 등록할 광고그룹 (없으면 캠페인) */
  adGroups: string[];
  exclude: AdGroup[];
  /** 제외 후보지만 다른 상품에서는 팔린 키워드 — 같은 광고그룹이면 제외 대신 입찰가 낮추기 */
  soldElsewhere: string[];
  cut: AdGroup[];
  scale: AdGroup[];
  /** 주문 1건이라 아직 효자는 아니지만 손익분기의 1.3배 이상 — 조금 더 태워 볼 후보 */
  promising: AdGroup[];
  issues: CoachIssue[];
  /** 제외 후보에 나간 광고비 */
  wasted: number;
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const sumOf = <T>(items: T[], pick: (item: T) => number) => items.reduce((acc, item) => acc + pick(item), 0);
const isSearch = (r: AdRow) => Boolean(r.keyword) && placementKind(r) === "search";

const THUMBNAIL_TIPS = [
  "첫 썸네일에 상품을 크게 — 과일·수산물은 단면·속살, 채소는 싱싱한 잎·흙 묻은 실물처럼 '먹음직한 부분'이 보이게",
  "같은 검색어로 검색해 경쟁 상품 썸네일과 나란히 놓고, 색·구도가 묻히지 않는지 확인",
  "검색어와 썸네일이 맞는지 — '10kg 대용량'으로 들어왔는데 낱개 사진이면 안 눌러요",
  "검색 결과에는 가격·리뷰 수도 같이 보여요 — 같은 중량 대비 가격이 튀지 않는지도 확인",
];

const CONVERSION_TIPS = [
  "리뷰: 개수가 적거나 맨 위 리뷰가 불만이면 이탈해요 — 쿠팡 체험단 같은 공식 방법으로 초기 리뷰를 모으고, 나쁜 리뷰엔 해결 답글",
  "상세페이지 첫 화면: 산지·중량·수확일·보관법을 바로 보이게 ('한눈에 보는 상품' 섹션)",
  "받는 날·포장 방법·무른 과일 교환 기준을 분명히 — 신선식품은 '받았을 때 상태' 불안이 가장 큰 이탈 이유예요",
  "옵션: 가장 많이 팔리는 옵션을 대표 옵션으로, 옵션별 인원·용도 안내",
];

const MARGIN_TIPS = [
  "클릭·전환은 평균 이상이라 광고는 제 역할을 해요 — 남는 게 없는 건 판매가·공급가 문제",
  "마진 계산기로 손익분기 ROAS를 다시 확인하고, 2~3개 묶음 옵션으로 주문당 금액을 높여 보세요",
];

/** 다른 상품들만 합친 지표 (자기 자신을 빼야 상품이 하나 튀어도 기준이 끌려가지 않는다) */
function peerMetrics(all: AdRow[], key: string, pick: (r: AdRow) => boolean) {
  return summarize(all.filter((r) => productKeyOf(r) !== key && pick(r)));
}

function diagnose(p: { metrics: AdMetrics; searchImpressions: number; searchCtr: number | null; peerCtr: number | null; peerCvr: number | null; breakEven: number | null }): CoachIssue[] {
  const issues: CoachIssue[] = [];
  const { metrics: m } = p;

  const lowCtr = p.searchImpressions >= MIN_SEARCH_IMPRESSIONS && p.searchCtr !== null && p.peerCtr !== null && p.searchCtr < p.peerCtr * WEAK_RATIO;
  if (lowCtr) {
    issues.push({
      kind: "thumbnail",
      title: "클릭률이 낮아요 → 썸네일부터 고치세요",
      detail: `검색 결과 클릭률 ${percent(p.searchCtr!, 2)} — 다른 상품 평균 ${percent(p.peerCtr!, 2)}보다 낮아요. 노출은 되는데 눌리지 않는다는 뜻이에요.`,
      tips: THUMBNAIL_TIPS,
    });
  }

  const enoughClicks = m.clicks >= MIN_PRODUCT_CLICKS;
  const noOrders = enoughClicks && m.orders === 0;
  const lowCvr = enoughClicks && m.cvr !== null && p.peerCvr !== null && m.cvr < p.peerCvr * WEAK_RATIO;
  if (noOrders || lowCvr) {
    issues.push({
      kind: "conversion",
      title: "전환율이 낮아요 → 리뷰·상세페이지를 점검하세요",
      detail: noOrders
        ? `클릭 ${m.clicks}회인데 주문이 없어요. 들어와서 보고 나가는 거라 상품 페이지(리뷰·상세페이지·가격) 문제예요.`
        : `전환율 ${percent(m.cvr!, 1)} — 다른 상품 평균 ${percent(p.peerCvr!, 1)}보다 낮아요. 클릭은 되는데 상품 페이지에서 마음을 못 잡아요.`,
      tips: CONVERSION_TIPS,
    });
  }

  const losing = m.roas !== null && p.breakEven !== null && m.roas < p.breakEven;
  if (losing && !issues.length && enoughClicks) {
    issues.push({ kind: "margin", title: "클릭·전환은 괜찮은데 남지 않아요 → 가격·마진 점검", detail: "광고 성과는 평균 이상인데 손익분기 ROAS에 못 미쳐요.", tips: MARGIN_TIPS });
  }
  return issues;
}

export function productCoach(rows: AdRow[], ctx: AnalysisContext): ProductCoach[] {
  const group = (list: AdRow[], keyOf: (r: AdRow) => string) => groupRows(list, keyOf, ctx.breakEvenOf, ctx.costMultiplier, ctx.minClicks);

  // 키워드 → 주문이 난 상품들 (제외 후보가 다른 상품에서 팔리는지 보기 위해)
  const soldBy = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.keyword || r.orders <= 0) continue;
    const set = soldBy.get(r.keyword) ?? new Set<string>();
    set.add(productKeyOf(r));
    soldBy.set(r.keyword, set);
  }

  return group(rows, productKeyOf).map((product) => {
    const keywords = group(product.rows.filter((r) => r.keyword), (r) => r.keyword);
    const search = summarize(product.rows.filter(isSearch));
    const peerSearch = peerMetrics(rows, product.key, isSearch);
    const peerAll = peerMetrics(rows, product.key, () => true);
    const exclude = keywords.filter((k) => k.verdict === "exclude");
    const searchCtr = ratio(search.clicks, search.impressions);
    const peerCtr = peerSearch.impressions >= MIN_SEARCH_IMPRESSIONS ? peerSearch.ctr : null;
    const peerCvr = peerAll.clicks >= MIN_PRODUCT_CLICKS ? peerAll.cvr : null;

    return {
      key: product.key,
      metrics: product.metrics,
      breakEven: product.breakEven,
      profit: product.profit,
      searchCtr,
      peerCtr,
      peerCvr,
      adGroups: [...new Set(product.rows.map((r) => r.adGroup || r.campaign).filter(Boolean))],
      exclude,
      soldElsewhere: exclude.filter((k) => [...(soldBy.get(k.key) ?? [])].some((p) => p !== product.key)).map((k) => k.key),
      cut: keywords.filter((k) => k.verdict === "cut"),
      scale: keywords.filter((k) => k.verdict === "scale").sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0)),
      promising: keywords.filter((k) => k.metrics.orders === 1 && k.breakEven !== null && k.metrics.roas !== null && k.metrics.roas >= k.breakEven * SCALE_MULTIPLIER),
      issues: diagnose({ metrics: product.metrics, searchImpressions: search.impressions, searchCtr, peerCtr, peerCvr, breakEven: product.breakEven }),
      wasted: sumOf(exclude, (k) => k.metrics.cost),
    };
  });
}

/** 바로 제외해도 되는 키워드 (다른 상품에서 팔린 키워드는 뺀다) */
export const safeExcludes = (c: ProductCoach) => c.exclude.filter((k) => !c.soldElsewhere.includes(k.key)).map((k) => k.key);

/** 상품별 제외 키워드를 광고센터에 붙여 넣기 좋게 (상품 이름 → 키워드 줄) */
export const excludeText = (coaches: ProductCoach[]) =>
  coaches
    .map((c) => ({ key: c.key, keywords: safeExcludes(c) }))
    .filter((c) => c.keywords.length)
    .map((c) => [`[${c.key}]`, ...c.keywords].join("\n"))
    .join("\n\n");
