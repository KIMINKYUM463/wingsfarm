import type { NextRequest } from "next/server";
import { normalizeKeyword } from "@/lib/keyword";
import { getKeywordReport } from "@/lib/server/keywordReport";

export async function GET(req: NextRequest) {
  const keyword = normalizeKeyword(req.nextUrl.searchParams.get("q"));
  if (!keyword) return Response.json({ error: "키워드를 입력해 주세요." }, { status: 400 });
  return Response.json(await getKeywordReport(keyword));
}
