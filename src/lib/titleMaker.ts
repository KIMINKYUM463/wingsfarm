import { z } from "zod";

/** 네이버 쇼핑 상품명 권장 길이 */
export const TITLE_LIMIT = 50;

/**
 * 앞에 붙는 [꼬리표]. 스마트스토어·쿠팡 농수산물 상품명에서 흔히 씀.
 * 예: [산지직송] 국내산 파김치 쪽파
 */
export const TITLE_TAGS = [
  "산지직송",
  "백화점납품",
  "산지직거래",
  "당일출고",
  "예약배송",
  "명절선물",
  "김장용",
  "산지직송냉장",
  "산지직송냉동",
  "특품",
  "가정용",
] as const;

export const TITLE_PRESETS: { category: string; words: string[] }[] = [
  { category: "산지·원산지", words: ["국내산", "해남", "나주", "고흥", "제주", "강원", "괴산", "의성", "청송", "예산", "밀양", "함양", "영덕", "완도", "전라도", "경상도", "충청도"] },
  { category: "중량·수량", words: ["1kg", "2kg", "3kg", "5kg", "10kg", "20kg", "1박스", "실속", "대용량", "소분"] },
  { category: "등급·용도", words: ["특", "상", "특품", "가정용", "선물용", "제수용", "프리미엄", "햇", "당일수확"] },
  { category: "상태·가공", words: ["생", "냉동", "세척", "손질", "깐", "무농약", "GAP", "쪽파", "포기"] },
  { category: "시즌", words: ["제철", "김장", "명절", "추석", "설", "캠핑", "간식"] },
];

/**
 * [꼬리표] + 수식어 + 메인키워드 조합.
 * 예: tag=산지직송, keyword=파김치, words=[국내산, 쪽파]
 * → "[산지직송] 국내산 파김치 쪽파"
 */
export function composeProductTitle(keyword: string, words: string[], tag?: string | null) {
  const clean = words.map((w) => w.trim()).filter((w) => w && w !== keyword);
  // 앞쪽 수식어 1~2개 뒤에 메인 키워드를 넣고, 나머지는 뒤에 이어 붙인다
  const head = clean.slice(0, Math.min(2, clean.length));
  const tail = clean.slice(head.length);
  const body = [...head, keyword, ...tail].filter(Boolean).join(" ");
  const prefix = tag?.trim();
  return prefix ? `[${prefix.replace(/^\[|\]$/g, "")}] ${body}` : body;
}

/** AI·복사본에서 `[태그] 나머지` 형태를 다시 조합판 상태로 풀 때 사용 */
export function parseProductTitle(title: string, keyword: string) {
  const trimmed = title.trim();
  const tagMatch = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/);
  const tag = tagMatch?.[1] ?? null;
  const rest = (tagMatch ? tagMatch[2] : trimmed).trim();
  const parts = rest.split(/\s+/).filter(Boolean);
  const withoutKeyword = parts.filter((p) => p !== keyword);
  return { tag, words: withoutKeyword };
}

export const TitleIdeasSchema = z.object({
  titles: z
    .array(
      z.object({
        title: z
          .string()
          .describe(
            `네이버 쇼핑 상품명 ${TITLE_LIMIT}자 이내. 반드시 "[꼬리표] 수식어 메인키워드 수식어" 형식. 예: [산지직송] 국내산 파김치 쪽파 / [백화점납품] 산지직송 전라도 파김치 선물용`,
          ),
        why: z.string().describe("이 상품명이 검색·클릭에 유리한 이유 한 문장"),
      }),
    )
    .describe("서로 다른 꼬리표·각도(직송·백화점·선물·중량·산지)의 상품명 5개"),
  tips: z.array(z.string()).describe("이 키워드로 상품명 지을 때 주의할 점 2~3개"),
});

export type TitleIdeas = z.infer<typeof TitleIdeasSchema>;

export const TITLE_SYSTEM_PROMPT = `당신은 네이버 스마트스토어·쿠팡에서 농수산물 상품명을 10년 넘게 다듬어 온 MD입니다.
판매자가 준 메인 키워드와 수식어로, 실제 셀러들이 많이 쓰는 형식으로 상품명을 만듭니다.

[상품명 형식 — 반드시 지킬 것]
형식: [꼬리표] 수식어 메인키워드 수식어
올바른 예:
- [산지직송] 국내산 파김치 쪽파
- [백화점납품] 산지직송 전라도 파김치 선물용
- [당일출고] 해남 절임배추 20kg 김장용
잘못된 예:
- 파김치 산지직송 국내산 (꼬리표 없음, 키워드가 맨 앞)
- [산지직송][백화점납품] 파김치 (꼬리표 중복)

[원칙]
1. 맨 앞에 대괄호 꼬리표 딱 하나. 추천 꼬리표: 산지직송, 백화점납품, 산지직거래, 당일출고, 예약배송, 명절선물, 김장용, 특품, 가정용.
2. 꼬리표 뒤에 공백을 두고, 산지·원산지·특징 수식어 → 메인 키워드 → 용도·중량·세부 품종 순으로 자연스럽게 이어 씁니다.
3. 메인 키워드는 반드시 본문에 한 번 들어갑니다.
4. 각 상품명은 ${TITLE_LIMIT}자 이내. 같은 단어 반복·관련 없는 키워드 나열 금지.
5. "최고", "1등", "100%", 효능·질병 치료 표현 금지.
6. 제공된 수식어를 우선 쓰고, 없으면 농수산물에서 흔히 쓰는 표현만 씁니다.
7. 5개는 서로 다른 꼬리표·각도(직송, 백화점/납품, 선물, 중량·실속, 산지)로 만듭니다.
8. 모든 문장은 한국어.`;

export function buildTitlePrompt(keyword: string, modifiers: string[], note: string) {
  return [
    `메인 키워드: ${keyword}`,
    modifiers.length ? `쓸 수 있는 수식어: ${modifiers.join(", ")}` : "수식어: (없음 — 일반적인 농수산물 표현으로)",
    `추천 꼬리표: ${TITLE_TAGS.join(", ")}`,
    note.trim() ? `판매자 메모: ${note.trim()}` : "",
    "위 형식 예시처럼 [꼬리표]로 시작하는 상품명 5개를 만들어 주세요.",
  ]
    .filter(Boolean)
    .join("\n");
}
