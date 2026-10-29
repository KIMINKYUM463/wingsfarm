import { z } from "zod";
// node --test가 경로 별칭(@/)을 모르므로 상대 경로 + 확장자로 가져온다
import {
  EMPTY_IMAGE,
  PLACEHOLDER,
  SECTION_META,
  VOLUME_PLANS,
  aiPlan,
  createSection,
  type DetailImage,
  type DetailItem,
  type DetailSection,
  type SectionType,
  type Volume,
} from "./detailPage.ts";

export const GENERATION_METHODS = [
  { id: "keywords", label: "AI 키워드 선택", hint: "AI가 뽑은 특징 키워드를 골라서 만들기" },
  { id: "benchmark", label: "벤치마킹 참고", hint: "잘 팔리는 상세페이지 캡처를 참고해 구성" },
] as const;
export type GenerationMethod = (typeof GENERATION_METHODS)[number]["id"];

export const LIMITS = { productImages: 6, references: 3, referenceTiles: 8, aiImages: 4, items: 8 } as const;

const RULES = `[문구 원칙]
- 한국어. 모바일에서 세로로 읽는 상세페이지입니다. headline은 20자 안팎(필요하면 \\n으로 두 줄), body는 2~3문장.
- 판매자가 준 정보와 사진에서 확인되는 사실만 씁니다. 산지·중량·당도·등급·인증·수상·수확일처럼 모르는 사실은 지어내지 말고 "${PLACEHOLDER}"로 남깁니다.
- 표시광고법: "최고·1등·100%·무조건" 같은 절대 표현, 질병 예방·치료 효능, 근거 없는 타사 비교, 가짜 후기를 쓰지 않습니다.
- 가격·할인·이벤트는 판매자가 알려 준 경우에만 씁니다.`;

// ───────── 1단계: 특징 키워드 후보 ─────────

export const KeywordGroupsSchema = z.object({
  groups: z
    .array(
      z.object({
        name: z.string().describe("그룹 이름 (예: 맛·식감, 산지·재배, 신선·배송, 용도·선물, 크기·구성)"),
        keywords: z.array(z.string()).describe("2~10자 키워드 6개"),
      }),
    )
    .describe("4~5개 그룹"),
});
export type KeywordGroups = z.infer<typeof KeywordGroupsSchema>;

export const KEYWORD_SYSTEM = `당신은 농수산물 스마트스토어·쿠팡 상세페이지 기획자입니다.
상품명(과 사진)을 보고, 구매 결정에 중요한 특징 키워드 후보를 4~5개 그룹으로 6개씩 제안합니다.
판매자가 사실에 맞는 것만 고르는 후보 목록이므로 다양하게 제안하되, 특정 수치·인증·수상은 넣지 않습니다.
키워드는 짧은 명사구(예: "아삭한 식감", "산지 직송", "선물용 포장").`;

export const buildKeywordUserText = (product: string, note: string) =>
  [`상품명: ${product}`, note && `판매자 메모: ${note}`, "특징 키워드 후보를 만들어 주세요."].filter(Boolean).join("\n");

// ───────── 2단계: 상세페이지 초안 ─────────

const ItemSchema = z.object({ title: z.string(), text: z.string() });

export const SectionCopySchema = z.object({
  eyebrow: z.string().describe("4~12자 짧은 라벨 (영문 대문자 또는 한글)"),
  headline: z.string(),
  body: z.string(),
  items: z.array(ItemSchema),
});
export type SectionCopy = z.infer<typeof SectionCopySchema>;

const DraftSectionSchema = SectionCopySchema.extend({
  type: z.enum(["hero", "summary", "story", "point", "process", "recommend", "guide", "faq", "spec", "cta"]),
  image: z.object({
    choice: z.enum(["product", "ai", "none"]),
    productIndex: z.number().int().describe("choice가 product일 때 상품 사진 번호(0부터), 아니면 0"),
    prompt: z.string().describe("영문 사진 장면 설명. choice가 none이어도 어울리는 장면을 적어 둔다"),
  }),
});

export function buildDraftSchema(volume: Volume) {
  return z.object({
    projectName: z.string().describe("관리용 짧은 이름 (예: 성주 꿀참외 상세)"),
    sections: z.array(DraftSectionSchema).length(aiPlan(volume).length),
  });
}
export type DraftOutput = z.infer<ReturnType<typeof buildDraftSchema>>;

export interface DetailGenerateBody {
  product: string;
  company: string;
  note: string;
  method: GenerationMethod;
  keywords: string[];
  customFeatures: string;
  /** 벤치마킹 캡처를 잘라 낸 조각 */
  references: string[];
  /** AI가 사진을 섹션에 배치하도록 보내는 작은 미리보기 */
  productImages: string[];
  volume: Volume;
}

export function draftSystemPrompt(volume: Volume, productCount: number, method: GenerationMethod) {
  const plan = aiPlan(volume)
    .map((type, i) => `${i + 1}. ${type} (${SECTION_META[type].label} — ${SECTION_META[type].hint}) · items ${SECTION_META[type].items}`)
    .join("\n");
  const photo =
    productCount > 0
      ? `- 상품 사진은 ${productCount}장(0~${productCount - 1}번)입니다. 사진 내용을 보고 어울리는 섹션에 choice="product"와 productIndex로 배치하세요. hero에는 가장 보기 좋은 사진을 씁니다. 같은 사진은 최대 2번.`
      : "- 상품 사진이 없습니다. choice는 ai 또는 none만 씁니다.";

  return `당신은 농수산물 스마트스토어·쿠팡 상세페이지 기획자 겸 카피라이터입니다.
폭 860px 세로형 상세페이지를 아래 순서의 섹션으로 채웁니다. 정확히 ${aiPlan(volume).length}개, 순서와 type을 그대로 지킵니다.

[섹션 순서]
${plan}

${RULES}
- eyebrow: point 섹션은 "POINT 01"처럼 번호를 붙입니다. hero eyebrow는 업체명이나 산지 라벨.
- spec 표는 title=항목명, text=값. 모르는 값은 "${PLACEHOLDER}".
- faq는 title=질문, text=답변. 사실을 모르면 일반적인 안내로 답합니다.

[사진]
${photo}
- 상품 사진이 맞지 않는 장면(산지 풍경, 수확·선별, 요리·상차림 등)은 choice="ai"로 하고 prompt에 영문 장면을 씁니다: photorealistic, natural light, wide 3:2, no text, no logo. AI 사진은 전체 ${LIMITS.aiImages}장 이하.
- spec·faq·notice·cta처럼 사진이 필요 없는 섹션은 choice="none".
${method === "benchmark" ? "\n[벤치마킹]\n- 참고 이미지는 다른 판매자의 상세페이지입니다. 구성 흐름·강조 순서·말투만 참고하고, 문장·브랜드명·수치·사진 설명을 베끼지 않습니다." : ""}`;
}

export function buildDraftUserText(body: Pick<DetailGenerateBody, "product" | "company" | "note" | "method" | "keywords" | "customFeatures">) {
  return [
    `상품명: ${body.product}`,
    body.company && `업체명: ${body.company}`,
    body.note && `판매자 메모(옵션·가격 등): ${body.note}`,
    body.keywords.length > 0 && `판매자가 고른 특징: ${body.keywords.join(", ")}`,
    body.customFeatures && `판매자가 직접 쓴 특징: ${body.customFeatures}`,
    body.method === "benchmark" ? "첨부한 참고 상세페이지의 구성을 참고해 초안을 만들어 주세요." : "위 특징을 중심으로 초안을 만들어 주세요.",
  ]
    .filter(Boolean)
    .join("\n");
}

const clip = (text: string, max: number) => text.trim().slice(0, max);
const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n) || 0));

const cleanItems = (items: DetailItem[]) =>
  items
    .map((i) => ({ title: clip(i.title, 60), text: clip(i.text, 300) }))
    .filter((i) => i.title || i.text)
    .slice(0, LIMITS.items);

function pickImage(raw: DraftOutput["sections"][number]["image"], productCount: number, takeAiSlot: () => boolean): DetailImage {
  const prompt = clip(raw.prompt, 1200);
  if (raw.choice === "product" && productCount > 0) {
    return { ...EMPTY_IMAGE, source: "product", productIndex: clampInt(raw.productIndex, 0, productCount - 1), prompt };
  }
  if (raw.choice !== "none" && prompt && takeAiSlot()) return { ...EMPTY_IMAGE, source: "ai", prompt };
  return { ...EMPTY_IMAGE, prompt };
}

/** AI 응답을 계획된 섹션 순서에 맞추고, 교환·반품 안내(고정 문구)를 끼워 넣는다 */
export function normalizeDraft(raw: DraftOutput, volume: Volume, productCount: number): { projectName: string; sections: DetailSection[] } {
  let aiLeft: number = LIMITS.aiImages;
  const takeAiSlot = () => aiLeft-- > 0;

  const sections = aiPlan(volume).map((type: SectionType, i) => {
    const r = raw.sections[i];
    if (!r) return createSection(type);
    return createSection(type, {
      eyebrow: clip(r.eyebrow, 30),
      headline: clip(r.headline, 80) || SECTION_META[type].starter.headline,
      body: clip(r.body, 600),
      items: type === "hero" ? [] : cleanItems(r.items),
      image: pickImage(r.image, productCount, takeAiSlot),
    });
  });

  const hero = sections[0];
  if (hero?.type === "hero" && hero.image.source === "none" && productCount > 0) {
    hero.image = { ...hero.image, source: "product", productIndex: 0 };
  }

  sections.splice(VOLUME_PLANS[volume].indexOf("notice"), 0, createSection("notice"));
  return { projectName: clip(raw.projectName, 40), sections };
}

// ───────── 섹션 문구 다시 쓰기 ─────────

export const REWRITE_PRESETS = [
  { id: "shorter", label: "더 짧게", instruction: "모바일에서 한눈에 읽히도록 더 짧고 간결하게" },
  { id: "warm", label: "감성적으로", instruction: "산지와 계절이 느껴지는 따뜻하고 감성적인 말투로" },
  { id: "trust", label: "신뢰감 있게", instruction: "과장 없이 차분하고 신뢰감 있는 말투로" },
  { id: "benefit", label: "장점 강조", instruction: "구매자가 얻는 이득이 먼저 보이도록" },
  { id: "easy", label: "쉬운 말로", instruction: "어르신도 이해하기 쉬운 쉬운 말로" },
] as const;

export const REWRITE_SYSTEM = `당신은 농수산물 상세페이지 카피라이터입니다. 섹션 하나의 문구를 요청대로 다시 씁니다.
- 섹션 역할과 항목(items) 개수는 요청이 없으면 유지합니다.
- "${PLACEHOLDER}"는 판매자가 값을 알려 주지 않았다면 그대로 둡니다.
${RULES}`;

export function buildRewriteUserText(input: { product: string; company: string; type: SectionType; copy: SectionCopy; instruction: string }) {
  return [
    `상품명: ${input.product}`,
    input.company && `업체명: ${input.company}`,
    `섹션: ${SECTION_META[input.type].label} (${SECTION_META[input.type].hint})`,
    `현재 문구(JSON): ${JSON.stringify(input.copy)}`,
    `요청: ${input.instruction}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function normalizeCopy(copy: SectionCopy, type: SectionType): SectionCopy {
  return {
    eyebrow: clip(copy.eyebrow, 30),
    headline: clip(copy.headline, 80),
    body: clip(copy.body, 600),
    items: type === "hero" ? [] : cleanItems(copy.items),
  };
}

// ───────── 섹션 사진 ─────────

/** 사진 설명에 덧붙이는 연출 문구 */
export const IMAGE_STYLES = [
  { label: "자연광 스튜디오", text: "clean studio shot, soft natural window light" },
  { label: "산지 현장", text: "on the farm or orchard where it grows, fresh morning light" },
  { label: "식탁 연출", text: "served on a warm rustic dining table with tableware" },
  { label: "흰 배경", text: "minimal pure white background, product centered" },
  { label: "선물 포장", text: "premium gift box packaging with ribbon" },
  { label: "클로즈업", text: "macro close-up showing freshness, juice and texture" },
] as const;

export const buildSectionImagePrompt = (product: string, scene: string, hasReference: boolean) =>
  [
    "Photo for a Korean e-commerce product detail page, wide 3:2 landscape.",
    `Product: ${product}`,
    `Scene: ${scene}`,
    "Photorealistic, natural light, appetizing and fresh, high detail.",
    "No text, no letters, no logos, no watermark.",
    hasReference ? "Keep the exact same product (shape, color, packaging) as in the reference photo." : "",
  ]
    .filter(Boolean)
    .join("\n");
