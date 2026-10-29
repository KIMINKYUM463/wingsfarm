export interface SearchVolume {
  pc: number;
  mobile: number;
  total: number;
  /** 월평균 클릭수 (광고 영역 기준) */
  clicks: number;
  /** 월평균 클릭률 (0~1) */
  ctr: number;
  /** 광고 경쟁 정도: 높음/중간/낮음 */
  adCompetition: string;
}

export interface RelatedKeyword {
  keyword: string;
  volume: SearchVolume;
}

export interface KeywordReport {
  keyword: string;
  updatedAt: string;
  volume: SearchVolume | null;
  related: RelatedKeyword[];
  /** 연관 키워드에서 뽑은 상품명 수식어 (예: 해남절임배추 → 해남) */
  titleWords: { word: string; volume: number }[];
  trend: { periods: string[]; values: number[] } | null;
  audience: {
    gender: { female: number; male: number };
    device: { mobile: number; pc: number };
    age: { group: string; share: number }[];
  } | null;
  /** 연결이 안 됐거나 실패한 데이터 안내 */
  notices: { service: "datalab" | "searchad"; message: string }[];
}

/** 연관 키워드별 최근 12개월 검색 추이 (키워드마다 자기 최고 달 = 100, 데이터 없으면 null) */
export interface KeywordTrends {
  periods: string[];
  series: Record<string, number[] | null>;
  error?: string;
}

export const normalizeKeyword = (raw: string | null) => (raw ?? "").replace(/\s+/g, " ").trim().slice(0, 40);

const compact = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export const AD_COMPETITION_ORDER: Record<string, number> = { 낮음: 0, 중간: 1, 높음: 2 };

/** 검색수가 충분한데 광고 경쟁이 낮은 = 들어갈 틈이 있는 키워드 */
export const isGoldenKeyword = (k: RelatedKeyword) => k.volume.total >= 500 && k.volume.adCompetition === "낮음";

/**
 * 메인 키워드를 포함한 연관 키워드에서 메인 키워드를 떼어내 수식어만 남긴다.
 * 관련 없는 키워드를 상품명에 넣으면 검색 품질 점수가 떨어지므로 포함 관계인 것만 쓴다.
 */
export function titleWordsFromRelated(keyword: string, related: RelatedKeyword[], limit = 30) {
  const base = compact(keyword);
  const words = new Map<string, number>();
  related.forEach((k) => {
    const full = compact(k.keyword);
    if (!full.includes(base) || full === base) return;
    full
      .split(base)
      .filter((w) => w.length > 0)
      .forEach((w) => words.set(w, (words.get(w) ?? 0) + k.volume.total));
  });
  return [...words.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, volume]) => ({ word, volume }));
}
