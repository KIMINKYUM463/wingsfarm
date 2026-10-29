/**
 * 상세페이지 제작 — 섹션(프레임) 단위 데이터 모델.
 * 서버·클라이언트 공용(순수 함수만)이라 테스트하기 쉽다.
 */

export const DETAIL_WIDTH = 860;
export const PLACEHOLDER = "[입력 필요]";

export const SECTION_TYPES = [
  "hero",
  "summary",
  "story",
  "point",
  "process",
  "recommend",
  "guide",
  "faq",
  "spec",
  "notice",
  "cta",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export type SectionBg = "light" | "tint" | "dark";
export type ImageSource = "none" | "product" | "ai" | "upload";

export interface DetailItem {
  title: string;
  text: string;
}

export interface DetailImage {
  source: ImageSource;
  /** source가 product일 때 project.productImages 번호 */
  productIndex: number;
  /** AI 생성용 영문 프롬프트 */
  prompt: string;
  /** ai·upload 결과 data URL (product는 렌더링 때 원본을 참조해 중복 저장하지 않음) */
  src: string;
}

export interface DetailSection {
  id: string;
  type: SectionType;
  bg: SectionBg;
  eyebrow: string;
  headline: string;
  body: string;
  items: DetailItem[];
  image: DetailImage;
}

export interface SectionMeta {
  label: string;
  icon: string;
  hint: string;
  bg: SectionBg;
  /** AI에게 주는 항목(items) 개수 지침 */
  items: string;
  starter: Pick<DetailSection, "eyebrow" | "headline" | "body" | "items">;
}

const NOTICE_ITEMS: DetailItem[] = [
  { title: "교환·반품", text: "신선식품 특성상 단순 변심에 의한 교환·반품은 어렵습니다." },
  { title: "상품 하자", text: "파손·변질 등 문제가 있으면 받으신 날 사진을 찍어 문의해 주세요. 확인 후 재발송 또는 환불해 드립니다." },
  { title: "크기·모양", text: "자연에서 자란 농산물이라 크기와 모양이 조금씩 다를 수 있습니다." },
  { title: "배송", text: "수확 상황과 날씨에 따라 출고가 1~2일 늦어질 수 있으며, 늦어지면 미리 안내드립니다." },
];

export const SECTION_META: Record<SectionType, SectionMeta> = {
  hero: {
    label: "메인 표지",
    icon: "🌟",
    hint: "첫 화면 · 상품 사진 위 큰 문구",
    bg: "dark",
    items: "0개",
    starter: { eyebrow: "산지 직송", headline: "한입에 느끼는 제철의 맛", body: "", items: [] },
  },
  summary: {
    label: "핵심 포인트",
    icon: "✅",
    hint: "장점 3~4가지 요약",
    bg: "light",
    items: "3~4개 (title: 짧은 장점, text: 한 줄 설명)",
    starter: { eyebrow: "WHY", headline: "이래서 다릅니다", body: "", items: [{ title: "", text: "" }] },
  },
  story: {
    label: "산지 이야기",
    icon: "🌾",
    hint: "농장·생산자·재배 방식",
    bg: "tint",
    items: "0개",
    starter: { eyebrow: "STORY", headline: "정성으로 키웠습니다", body: "", items: [] },
  },
  point: {
    label: "특장점",
    icon: "💎",
    hint: "장점 하나를 사진과 함께 자세히",
    bg: "light",
    items: "0~3개 (보조 근거)",
    starter: { eyebrow: "POINT", headline: "", body: "", items: [] },
  },
  process: {
    label: "수확·선별 과정",
    icon: "🧺",
    hint: "단계별 과정",
    bg: "tint",
    items: "3~5개 (title: 단계 이름, text: 설명)",
    starter: { eyebrow: "PROCESS", headline: "받으시기까지", body: "", items: [{ title: "수확", text: "" }] },
  },
  recommend: {
    label: "이런 분께 추천",
    icon: "🙋",
    hint: "추천 대상",
    bg: "light",
    items: "3~5개 (title: 대상, text: 이유)",
    starter: { eyebrow: "FOR YOU", headline: "이런 분께 추천해요", body: "", items: [{ title: "", text: "" }] },
  },
  guide: {
    label: "보관·먹는 법",
    icon: "🍽️",
    hint: "보관 방법·맛있게 먹는 법",
    bg: "tint",
    items: "3~5개 (title: 방법, text: 설명)",
    starter: { eyebrow: "GUIDE", headline: "더 맛있게 즐기는 법", body: "", items: [{ title: "보관", text: "" }] },
  },
  faq: {
    label: "자주 묻는 질문",
    icon: "❓",
    hint: "Q&A",
    bg: "light",
    items: "3~5개 (title: 질문, text: 답변)",
    starter: { eyebrow: "FAQ", headline: "자주 묻는 질문", body: "", items: [{ title: "", text: "" }] },
  },
  spec: {
    label: "상품 정보",
    icon: "📋",
    hint: "품목·원산지·중량 등 표",
    bg: "light",
    items: "5~7개 (title: 항목명, text: 값)",
    starter: {
      eyebrow: "INFO",
      headline: "상품 정보",
      body: "",
      items: ["품목", "원산지", "중량·구성", "보관 방법", "배송"].map((title) => ({ title, text: PLACEHOLDER })),
    },
  },
  notice: {
    label: "교환·반품 안내",
    icon: "📦",
    hint: "신선식품 안내 (기본 문구)",
    bg: "tint",
    items: "4개",
    starter: { eyebrow: "NOTICE", headline: "구매 전 확인해 주세요", body: "", items: NOTICE_ITEMS },
  },
  cta: {
    label: "마무리",
    icon: "🛒",
    hint: "구매 유도 마지막 화면",
    bg: "dark",
    items: "0~3개",
    starter: { eyebrow: "", headline: "지금, 가장 맛있을 때 만나보세요", body: "", items: [] },
  },
};

export interface DetailTheme {
  id: string;
  name: string;
  primary: string;
  accent: string;
  tint: string;
  dark: string;
  ink: string;
}

export const DETAIL_THEMES = [
  { id: "fresh", name: "싱그러운 그린", primary: "#2f7d4f", accent: "#f2b632", tint: "#eef6ee", dark: "#17351f", ink: "#1c2a20" },
  { id: "premium", name: "프리미엄 블랙", primary: "#1d1d1f", accent: "#c8a45a", tint: "#f6f2ea", dark: "#121212", ink: "#1d1d1f" },
  { id: "farm", name: "따뜻한 농가", primary: "#8a5a2b", accent: "#e07a2f", tint: "#f8f0e3", dark: "#3b2a1a", ink: "#3b2a1a" },
  { id: "juicy", name: "과즙 가득", primary: "#e8582a", accent: "#ffc93c", tint: "#fff3e8", dark: "#5a1f0e", ink: "#3a1d12" },
  { id: "ocean", name: "바다 신선", primary: "#1f6fb2", accent: "#36c2c9", tint: "#eaf4fb", dark: "#0d2b45", ink: "#10283d" },
  { id: "berry", name: "베리 핑크", primary: "#c2335b", accent: "#6aa84f", tint: "#fdeef2", dark: "#4a1426", ink: "#3a1420" },
] as const satisfies readonly DetailTheme[];
export type ThemeId = (typeof DETAIL_THEMES)[number]["id"];

export const themeById = (id: string): DetailTheme => DETAIL_THEMES.find((t) => t.id === id) ?? DETAIL_THEMES[0];

export const VOLUMES = [
  { id: "simple", label: "간단", hint: "핵심만 7섹션" },
  { id: "standard", label: "표준", hint: "10섹션 · 추천" },
  { id: "rich", label: "풍성", hint: "13섹션" },
] as const;
export type Volume = (typeof VOLUMES)[number]["id"];

export const VOLUME_PLANS: Record<Volume, SectionType[]> = {
  simple: ["hero", "summary", "point", "point", "spec", "notice", "cta"],
  standard: ["hero", "summary", "story", "point", "point", "point", "guide", "spec", "notice", "cta"],
  rich: ["hero", "summary", "story", "point", "point", "point", "process", "recommend", "guide", "faq", "spec", "notice", "cta"],
};

/** 교환·반품 안내는 고정 문구라 AI에게 맡기지 않는다 */
export const aiPlan = (volume: Volume) => VOLUME_PLANS[volume].filter((t) => t !== "notice");

export interface DetailProject {
  id: string;
  name: string;
  product: string;
  company: string;
  themeId: string;
  /** 업로드한 상품 사진(data URL) */
  productImages: string[];
  sections: DetailSection[];
  createdAt: number;
  updatedAt: number;
}

/** http(사설 IP) 접속처럼 crypto.randomUUID가 없는 환경도 고려 */
export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const EMPTY_IMAGE: DetailImage = { source: "none", productIndex: 0, prompt: "", src: "" };

export function createSection(type: SectionType, patch: Partial<Omit<DetailSection, "id" | "type">> = {}): DetailSection {
  const meta = SECTION_META[type];
  return {
    id: newId(),
    type,
    bg: meta.bg,
    ...meta.starter,
    items: meta.starter.items.map((i) => ({ ...i })),
    image: { ...EMPTY_IMAGE },
    ...patch,
  };
}

export function createProject(init: Pick<DetailProject, "product" | "company" | "themeId" | "productImages" | "sections"> & { name?: string }): DetailProject {
  const now = Date.now();
  return { id: newId(), name: init.name || `${init.product} 상세페이지`, createdAt: now, updatedAt: now, ...init };
}

/** product는 원본 사진을, ai·upload는 저장된 결과를 쓴다 */
export function resolveImageSrc(image: DetailImage, productImages: string[]) {
  if (image.source === "product") return productImages[image.productIndex] ?? "";
  if (image.source === "ai" || image.source === "upload") return image.src;
  return "";
}

/** 프롬프트는 있지만 아직 만들지 않은 AI 사진 */
export const pendingAiImages = (sections: DetailSection[]) => sections.filter((s) => s.image.source === "ai" && !s.image.src && s.image.prompt.trim());

export function moveItem<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** 긴 이미지 한 장의 최대 높이 — 넘으면 섹션 경계에서 여러 장으로 나눈다 */
export const MAX_LONG_IMAGE_HEIGHT = 15000;

/** 섹션 높이 목록을 순서대로 묶어 각 묶음 합이 max를 넘지 않게 한다 (한 섹션이 max보다 크면 단독) */
export function groupByHeight(heights: number[], max = MAX_LONG_IMAGE_HEIGHT) {
  const groups: number[][] = [];
  let current: number[] = [];
  let sum = 0;
  heights.forEach((h, i) => {
    if (current.length && sum + h > max) {
      groups.push(current);
      current = [];
      sum = 0;
    }
    current.push(i);
    sum += h;
  });
  if (current.length) groups.push(current);
  return groups;
}

const sectionTexts = (s: DetailSection) => [s.eyebrow, s.headline, s.body, ...s.items.flatMap((i) => [i.title, i.text])];

/** "[입력 필요]"가 남은 섹션 수 — 내보내기 전에 경고 */
export const countPlaceholders = (sections: DetailSection[]) =>
  sections.filter((s) => sectionTexts(s).some((t) => t.includes(PLACEHOLDER))).length;

/** 스마트에디터 텍스트 입력·복사용 */
export function projectToText(project: Pick<DetailProject, "sections">) {
  return project.sections
    .map((s) =>
      [
        s.eyebrow && `[${s.eyebrow}]`,
        s.headline,
        s.body,
        ...s.items.filter((i) => i.title || i.text).map((i) => (i.title && i.text ? `· ${i.title}: ${i.text}` : `· ${i.title || i.text}`)),
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}
