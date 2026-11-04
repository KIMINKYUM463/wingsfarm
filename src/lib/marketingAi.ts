import { z } from "zod";

export const MARKETING_FORMATS = ["shorts", "threads", "carousel", "blog", "review", "chat", "live", "ads"] as const;
export type MarketingFormat = (typeof MARKETING_FORMATS)[number];

/** reach = 처음 보는 고객을 데려오는 콘텐츠, convert = 관심 고객·구매 고객에게 보내는 메시지 */
export type MarketingStage = "reach" | "convert";

export const MARKETING_STAGES: Record<MarketingStage, { title: string; description: string }> = {
  reach: { title: "고객을 데려오는 콘텐츠", description: "SNS·검색에서 처음 만나는 고객이 상품을 알게 만들어요." },
  convert: { title: "사게 하고, 다시 사게 하는 메시지", description: "이미 관심 있거나 구매한 고객에게 보내는 말이에요." },
};

export const MARKETING_FORMAT_META: Record<
  MarketingFormat,
  { title: string; blurb: string; icon: string; accent: string; studio: string; stage: MarketingStage; gets: string[] }
> = {
  shorts: {
    title: "숏폼 영상",
    blurb: "릴스·숏츠·틱톡 — 레퍼런스 복제·템플릿 영상 제작",
    icon: "🎬",
    accent: "from-rose-600 via-orange-500 to-amber-400",
    studio: "숏폼 스튜디오",
    stage: "reach",
    gets: ["레퍼런스 분석", "템플릿 영상", "올릴 글"],
  },
  threads: {
    title: "쓰레드 글",
    blurb: "Threads — 스크롤을 끊는 연속 글",
    icon: "🧵",
    accent: "from-stone-900 via-stone-700 to-emerald-800",
    studio: "글쓰기 룸",
    stage: "reach",
    gets: ["5~9개 연속 포스트", "첫 줄 후킹"],
  },
  carousel: {
    title: "카드뉴스",
    blurb: "인스타 캐러셀 — 장표형 비주얼 카피",
    icon: "🃏",
    accent: "from-violet-700 via-fuchsia-600 to-rose-500",
    studio: "편집실",
    stage: "reach",
    gets: ["장별 카피·디자인 지시", "AI 사진(선택)"],
  },
  blog: {
    title: "블로그 글",
    blurb: "네이버·자사몰 칼럼 — 검색되는 본문",
    icon: "✍️",
    accent: "from-emerald-700 via-teal-600 to-sky-500",
    studio: "에디터룸",
    stage: "reach",
    gets: ["검색용 제목·본문·FAQ", "AI 사진(선택)"],
  },
  ads: {
    title: "검색광고",
    blurb: "쇼핑·파워링크 제목·설명 소재",
    icon: "📢",
    accent: "from-blue-700 via-indigo-600 to-violet-500",
    studio: "광고 소재실",
    stage: "reach",
    gets: ["제목 15자 후보", "설명 45자 후보"],
  },
  review: {
    title: "리뷰 답글",
    blurb: "별점·클레임 리뷰 응대 문구",
    icon: "💬",
    accent: "from-sky-600 via-blue-500 to-indigo-500",
    studio: "응대 데스크",
    stage: "convert",
    gets: ["상황별 답글 3~5개", "리뷰 요청 메시지"],
  },
  chat: {
    title: "톡톡·문자",
    blurb: "출고·제철·재구매 짧은 메시지",
    icon: "📱",
    accent: "from-cyan-600 via-teal-500 to-emerald-400",
    studio: "메시지 룸",
    stage: "convert",
    gets: ["톡톡·문자·알림톡 버전", "발송 타이밍"],
  },
  live: {
    title: "라이브 대본",
    blurb: "라이브커머스 분 단위 진행 대본",
    icon: "📡",
    accent: "from-red-600 via-rose-500 to-pink-400",
    studio: "라이브 부스",
    stage: "convert",
    gets: ["구간별 대사·화면 지시", "오프닝·클로징"],
  },
};

export const SHORTS_DURATIONS = [15, 30, 45] as const;
export const SHORTS_HOOKS = [
  { id: "curiosity", label: "궁금증", hint: "왜? 어떻게?로 멈추게" },
  { id: "emotion", label: "감성", hint: "제철·산지 정서로 공감" },
  { id: "problem", label: "문제제기", hint: "실패·고민을 먼저 짚기" },
  { id: "asmr", label: "비주얼 ASMR", hint: "자르고·즙나고·담는 컷" },
] as const;

export const THREAD_STYLES = [
  { id: "story", label: "산지 이야기", hint: "1인칭 서사" },
  { id: "list", label: "리스트형", hint: "번호로 핵심만" },
  { id: "myth", label: "오해 깨기", hint: "흔한 편견 → 정정" },
  { id: "howto", label: "보관·고르는 법", hint: "실용 팁 나열" },
] as const;

export const THREAD_LENGTHS = [5, 7, 9] as const;

export const CAROUSEL_COUNTS = [5, 6, 7] as const;
export const CAROUSEL_MOODS = [
  { id: "editorial", label: "에디토리얼", hint: "잡지 표지 느낌" },
  { id: "warm", label: "웜 내추럴", hint: "나무·햇살·식탁" },
  { id: "bold", label: "볼드 임팩트", hint: "큰 타이포·강한 대비" },
  { id: "minimal", label: "미니멀", hint: "여백·한 문장" },
] as const;
export const CAROUSEL_AUDIENCES = [
  { id: "gift", label: "선물 구매자" },
  { id: "home", label: "집밥·주부" },
  { id: "beginner", label: "농산물 초보" },
  { id: "premium", label: "프리미엄 취향" },
] as const;

export const BLOG_LENGTHS = [800, 1500, 2500] as const;
export const BLOG_TONES = [
  { id: "guide", label: "구매 가이드", hint: "고르는 법·보관" },
  { id: "story", label: "산지 스토리", hint: "사람·계절 서사" },
  { id: "seo", label: "검색 칼럼", hint: "키워드·FAQ 중심" },
  { id: "recipe", label: "레시피·활용", hint: "손질부터 상차림" },
] as const;

export const REVIEW_TYPES = [
  { id: "praise", label: "칭찬 리뷰", hint: "감사·재구매 유도" },
  { id: "neutral", label: "보통 리뷰", hint: "친절히 보완 안내" },
  { id: "claim", label: "클레임 리뷰", hint: "사과·보상 안내" },
  { id: "request", label: "리뷰 요청", hint: "구매 후 보낼 메시지" },
] as const;

export const CHAT_PURPOSES = [
  { id: "ship", label: "출고 안내", hint: "택배·수령 팁" },
  { id: "season", label: "제철 오픈", hint: "시즌 알림" },
  { id: "reorder", label: "재구매", hint: "단골 유도" },
  { id: "promo", label: "이벤트", hint: "할인·세트" },
] as const;

export const LIVE_DURATIONS = [15, 30, 45] as const;
export const LIVE_DURATION_MIN = 15;
export const LIVE_DURATION_MAX = 45;

/** 라이브 길이를 15~45분 정수로 보정 (프리셋 외 중간 값 허용) */
export function clampLiveDuration(n: unknown, fallback = 30): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(LIVE_DURATION_MAX, Math.max(LIVE_DURATION_MIN, Math.round(v)));
}

export const LIVE_STYLES = [
  { id: "warm", label: "따뜻한 대화", hint: "산지 사장님 톤" },
  { id: "energetic", label: "텐션 높게", hint: "호스트형" },
  { id: "expert", label: "전문가", hint: "고르는 법 강의" },
] as const;

export const ADS_GOALS = [
  { id: "click", label: "클릭 유도", hint: "호기심·혜택" },
  { id: "gift", label: "선물", hint: "명절·포장" },
  { id: "fresh", label: "신선·당일", hint: "출고·제철" },
  { id: "value", label: "가성비", hint: "중량·가격" },
] as const;

export const ShortsSchema = z.object({
  hook: z.string().describe("첫 3초 후킹 문구 (화면 자막용, 18자 내외)"),
  title: z.string().describe("영상 제목·캡션 첫 줄"),
  durationSec: z.number().describe("권장 길이(초)"),
  pacing: z.string().describe("템포 한 줄 (예: 초반 빠른 컷 → 중반 클로즈업)"),
  scenes: z
    .array(
      z.object({
        time: z.string().describe("예: 0~3초"),
        visual: z.string().describe("카메라·구도·소품 지시 (촬영자가 바로 이해하게)"),
        voice: z.string().describe("나레이션 또는 입모양 대사"),
        onScreen: z.string().describe("화면 자막 (짧게)"),
        sfx: z.string().describe("효과음·컷 전환 힌트 (없으면 빈 문자열)"),
      }),
    )
    .describe("4~7개 장면, 타임라인이 끊기지 않게"),
  cta: z.string().describe("마지막 CTA"),
  caption: z.string().describe("업로드용 캡션 본문 (해시태그 제외)"),
  hashtags: z.array(z.string()).describe("해시태그 8~12개 (# 없이)"),
  musicMood: z.string().describe("BGM 분위기 + 추천 키워드"),
  tips: z.array(z.string()).describe("촬영·편집 팁 3개"),
});

export const ThreadsSchema = z.object({
  hook: z.string().describe("1번 포스트를 한 줄로 요약한 후킹"),
  voiceNote: z.string().describe("이 쓰레드의 말투·페르소나 한 줄"),
  posts: z
    .array(
      z.object({
        text: z.string().describe("한 포스트 본문. 줄바꿈 허용. 1번은 반드시 스크롤 스톱"),
      }),
    )
    .describe("요청한 개수에 맞는 연속 포스트"),
  fullCopy: z.string().describe("복사용 전체 글 (포스트 사이에 빈 줄 + --- )"),
  hashtags: z.array(z.string()).describe("해시태그 5~8개 (# 없이)"),
  tips: z.array(z.string()).describe("게시 시간·첫댓글 팁 2~3개"),
});

export const CarouselSchema = z.object({
  coverTitle: z.string().describe("표지 큰 제목 (짧고 임팩트)"),
  coverSubtitle: z.string().describe("표지 부제"),
  artDirection: z.string().describe("전체 아트디렉션 한 줄 (색·폰트·사진 톤)"),
  slides: z
    .array(
      z.object({
        number: z.number(),
        headline: z.string().describe("장 제목"),
        body: z.string().describe("본문 2~4문장 또는 불릿"),
        visual: z.string().describe("레이아웃·사진·타이포 지시"),
        colorNote: z.string().describe("이 장 포인트 컬러/배경 힌트"),
        showImage: z
          .boolean()
          .describe(
            "이 장 가운데에 상품 사진/생성 이미지를 넣을지. 표지·마지막 CTA 장은 false, 중간 정보·활용 장은 true 권장",
          ),
        imagePrompt: z
          .string()
          .describe(
            "showImage가 true일 때 영어 이미지 프롬프트. 상품이 잘 보이게, 텍스트/워터마크/로고 없이. false면 빈 문자열",
          ),
      }),
    )
    .describe("표지 포함, 요청한 장수"),
  closingCta: z.string().describe("마지막 장 CTA"),
  caption: z.string().describe("피드 업로드용 캡션"),
  hashtags: z.array(z.string()).describe("해시태그 8~12개 (# 없이)"),
  tips: z.array(z.string()).describe("디자인·업로드 팁 2~3개"),
});

export const BlogSchema = z.object({
  title: z.string().describe("검색·클릭을 노린 제목 (40자 내외, 과장 금지)"),
  subtitle: z.string().describe("부제 한 줄"),
  metaDescription: z.string().describe("검색 스니펫용 설명 80~110자"),
  intro: z.string().describe("도입부 2~4문단. 공감 → 문제 → 이 글에서 해결할 것"),
  heroImagePrompt: z
    .string()
    .describe(
      "글 상단(썸네일·히어로)용 영어 이미지 프롬프트. 상품이 잘 보이는 화보 컷, 텍스트·로고·워터마크 없이",
    ),
  sections: z
    .array(
      z.object({
        heading: z.string().describe("소제목 (H2)"),
        body: z.string().describe("본문. 문단 사이 빈 줄. 구체적 팁·장면 포함"),
        showImage: z
          .boolean()
          .describe(
            "이 섹션 소제목 바로 아래에 사진을 넣을지. 섹션의 절반 이상은 true 권장",
          ),
        imagePrompt: z
          .string()
          .describe(
            "showImage가 true일 때 영어 이미지 프롬프트. 해당 소제목 장면(고르기·보관·레시피 등)에 맞게. false면 빈 문자열",
          ),
        imageCaption: z
          .string()
          .describe("사진 아래 붙일 짧은 한글 캡션. showImage false면 빈 문자열"),
      }),
    )
    .describe("3~6개 본문 섹션"),
  faq: z
    .array(z.object({ q: z.string(), a: z.string() }))
    .describe("독자가 자주 묻는 질문 3~5개"),
  closingCta: z.string().describe("자연스러운 마지막 CTA"),
  tags: z.array(z.string()).describe("블로그 태그 6~10개 (# 없이)"),
  tips: z.array(z.string()).describe("발행·썸네일·내부링크 팁 2~3개"),
});

export const ReviewSchema = z.object({
  toneNote: z.string().describe("이 답글의 말투 한 줄"),
  replies: z
    .array(
      z.object({
        label: z.string().describe("상황 라벨 (예: 5점 칭찬)"),
        text: z.string().describe("바로 붙여넣을 답글/메시지"),
      }),
    )
    .describe("3~5개 변형"),
  tips: z.array(z.string()).describe("응대·타이밍 팁 2~3개"),
});

export const ChatSchema = z.object({
  purposeNote: z.string().describe("이 메시지 묶음의 목적 한 줄"),
  messages: z
    .array(
      z.object({
        channel: z.string().describe("톡톡 / 문자 / 알림톡 중 어디에 맞는지"),
        title: z.string().describe("짧은 제목·구분"),
        body: z.string().describe("본문. 문자면 짧게, 톡톡은 조금 길게"),
      }),
    )
    .describe("3~5개"),
  tips: z.array(z.string()).describe("발송 타이밍 팁 2~3개"),
});

export const LiveSchema = z.object({
  title: z.string().describe("라이브 방 제목"),
  durationMin: z.number().describe("권장 진행 분"),
  opening: z.string().describe("오프닝 인사·후킹"),
  segments: z
    .array(
      z.object({
        time: z.string().describe("예: 0~3분"),
        goal: z.string().describe("이 구간의 목표"),
        script: z.string().describe("말할 내용"),
        onScreen: z.string().describe("화면·자막·상품 노출 지시"),
      }),
    )
    .describe("5~8개 구간"),
  closing: z.string().describe("클로징·구매 CTA"),
  tips: z.array(z.string()).describe("라이브 운영 팁 2~3개"),
});

export const AdsSchema = z.object({
  goalNote: z.string().describe("이 소재 세트의 전략 한 줄"),
  headlines: z
    .array(
      z.object({
        text: z.string().describe("광고 제목. 공백 포함 15자 이내"),
        chars: z.number().describe("글자 수"),
      }),
    )
    .describe("제목 후보 5~8개"),
  descriptions: z
    .array(
      z.object({
        text: z.string().describe("광고 설명. 공백 포함 45자 이내"),
        chars: z.number().describe("글자 수"),
      }),
    )
    .describe("설명 후보 5~8개"),
  tips: z.array(z.string()).describe("소재 A/B·입찰 팁 2~3개"),
});

export type ShortsResult = z.infer<typeof ShortsSchema>;
export type ThreadsResult = z.infer<typeof ThreadsSchema>;
export type CarouselResult = z.infer<typeof CarouselSchema>;
export type BlogResult = z.infer<typeof BlogSchema>;
export type ReviewResult = z.infer<typeof ReviewSchema>;
export type ChatResult = z.infer<typeof ChatSchema>;
export type LiveResult = z.infer<typeof LiveSchema>;
export type AdsResult = z.infer<typeof AdsSchema>;

/** 이모지·한글도 한 글자로 세기 위해 코드포인트 단위로 센다 */
export const charCount = (text: string) => [...text].length;

/** AI가 적은 chars는 틀릴 수 있어 실제 글자 수로 덮어쓴다 */
export function withRealCharCounts(ads: AdsResult): AdsResult {
  const recount = (items: AdsResult["headlines"]) => items.map((i) => ({ ...i, chars: charCount(i.text) }));
  return { ...ads, headlines: recount(ads.headlines), descriptions: recount(ads.descriptions) };
}

export type MarketingResult =
  | ({ format: "shorts" } & ShortsResult)
  | ({ format: "threads" } & ThreadsResult)
  | ({ format: "carousel" } & CarouselResult)
  | ({ format: "blog" } & BlogResult)
  | ({ format: "review" } & ReviewResult)
  | ({ format: "chat" } & ChatResult)
  | ({ format: "live" } & LiveResult)
  | ({ format: "ads" } & AdsResult);

export const SCHEMA_BY_FORMAT = {
  shorts: ShortsSchema,
  threads: ThreadsSchema,
  carousel: CarouselSchema,
  blog: BlogSchema,
  review: ReviewSchema,
  chat: ChatSchema,
  live: LiveSchema,
  ads: AdsSchema,
} as const;

export type MarketingRequestBody = {
  format: MarketingFormat;
  product: string;
  note?: string;
  shorts?: { duration: number; hookStyle: string; onCamera: boolean };
  threads?: { style: string; length: number };
  carousel?: { slides: number; mood: string; audience: string };
  blog?: { length: number; tone: string };
  review?: { type: string };
  chat?: { purpose: string };
  live?: { duration: number; style: string };
  ads?: { goal: string };
};

const COMMON_RULES = `[공통 원칙]
1. 과장·허위 ("최고", "1등", "100%", 질병·효능 치료) 금지.
2. 구체적일수록 좋음: 산지, 제철, 고르는 법, 보관, 손질, 레시피.
3. 판매 강요보다 도움 → 자연스러운 CTA.
4. 없는 수치는 지어내지 않음. 한국어. 해시태그는 # 없이.`;

export const SYSTEM_BY_FORMAT: Record<MarketingFormat, string> = {
  shorts: `당신은 농수산물 숏폼(릴스/숏츠/틱톡) 전문 영상 감독자이자 스크립트 라이터입니다.
초 단위로 시청자를 붙잡는 대본을 씁니다. 장면마다 화면·대사·자막·효과음을 분리합니다.
얼굴 출연 여부와 목표 길이를 반영해 템포를 설계하세요.
${COMMON_RULES}`,
  threads: `당신은 Threads(스레드)에서 농수산물 스토리로 팔로워를 모으는 카피라이터입니다.
1번 포스트가 피드에서 멈추게 하고, 이후는 한 포스트에 한 포인트만. 말투는 대화체·호흡이 짧게.
요청한 포스트 개수와 스토리 스타일(산지 이야기/리스트/오해 깨기/하우투)을 지키세요.
${COMMON_RULES}`,
  carousel: `당신은 인스타그램 카드뉴스(캐러셀) 아트디렉터 겸 카피라이터입니다.
잡지 화보처럼 장마다 하나의 메시지, 타이포·여백·사진 구도를 구체적으로 지시합니다.
요청한 장수·디자인 무드·타깃 독자를 반영하세요. 표지는 스크롤 스톱, 마지막은 CTA.
중간 장(2장~끝에서 하나 전) 중 절반 이상은 showImage=true 로 두고, 상품이 잘 보이는 영어 imagePrompt를 작성하세요.
표지와 마지막 CTA 장은 보통 showImage=false. imagePrompt에는 화면 위 글자·로고·워터마크를 넣지 마세요.
${COMMON_RULES}`,
  blog: `당신은 네이버 블로그·자사몰 매거진용 농수산물 칼럼 에디터입니다.
검색되는 제목, 읽히는 소제목, 구체적인 고르는 법·보관·레시피를 본문에 녹입니다.
요청한 분량(대략 글자 수)과 톤을 지키세요. 문단을 짧게, 전문용어는 쉽게.
상단 히어로용 heroImagePrompt를 반드시 채우고, 섹션의 절반 이상은 showImage=true 로 두어 본문 중간중간 사진이 들어가게 하세요.
imagePrompt는 영어, 상품이 잘 보이게, 화면 위 글자·로고·워터마크 없이. imageCaption은 짧은 한글.
${COMMON_RULES}`,
  review: `당신은 농수산물 셀러의 리뷰 응대 전문가입니다.
칭찬·보통·클레임·리뷰요청 상황에 맞는 짧고 진심 어린 한국어 답글을 여러 버전으로 씁니다.
클레임은 사과·확인·다음 조치 순으로, 과도한 확약은 피하세요.
${COMMON_RULES}`,
  chat: `당신은 스마트스토어 톡톡·문자·알림톡 메시지 카피라이터입니다.
출고·제철·재구매·이벤트 목적에 맞게 짧고 따뜻한 메시지를 여러 채널용으로 씁니다.
문자는 특히 짧게, 링크·과장 없이.
${COMMON_RULES}`,
  live: `당신은 농수산물 라이브커머스 대본 작가입니다.
오프닝부터 클로징까지 분 단위로 목표·대사·화면 지시를 나눠 씁니다.
요청한 길이와 호스트 톤을 지키세요.
${COMMON_RULES}`,
  ads: `당신은 네이버 쇼핑검색·파워링크 광고 소재 카피라이터입니다.
제목은 공백 포함 15자 이내, 설명은 45자 이내로 엄수합니다. chars에 실제 글자 수를 적습니다.
클릭을 유도하되 허위·과장·효능 표현은 금지합니다. 산지·제철·중량·선물 등 구체 키워드를 넣으세요.
${COMMON_RULES}`,
};

export function buildMarketingPrompt(body: MarketingRequestBody & { today: string }) {
  const base = [`오늘 날짜: ${body.today}`, `상품/주제: ${body.product.trim()}`, body.note?.trim() ? `판매자 메모: ${body.note.trim()}` : ""];

  if (body.format === "shorts") {
    const o = body.shorts!;
    const hook = SHORTS_HOOKS.find((h) => h.id === o.hookStyle);
    return [
      ...base,
      `형식: 숏폼 영상 대본`,
      `목표 길이: ${o.duration}초`,
      `후킹 스타일: ${hook?.label ?? o.hookStyle} (${hook?.hint ?? ""})`,
      `얼굴 출연: ${o.onCamera ? "출연(토킹헤드 가능)" : "얼굴 없이 손·상품·산지 컷 위주"}`,
      "첫 3초 후킹 → 본문 정보/감각 → CTA. 장면 타임라인이 이어지게 작성.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (body.format === "threads") {
    const o = body.threads!;
    const style = THREAD_STYLES.find((s) => s.id === o.style);
    return [
      ...base,
      `형식: Threads 연속 글`,
      `스토리 스타일: ${style?.label ?? o.style} (${style?.hint ?? ""})`,
      `포스트 수: ${o.length}개`,
      "1번은 한 줄로도 임팩트. 마지막에 소프트 CTA. fullCopy에 --- 구분 포함.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (body.format === "carousel") {
    const o = body.carousel!;
    const mood = CAROUSEL_MOODS.find((m) => m.id === o.mood);
    const aud = CAROUSEL_AUDIENCES.find((a) => a.id === o.audience);
    return [
      ...base,
      `형식: 인스타 카드뉴스(캐러셀)`,
      `장수: ${o.slides}장 (표지 포함)`,
      `디자인 무드: ${mood?.label ?? o.mood} (${mood?.hint ?? ""})`,
      `타깃 독자: ${aud?.label ?? o.audience}`,
      "각 장 headline/body/visual/colorNote/showImage/imagePrompt를 채우고 artDirection으로 전체 톤을 통일.",
      "중간 장에 상품 컷이 들어가도록 showImage를 충분히 true로 두세요.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (body.format === "blog") {
    const o = body.blog!;
    const tone = BLOG_TONES.find((t) => t.id === o.tone);
    return [
      ...base,
      `형식: 블로그 칼럼 (네이버·자사몰)`,
      `목표 분량: 공백 포함 약 ${o.length}자`,
      `톤: ${tone?.label ?? o.tone} (${tone?.hint ?? ""})`,
      "title은 검색 클릭용. intro → sections → faq → CTA. 본문은 문단을 나눠 주세요.",
      "heroImagePrompt와 섹션별 showImage/imagePrompt/imageCaption을 채워 중간중간 사진이 들어가게 하세요.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (body.format === "review") {
    const o = body.review!;
    const type = REVIEW_TYPES.find((t) => t.id === o.type);
    return [
      ...base,
      `형식: 리뷰 답글 / 리뷰 요청 메시지`,
      `상황: ${type?.label ?? o.type} (${type?.hint ?? ""})`,
      "바로 붙여넣을 수 있는 답글 3~5개. 클레임이면 사과·확인·조치 순.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (body.format === "chat") {
    const o = body.chat!;
    const purpose = CHAT_PURPOSES.find((p) => p.id === o.purpose);
    return [
      ...base,
      `형식: 톡톡·문자·알림톡 메시지`,
      `목적: ${purpose?.label ?? o.purpose} (${purpose?.hint ?? ""})`,
      "채널별로 길이 조절. 문자는 특히 짧게.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (body.format === "live") {
    const o = body.live!;
    const style = LIVE_STYLES.find((s) => s.id === o.style);
    return [
      ...base,
      `형식: 라이브커머스 대본`,
      `목표 길이: 약 ${o.duration}분`,
      `호스트 톤: ${style?.label ?? o.style} (${style?.hint ?? ""})`,
      "opening → segments(시간/목표/대사/화면) → closing.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const o = body.ads!;
  const goal = ADS_GOALS.find((g) => g.id === o.goal);
  return [
    ...base,
    `형식: 네이버 검색·쇼핑 광고 소재`,
    `목표: ${goal?.label ?? o.goal} (${goal?.hint ?? ""})`,
    "제목 15자 이내 / 설명 45자 이내. headlines·descriptions 각 5~8개. chars는 실제 글자 수.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function marketingToText(r: MarketingResult) {
  if (r.format === "shorts") {
    return [
      `[숏폼] ${r.title}`,
      `후킹: ${r.hook}`,
      `길이: 약 ${r.durationSec}초 · 템포: ${r.pacing} · BGM: ${r.musicMood}`,
      "",
      ...r.scenes.map(
        (s, i) => `장면 ${i + 1} (${s.time})\n화면: ${s.visual}\n대사: ${s.voice}\n자막: ${s.onScreen}${s.sfx ? `\n효과: ${s.sfx}` : ""}`,
      ),
      "",
      `CTA: ${r.cta}`,
      "",
      `[캡션]\n${r.caption}`,
      "",
      r.hashtags.map((h) => `#${h}`).join(" "),
      "",
      "팁:",
      ...r.tips.map((t) => `- ${t}`),
    ].join("\n");
  }
  if (r.format === "threads") {
    return [
      `[쓰레드] ${r.hook}`,
      `보이스: ${r.voiceNote}`,
      "",
      r.fullCopy,
      "",
      r.hashtags.map((h) => `#${h}`).join(" "),
      "",
      "팁:",
      ...r.tips.map((t) => `- ${t}`),
    ].join("\n");
  }
  if (r.format === "carousel") {
    return [
      `[카드뉴스] ${r.coverTitle} — ${r.coverSubtitle}`,
      `아트디렉션: ${r.artDirection}`,
      "",
      ...r.slides.map((s) => `${s.number}장. ${s.headline}\n${s.body}\n(비주얼: ${s.visual} / 컬러: ${s.colorNote})`),
      "",
      `CTA: ${r.closingCta}`,
      "",
      `[캡션]\n${r.caption}`,
      "",
      r.hashtags.map((h) => `#${h}`).join(" "),
      "",
      "팁:",
      ...r.tips.map((t) => `- ${t}`),
    ].join("\n\n");
  }
  if (r.format === "blog") {
    return [
      `[블로그] ${r.title}`,
      r.subtitle,
      "",
      r.metaDescription,
      "",
      r.intro,
      "",
      r.heroImagePrompt ? `[히어로 사진 프롬프트] ${r.heroImagePrompt}` : "",
      "",
      ...r.sections.flatMap((s) => [
        `## ${s.heading}`,
        s.showImage ? `[사진] ${s.imageCaption || s.imagePrompt}` : "",
        s.body,
        "",
      ]),
      "FAQ",
      ...r.faq.map((f) => `Q. ${f.q}\nA. ${f.a}`),
      "",
      `CTA: ${r.closingCta}`,
      "",
      r.tags.map((t) => `#${t}`).join(" "),
      "",
      "팁:",
      ...r.tips.map((t) => `- ${t}`),
    ]
      .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
      .join("\n");
  }
  if (r.format === "review") {
    return [
      `[리뷰 답글] ${r.toneNote}`,
      "",
      ...r.replies.map((x) => `■ ${x.label}\n${x.text}`),
      "",
      "팁:",
      ...r.tips.map((t) => `- ${t}`),
    ].join("\n\n");
  }
  if (r.format === "chat") {
    return [
      `[톡톡·문자] ${r.purposeNote}`,
      "",
      ...r.messages.map((m) => `[${m.channel}] ${m.title}\n${m.body}`),
      "",
      "팁:",
      ...r.tips.map((t) => `- ${t}`),
    ].join("\n\n");
  }
  if (r.format === "live") {
    return [
      `[라이브] ${r.title} · ${r.durationMin}분`,
      "",
      `[오프닝]\n${r.opening}`,
      "",
      ...r.segments.map((s) => `(${s.time}) ${s.goal}\n대사: ${s.script}\n화면: ${s.onScreen}`),
      "",
      `[클로징]\n${r.closing}`,
      "",
      "팁:",
      ...r.tips.map((t) => `- ${t}`),
    ].join("\n\n");
  }
  return [
    `[검색광고] ${r.goalNote}`,
    "",
    "■ 제목",
    ...r.headlines.map((h) => `(${h.chars}자) ${h.text}`),
    "",
    "■ 설명",
    ...r.descriptions.map((d) => `(${d.chars}자) ${d.text}`),
    "",
    "팁:",
    ...r.tips.map((t) => `- ${t}`),
  ].join("\n");
}
