/**
 * 소싱 후보 평가표 — 마진·시즌·수요는 계산하고, 경쟁·안전·공급 안정성은 판매자가 1~5로 매긴다.
 * 초보 위탁셀러가 "팔기 쉬운 품목"을 고르도록 마진과 시즌 비중을 가장 크게 둔다.
 */
import type { Channel, CostDefaults, SeasonItem, SourcingCandidate } from "@/types";
import { calcMargin, solvePriceForMargin } from "./margin.ts";
import { findSeasonItem, seasonStatus } from "./season.ts";

export const SCORE_WEIGHTS = { margin: 30, season: 20, demand: 15, competition: 15, safety: 10, supply: 10 } as const;
export type ScoreKey = keyof typeof SCORE_WEIGHTS;

export const SCORE_LABEL: Record<ScoreKey, string> = {
  margin: "마진",
  season: "시즌",
  demand: "검색 수요",
  competition: "경쟁 강도",
  safety: "파손·변질 안전",
  supply: "공급 안정성",
};

export interface SourcingEval {
  candidate: SourcingCandidate;
  marginRate: number;
  profit: number;
  /** 목표 마진을 맞추는 최소 판매가 */
  targetPrice: number | null;
  /** 각 항목 0~1 */
  parts: Record<ScoreKey, number>;
  total: number;
  seasonText: string;
  advice: string[];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const manual = (score: number) => clamp01((score - 1) / 4);

/** 월 검색수 100 → 0점, 100,000 → 1점 (로그 척도) */
export const demandScore = (monthly: number | null) => (monthly === null ? 0.5 : clamp01((Math.log10(Math.max(monthly, 1)) - 2) / 3));

function seasonPart(item: SeasonItem | undefined, today: Date) {
  if (!item) return { score: 0.5, text: "제철 정보 없음" };
  const s = seasonStatus(item, today);
  if (s.inSeason) return s.endingThisMonth ? { score: 0.4, text: "이번 달 시즌 종료" } : { score: 1, text: "지금 제철" };
  if (s.daysUntilStart <= 60) return { score: 0.85, text: `시즌 D-${s.daysUntilStart} (준비 적기)` };
  return { score: 0.3, text: `시즌 D-${s.daysUntilStart}` };
}

export function evaluateCandidate(candidate: SourcingCandidate, channel: Channel | undefined, costs: CostDefaults, seasonItems: SeasonItem[], today = new Date()): SourcingEval {
  const base = {
    supplyPrice: candidate.supplyPrice,
    extraShippingCost: candidate.extraCost,
    packagingCost: 0,
    customerShippingFee: costs.customerShippingFee,
    saleFeeRate: channel?.saleFeeRate ?? 0,
    paymentFeeRate: channel?.paymentFeeRate ?? 0,
    shippingFeeRate: channel?.shippingFeeRate ?? 0,
    adRate: costs.adRate,
    lossRate: costs.lossRate,
    taxFree: candidate.taxFree,
  };
  const result = calcMargin({ ...base, salePrice: candidate.salePrice });
  const targetPrice = solvePriceForMargin(base, costs.targetMargin, costs.roundUnit);
  const season = seasonPart(findSeasonItem(candidate.name, seasonItems), today);

  const parts: Record<ScoreKey, number> = {
    // 목표 마진의 2배면 만점, 0% 이하면 0점
    margin: costs.targetMargin > 0 ? clamp01(result.marginRate / ((costs.targetMargin * 2) / 100)) : clamp01(result.marginRate * 5),
    season: season.score,
    demand: demandScore(candidate.monthlySearch),
    competition: manual(candidate.scores.competition),
    safety: manual(candidate.scores.safety),
    supply: manual(candidate.scores.supply),
  };
  const total = Math.round((Object.keys(SCORE_WEIGHTS) as ScoreKey[]).reduce((sum, k) => sum + parts[k] * SCORE_WEIGHTS[k], 0));

  const advice: string[] = [];
  if (result.profit <= 0) advice.push(`역마진이에요. 목표 마진 판매가는 ${targetPrice ? `${targetPrice.toLocaleString("ko-KR")}원` : "계산 불가"}입니다.`);
  else if (result.marginRate * 100 < costs.targetMargin) advice.push(`목표 마진 ${costs.targetMargin}%에 못 미쳐요 (권장 ${targetPrice?.toLocaleString("ko-KR") ?? "-"}원).`);
  if (season.score <= 0.4) advice.push("시즌이 멀거나 끝나가요 — 지금은 다른 품목이 유리해요.");
  if (candidate.monthlySearch !== null && candidate.monthlySearch < 1000) advice.push("검색 수요가 적어요 — 대표 키워드로 다시 확인하세요.");
  if (candidate.scores.safety <= 2) advice.push("파손·변질 위험이 커요 — 포장비·CS 적립을 넉넉히 잡으세요.");
  if (candidate.scores.supply <= 2) advice.push("공급이 불안정해요 — 대체 공급처를 함께 확보하세요.");

  return { candidate, marginRate: result.marginRate, profit: result.profit, targetPrice, parts, total, seasonText: season.text, advice };
}

export const verdictOf = (total: number) => (total >= 70 ? { label: "추천", tone: "good" as const } : total >= 50 ? { label: "검토", tone: "warn" as const } : { label: "보류", tone: "loss" as const });
