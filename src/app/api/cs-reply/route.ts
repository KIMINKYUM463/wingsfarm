import { rateLimit } from "@/lib/server/rateLimit";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { CS_TONES, CsResultSchema, buildSystemPrompt, type CsTone } from "@/lib/csAi";
import { OPENAI_MODEL, errorResponse, missingKeyResponse, openaiClient, openaiErrorResponse } from "@/lib/server/openai";

const MAX_IMAGES = 4;
const MAX_TURNS = 30;
/** base64 data URL 길이 기준 약 6MB */
const MAX_IMAGE_LENGTH = 8_000_000;

const TurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(8000),
  images: z
    .array(z.string().regex(/^data:image\/(png|jpeg|webp|gif);base64,/).max(MAX_IMAGE_LENGTH))
    .max(MAX_IMAGES)
    .optional(),
});

const RequestSchema = z.object({
  messages: z
    .array(TurnSchema)
    .min(1)
    .max(MAX_TURNS)
    .refine((m) => m.at(-1)?.role === "user", "마지막 메시지는 판매자 메시지여야 합니다.")
    .refine((m) => m.reduce((n, t) => n + (t.images?.length ?? 0), 0) <= MAX_IMAGES),
  tone: z.enum(Object.keys(CS_TONES) as [CsTone, ...CsTone[]]),
  policy: z.string().max(3000),
  products: z.array(z.object({ id: z.string().max(100), name: z.string().max(200) })).max(300),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(`요청 형식이 올바르지 않습니다. 이미지는 PNG/JPG/WEBP로 ${MAX_IMAGES}장까지 올릴 수 있습니다.`, 400);
  }
  const { messages, ...context } = parsed.data;

  try {
    const response = await client.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: buildSystemPrompt(context) },
        ...messages.map((turn) =>
          turn.role === "assistant"
            ? { role: "assistant" as const, content: turn.text }
            : {
                role: "user" as const,
                content: [
                  { type: "input_text" as const, text: turn.text || "(캡처만 보냄)" },
                  ...(turn.images ?? []).map((image_url) => ({ type: "input_image" as const, image_url, detail: "high" as const })),
                ],
              },
        ),
      ],
      text: { format: zodTextFormat(CsResultSchema, "cs_result") },
    });

    if (!response.output_parsed) return errorResponse("AI가 답변을 만들지 못했습니다. 다시 시도해 주세요.", 502);
    return Response.json(response.output_parsed);
  } catch (err) {
    return openaiErrorResponse(err, "cs-reply", "답변 생성 중 오류가 발생했습니다.");
  }
}
