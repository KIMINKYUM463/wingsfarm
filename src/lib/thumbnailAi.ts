import { z } from "zod";

/** 메인 최대 1장, 서브 최대 9장 — UI·API 공통 상한 */
export const THUMB_LIMIT = { main: 1, sub: 9 } as const;
export const SUB_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type SubCount = (typeof SUB_COUNTS)[number];

const ShotSchema = z.object({
  id: z.string().describe("main 또는 sub1~subN"),
  role: z.enum(["main", "sub"]).describe("메인 썸네일인지 서브인지"),
  title: z.string().describe("한국어 짧은 제목 (예: 손으로 들고 있는 장면)"),
  scene: z.string().describe("장면을 한국어로 2문장 설명 (판매자가 이해하기 쉽게)"),
  prompt: z
    .string()
    .describe(
      "이미지 생성용 영문 프롬프트. 업로드한 상품의 모양·색·포장을 유지한 채 장면만 바꿈. 정사각 1:1, 상업용 식품 썸네일, 과장 텍스트/워터마크/로고 금지",
    ),
});

export type ThumbnailShot = z.infer<typeof ShotSchema>;

/** 정규화 후 클라이언트가 받는 형태 — main은 요청하지 않으면 null */
export type ThumbnailPlan = {
  productSummary: string;
  main: ThumbnailShot | null;
  subs: ThumbnailShot[];
};

export type ThumbnailPlanOptions = {
  includeMain: boolean;
  subCount: SubCount;
};

/** OpenAI structured output용 — 요청 장수에 맞춰 스키마를 만듦 */
export function buildThumbnailPlanSchema(opts: ThumbnailPlanOptions) {
  const { includeMain, subCount } = opts;
  const productSummary = z.string().describe("사진에서 읽은 상품 한 줄 요약 (한국어)");

  if (includeMain && subCount > 0) {
    return z.object({
      productSummary,
      main: ShotSchema.describe("메인 썸네일 1장 — 클릭을 유도하는 히어로 컷"),
      subs: z
        .array(ShotSchema)
        .length(subCount)
        .describe(`서브 썸네일 ${subCount}장 — 서로 다른 각도·스토리`),
    });
  }
  if (includeMain) {
    return z.object({
      productSummary,
      main: ShotSchema.describe("메인 썸네일 1장 — 클릭을 유도하는 히어로 컷"),
    });
  }
  return z.object({
    productSummary,
    subs: z
      .array(ShotSchema)
      .length(subCount)
      .describe(`서브 썸네일 ${subCount}장 — 서로 다른 각도·스토리`),
  });
}

export function thumbnailPlanPrompt(opts: ThumbnailPlanOptions) {
  const { includeMain, subCount } = opts;
  const parts: string[] = [];
  if (includeMain) parts.push("메인 썸네일 1장");
  if (subCount > 0) parts.push(`서브 썸네일 ${subCount}장`);
  const composition = parts.join(" + ");

  return `당신은 농수산물(과일·채소·수산) 스마트스토어·쿠팡 상세페이지 썸네일 디렉터입니다.
판매자가 올린 상품 사진 1장을 보고, 그 상품을 그대로 활용한 ${composition}의 촬영·생성 구성을 잡습니다.

[원칙]
1. 업로드 사진 속 상품(종류·색·형태·포장)을 정확히 읽고 productSummary에 적습니다.
${includeMain ? "2. main은 클릭을 유도하는 히어로 컷: 사람이 상품을 들고 있는 장면, 선물 세트 연출, 식탁 위 풍성한 연출 등 중 상품에 맞는 것." : "2. 메인은 요청되지 않았습니다. main 필드를 만들지 마세요."}
${subCount > 0 ? `3. subs는 정확히 ${subCount}장이고 서로 다른 스토리여야 합니다. 예: 과수원/밭에서 수확, 과즙·수분 클로즈업, 칼로 자른 단면, 박스 포장, 손과 크기 비교, 요리·상차림, 산지 풍경, 아이스박스·배송, 신선도 디테일(이슬·잎). 상품 특성에 맞게 조정. 요청한 장수(${subCount})만 채우세요.` : "3. 서브는 요청되지 않았습니다. subs 필드를 만들지 마세요."}
4. prompt는 영어. "the exact same product from the reference photo"를 명시하고, 정사각 상품 썸네일, 자연광, 상업 사진 느낌. 가짜 브랜드 로고·한글/영문 큰 문구·워터마크 금지.
5. 표시광고법상 효능·질병 치료 연출 금지.
6. title·scene은 한국어.`;
}

export function buildThumbnailPlanUserText(product: string, note: string, opts: ThumbnailPlanOptions) {
  const { includeMain, subCount } = opts;
  const parts: string[] = [];
  if (includeMain) parts.push("메인 1장");
  if (subCount > 0) parts.push(`서브 ${subCount}장`);

  return [
    `상품명: ${product.trim()}`,
    note.trim() ? `판매자 메모: ${note.trim()}` : "",
    `위 상품 사진을 참고해 ${parts.join(" + ")} 썸네일 구성을 잡아 주세요. 요청한 장수만 정확히 맞춰 주세요.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** API 파싱 결과를 UI용 ThumbnailPlan으로 정규화 */
export function normalizeThumbnailPlan(
  parsed: { productSummary: string; main?: ThumbnailShot; subs?: ThumbnailShot[] },
  opts: ThumbnailPlanOptions,
): ThumbnailPlan {
  const main = opts.includeMain && parsed.main ? { ...parsed.main, id: "main", role: "main" as const } : null;
  const rawSubs = opts.subCount > 0 ? (parsed.subs ?? []).slice(0, opts.subCount) : [];
  const subs = rawSubs.map((s, i) => ({ ...s, id: `sub${i + 1}`, role: "sub" as const }));
  return { productSummary: parsed.productSummary, main, subs };
}

export function allShots(plan: ThumbnailPlan): ThumbnailShot[] {
  return [...(plan.main ? [plan.main] : []), ...plan.subs];
}

export function planLabel(opts: ThumbnailPlanOptions) {
  const parts: string[] = [];
  if (opts.includeMain) parts.push("메인1");
  if (opts.subCount > 0) parts.push(`서브${opts.subCount}`);
  return parts.join("+") || "없음";
}

export function totalShotCount(opts: ThumbnailPlanOptions) {
  return (opts.includeMain ? 1 : 0) + opts.subCount;
}
