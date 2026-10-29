import { z } from "zod";
import { isGoldenKeyword, type KeywordReport } from "@/lib/keyword";
import { toDateKey } from "@/lib/format";

export const VERDICTS = ["강력 추천", "추천", "보통", "신중"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const KeywordInsightSchema = z.object({
  verdict: z.enum(VERDICTS).describe("지금 이 키워드로 판매를 시작할 가치"),
  headline: z.string().describe("이 키워드의 판매 기회를 한 문장으로 (30자 내외)"),
  verdictReason: z.string().describe("판정 근거 2~3문장, 데이터 숫자 인용"),
  insights: z.array(z.string()).describe("데이터에서 읽은 핵심 인사이트 3~5개. 각 문장에 근거 숫자 포함"),
  target: z.object({
    persona: z.string().describe("주 구매자 한 줄 묘사 (예: 김장 준비하는 40~50대 주부)"),
    needs: z.array(z.string()).describe("이 고객이 구매할 때 신경 쓰는 것 3~5개"),
  }),
  hookingPoints: z
    .array(
      z.object({
        copy: z.string().describe("썸네일·상세페이지 첫 화면에 넣을 후킹 카피 (25자 이내)"),
        why: z.string().describe("이 카피가 통하는 이유 한 문장"),
      }),
    )
    .describe("후킹 포인트 4~5개, 서로 다른 각도(가격·산지·신선도·시즌·편의 등)"),
  sellingPoints: z.array(z.string()).describe("상세페이지에 꼭 넣어야 할 셀링 포인트 4~6개"),
  productTitles: z
    .array(z.string())
    .describe(
      '네이버 쇼핑 상품명 추천 3개, 각 50자 이내. 형식은 "[꼬리표] 수식어 메인키워드 수식어". 예: [산지직송] 국내산 파김치 쪽파 / [백화점납품] 산지직송 전라도 파김치 선물용',
    ),
  keywords: z.object({
    main: z.string().describe("메인으로 잡을 키워드 1개"),
    sub: z.array(z.string()).describe("함께 노릴 서브 키워드 3~6개 (제공된 연관 키워드 중에서)"),
    tags: z.array(z.string()).describe("스마트스토어 태그용 키워드 8~10개"),
  }),
  timing: z.string().describe("상품 등록·광고 시작·물량 확보 시점 제안 (검색 피크 근거, 오늘 날짜 기준)"),
  cautions: z.array(z.string()).describe("판매 시 주의할 점 2~4개 (신선도·배송·표시광고 규정·클레임 등)"),
});

export type KeywordInsight = z.infer<typeof KeywordInsightSchema>;

export const SYSTEM_PROMPT = `당신은 네이버 스마트스토어·쿠팡에서 농수산물(과일·채소·수산·축산)을 10년 넘게 위탁판매해 온 MD이자 상세페이지 카피라이터입니다.
판매자가 준 키워드 데이터(네이버 검색광고·데이터랩)를 읽고, 이 키워드로 무엇을 어떻게 팔지 실무 전략을 정리합니다.

[원칙]
1. 반드시 제공된 숫자에 근거해 말합니다. 데이터에 없는 수치(상품수, 판매량, 가격 등)는 지어내지 않습니다.
2. 후킹 카피는 농수산물 소비자가 실제로 반응하는 포인트(산지, 수확 시기, 당도·크기, 신선 배송, 가성비, 선물용, 손질 편의)를 구체적으로 씁니다.
3. "최고", "100%", "무조건", 효능·질병 치료 표현처럼 표시광고법·식품표시광고법에 걸릴 수 있는 표현은 쓰지 않습니다.
4. 상품명은 "[꼬리표] 수식어 메인키워드 수식어" 형식(예: [산지직송] 국내산 파김치 쪽파). 꼬리표는 하나, 관련 없는 키워드 나열·같은 단어 반복 금지.
5. 타이밍은 검색 피크 2~4주 전에 등록해 리뷰와 검색 노출을 쌓는다는 원칙으로 제안합니다.
6. 모든 문장은 한국어, 판매자에게 말하듯 짧고 명확하게 씁니다.`;

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** 주간 추이를 월평균으로 줄여 프롬프트를 짧게 만든다 */
function monthlyTrend(trend: NonNullable<KeywordReport["trend"]>) {
  const months = new Map<string, number[]>();
  trend.periods.forEach((p, i) => {
    const key = p.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), trend.values[i]]);
  });
  return [...months].map(([m, v]) => `${m}: ${Math.round(v.reduce((a, b) => a + b, 0) / v.length)}`).join(", ");
}

export function buildInsightPrompt(report: KeywordReport, context: string, today: Date) {
  const { volume, audience, trend } = report;
  const lines = [
    `오늘 날짜: ${toDateKey(today)}`,
    `키워드: ${report.keyword}`,
    volume
      ? `월간 검색수: ${volume.total} (PC ${volume.pc}, 모바일 ${volume.mobile}) / 월평균 클릭 ${volume.clicks} / 클릭률 ${(volume.ctr * 100).toFixed(2)}% / 광고 경쟁 ${volume.adCompetition}`
      : "월간 검색수: 데이터 없음",
    trend ? `최근 1년 월별 쇼핑 클릭 추이(최고=100): ${monthlyTrend(trend)}` : "검색 추이: 데이터 없음",
    audience
      ? `고객층: 여성 ${pct(audience.gender.female)} / 남성 ${pct(audience.gender.male)} · 모바일 ${pct(audience.device.mobile)} · 연령 ${audience.age.map((a) => `${a.group}대 ${pct(a.share)}`).join(", ")}`
      : "고객층: 데이터 없음",
    report.related.length > 0
      ? `연관 키워드(월간 검색수·광고 경쟁): ${report.related
          .slice(0, 30)
          .map((k) => `${k.keyword} ${k.volume.total} ${k.volume.adCompetition}${isGoldenKeyword(k) ? " ★" : ""}`)
          .join(" / ")}`
      : "연관 키워드: 데이터 없음",
    report.titleWords.length > 0 ? `상품명 수식어 후보(검색수 합): ${report.titleWords.map((w) => `${w.word} ${w.volume}`).join(", ")}` : "",
    context ? `추가 정보: ${context}` : "",
  ];
  return `${lines.filter(Boolean).join("\n")}\n\n★ = 검색수 500 이상이면서 광고 경쟁 낮은 황금 키워드`;
}

/** 복사용 텍스트 (상세페이지 기획서·메모에 바로 붙여넣기) */
export function insightToText(keyword: string, a: KeywordInsight) {
  const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  return [
    `[${keyword}] AI 분석 — ${a.verdict}`,
    a.headline,
    a.verdictReason,
    `\n■ 핵심 인사이트\n${list(a.insights)}`,
    `\n■ 타깃 고객\n${a.target.persona}\n${list(a.target.needs)}`,
    `\n■ 후킹 포인트\n${a.hookingPoints.map((h) => `- "${h.copy}" — ${h.why}`).join("\n")}`,
    `\n■ 셀링 포인트\n${list(a.sellingPoints)}`,
    `\n■ 추천 상품명\n${list(a.productTitles)}`,
    `\n■ 키워드 전략\n메인: ${a.keywords.main}\n서브: ${a.keywords.sub.join(", ")}\n태그: ${a.keywords.tags.join(", ")}`,
    `\n■ 판매 타이밍\n${a.timing}`,
    `\n■ 주의할 점\n${list(a.cautions)}`,
  ].join("\n");
}
