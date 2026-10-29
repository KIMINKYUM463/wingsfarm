import { getKamisPrices } from "@/lib/server/kamis";

/** KAMIS 최근일자 도·소매 시세 (서버에서 3시간 캐시, 키는 서버에만 있음) */
export async function GET() {
  const body = await getKamisPrices();
  return Response.json(body, { status: body.error && !body.missingKey ? 502 : 200 });
}
