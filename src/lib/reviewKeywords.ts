/** 리뷰 키워드 빠른 집계 — AI 없이 붙여넣자마자 보여 주는 1차 분석 (요금 없음) */

export interface ReviewTheme {
  id: string;
  label: string;
  tone: "loss" | "good";
  pattern: RegExp;
}

export const REVIEW_THEMES: ReviewTheme[] = [
  { id: "damage", label: "파손·눌림", tone: "loss", pattern: /터졌|터짐|터져|터진|깨졌|깨짐|눌렸|눌림|멍들|멍이|찌그러|파손|으깨/ },
  { id: "spoiled", label: "상함·무름", tone: "loss", pattern: /상했|상한|상함|썩|곰팡|물러|무름|무른|짓무|변질|쉰내|시들/ },
  { id: "size", label: "크기·중량 부족", tone: "loss", pattern: /작아|작네|작은|작다|가벼|중량이|무게가|양이\s?적|부족/ },
  { id: "taste", label: "맛·당도 불만", tone: "loss", pattern: /싱거|맛이\s?없|맛없|안\s?달|달지\s?않|당도가\s?낮|퍽퍽|시어|떫|밍밍/ },
  { id: "delay", label: "배송 지연", tone: "loss", pattern: /늦게|늦어|지연|오래\s?걸|배송이\s?느|며칠\s?걸/ },
  { id: "packaging", label: "포장 불만", tone: "loss", pattern: /포장[이도]?\s?(?:허술|엉망|부실)|아이스팩[이도]?\s?(?:없|녹)|보냉이?\s?안/ },
  { id: "good-taste", label: "맛있어요", tone: "good", pattern: /맛있|달아요|달고|달달|꿀맛|당도[가도]?\s?(?:좋|높)|아삭|신선/ },
  { id: "good-size", label: "크고 실해요", tone: "good", pattern: /크고|큼직|알이\s?굵|실해|커요/ },
  { id: "good-pack", label: "포장 꼼꼼", tone: "good", pattern: /포장[이도]?\s?(?:꼼꼼|잘|튼튼|깔끔)|꼼꼼하게\s?포장|안전하게/ },
  { id: "repurchase", label: "재구매", tone: "good", pattern: /재구매|또\s?(?:시킬|주문|살)|다시\s?주문|단골/ },
];

/** 빈 줄이 있으면 빈 줄 기준, 없으면 줄 단위로 리뷰를 나눈다 */
export function splitReviews(text: string) {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const blocks = /\n\s*\n/.test(normalized) ? normalized.split(/\n\s*\n/) : normalized.split("\n");
  return blocks.map((b) => b.replace(/\s+/g, " ").trim()).filter((b) => b.length >= 2);
}

export function countThemes(reviews: string[]) {
  return REVIEW_THEMES.map((theme) => {
    const hits = reviews.filter((r) => theme.pattern.test(r));
    return { theme, count: hits.length, share: reviews.length ? hits.length / reviews.length : 0, examples: hits.slice(0, 3) };
  }).filter((t) => t.count > 0);
}
