import { rateLimit } from "@/lib/server/rateLimit";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { OPENAI_MODEL, errorResponse, missingKeyResponse, openaiClient, openaiErrorResponse } from "@/lib/server/openai";

const RequestSchema = z.object({
  product: z.string().min(1).max(60),
  channel: z.enum(["smartstore", "coupang"]).default("smartstore"),
  note: z.string().max(300).default(""),
});

const TagsSchema = z.object({
  tags: z.array(z.string()).describe("검색 태그. 공백 포함 가능, # 없이. 중복·상품명 그대로 반복 금지"),
  tips: z.array(z.string()).describe("태그 활용 팁 2~3개"),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "text");
  if (limited) return limited;
  const client = openaiClient();
  if (!client) return missingKeyResponse();

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("상품명을 입력해 주세요.", 400);

  const limit = parsed.data.channel === "coupang" ? 20 : 10;

  try {
    const response = await client.responses.parse({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: `당신은 농수산물 오픈마켓 SEO 전문가입니다.
스마트스토어는 검색태그 최대 10개, 쿠팡은 검색어(태그) 최대 20개입니다.
상품명·카테고리에 이미 들어간 단어를 그대로 반복하지 말고, 동의어·상태(말랑이)·산지·중량·용도(선물)·시즌을 조합하세요.
과장·효능·질병 표현 금지. 한국어만. # 없이.`,
        },
        {
          role: "user",
          content: [
            `상품: ${parsed.data.product.trim()}`,
            `채널: ${parsed.data.channel === "coupang" ? "쿠팡" : "스마트스토어"}`,
            `태그 개수: 정확히 ${limit}개`,
            parsed.data.note.trim() ? `메모: ${parsed.data.note.trim()}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      text: { format: zodTextFormat(TagsSchema, "search_tags") },
    });

    if (!response.output_parsed) return errorResponse("태그를 만들지 못했습니다. 다시 시도해 주세요.", 502);
    const tags = response.output_parsed.tags.map((t) => t.replace(/^#/, "").trim()).filter(Boolean).slice(0, limit);
    return Response.json({ tags, tips: response.output_parsed.tips, channel: parsed.data.channel, limit });
  } catch (err) {
    return openaiErrorResponse(err, "tags", "검색 태그 생성 중 오류가 발생했습니다.");
  }
}
