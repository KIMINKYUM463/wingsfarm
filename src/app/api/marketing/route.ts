import { rateLimit } from "@/lib/server/rateLimit";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  BLOG_LENGTHS,
  BLOG_TONES,
  CAROUSEL_AUDIENCES,
  CAROUSEL_COUNTS,
  CAROUSEL_MOODS,
  CHAT_PURPOSES,
  DETAIL_FOCUSES,
  LIVE_STYLES,
  ADS_GOALS,
  MARKETING_FORMATS,
  REVIEW_TYPES,
  SCHEMA_BY_FORMAT,
  SHORTS_DURATIONS,
  SHORTS_HOOKS,
  SYSTEM_BY_FORMAT,
  THREAD_LENGTHS,
  clampLiveDuration,
  THREAD_STYLES,
  buildMarketingPrompt,
  withRealCharCounts,
  type AdsResult,
  type MarketingFormat,
  type MarketingRequestBody,
} from "@/lib/marketingAi";
import { toDateKey } from "@/lib/format";
import { OPENAI_MODEL, errorResponse, missingKeyResponse, openaiClient, openaiErrorResponse } from "@/lib/server/openai";

const RequestSchema = z.object({
  format: z.enum(MARKETING_FORMATS),
  product: z.string().min(1).max(60),
  note: z.string().max(800).default(""),
  shorts: z.object({ duration: z.number(), hookStyle: z.string().max(40), onCamera: z.boolean() }).optional(),
  threads: z.object({ style: z.string().max(40), length: z.number() }).optional(),
  carousel: z.object({ slides: z.number(), mood: z.string().max(40), audience: z.string().max(40) }).optional(),
  blog: z.object({ length: z.number(), tone: z.string().max(40) }).optional(),
  detail: z.object({ focus: z.string().max(40) }).optional(),
  review: z.object({ type: z.string().max(40) }).optional(),
  chat: z.object({ purpose: z.string().max(40) }).optional(),
  live: z
    .object({
      duration: z.number().int().min(15).max(45),
      style: z.string().max(40),
    })
    .optional(),
  ads: z.object({ goal: z.string().max(40) }).optional(),
});

function normalize(body: z.infer<typeof RequestSchema>): MarketingRequestBody {
  const format = body.format as MarketingFormat;
  const product = body.product.trim();
  const note = body.note;

  if (format === "shorts") {
    const duration = SHORTS_DURATIONS.includes(body.shorts?.duration as (typeof SHORTS_DURATIONS)[number])
      ? (body.shorts!.duration as (typeof SHORTS_DURATIONS)[number])
      : 30;
    const hookStyle = SHORTS_HOOKS.some((h) => h.id === body.shorts?.hookStyle) ? body.shorts!.hookStyle : "curiosity";
    return { format, product, note, shorts: { duration, hookStyle, onCamera: body.shorts?.onCamera ?? false } };
  }
  if (format === "threads") {
    const style = THREAD_STYLES.some((s) => s.id === body.threads?.style) ? body.threads!.style : "story";
    const length = THREAD_LENGTHS.includes(body.threads?.length as (typeof THREAD_LENGTHS)[number])
      ? (body.threads!.length as (typeof THREAD_LENGTHS)[number])
      : 7;
    return { format, product, note, threads: { style, length } };
  }
  if (format === "carousel") {
    const slides = CAROUSEL_COUNTS.includes(body.carousel?.slides as (typeof CAROUSEL_COUNTS)[number])
      ? (body.carousel!.slides as (typeof CAROUSEL_COUNTS)[number])
      : 6;
    const mood = CAROUSEL_MOODS.some((m) => m.id === body.carousel?.mood) ? body.carousel!.mood : "editorial";
    const audience = CAROUSEL_AUDIENCES.some((a) => a.id === body.carousel?.audience) ? body.carousel!.audience : "home";
    return { format, product, note, carousel: { slides, mood, audience } };
  }
  if (format === "blog") {
    const length = BLOG_LENGTHS.includes(body.blog?.length as (typeof BLOG_LENGTHS)[number]) ? (body.blog!.length as (typeof BLOG_LENGTHS)[number]) : 1500;
    const tone = BLOG_TONES.some((t) => t.id === body.blog?.tone) ? body.blog!.tone : "guide";
    return { format, product, note, blog: { length, tone } };
  }
  if (format === "detail") {
    const focus = DETAIL_FOCUSES.some((f) => f.id === body.detail?.focus) ? body.detail!.focus : "fresh";
    return { format, product, note, detail: { focus } };
  }
  if (format === "review") {
    const type = REVIEW_TYPES.some((t) => t.id === body.review?.type) ? body.review!.type : "praise";
    return { format, product, note, review: { type } };
  }
  if (format === "chat") {
    const purpose = CHAT_PURPOSES.some((p) => p.id === body.chat?.purpose) ? body.chat!.purpose : "ship";
    return { format, product, note, chat: { purpose } };
  }
  if (format === "live") {
    const duration = clampLiveDuration(body.live?.duration, 30);
    const style = LIVE_STYLES.some((s) => s.id === body.live?.style) ? body.live!.style : "warm";
    return { format, product, note, live: { duration, style } };
  }
  const goal = ADS_GOALS.some((g) => g.id === body.ads?.goal) ? body.ads!.goal : "click";
  return { format, product, note, ads: { goal } };
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("상품명과 형식을 확인해 주세요.", 400);
  const body = normalize(parsed.data);
  const schema = SCHEMA_BY_FORMAT[body.format];

  try {
    const response = await client.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: SYSTEM_BY_FORMAT[body.format] },
        { role: "user", content: buildMarketingPrompt({ ...body, today: toDateKey(new Date()) }) },
      ],
      text: { format: zodTextFormat(schema, `marketing_${body.format}`) },
    });

    const parsed = response.output_parsed;
    if (!parsed) return errorResponse("AI가 콘텐츠를 만들지 못했습니다. 다시 시도해 주세요.", 502);
    const content = body.format === "ads" ? withRealCharCounts(parsed as AdsResult) : parsed;
    return Response.json({ format: body.format, ...content });
  } catch (err) {
    return openaiErrorResponse(err, "marketing", "마케팅 콘텐츠 생성 중 오류가 발생했습니다.");
  }
}
