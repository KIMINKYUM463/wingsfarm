import { addDays, type WingSalesResponse } from "@/lib/coupangWing";
import { WingError, getWingSales, wingConfigured } from "@/lib/server/coupangWing";

/** 광고 보고서 한 장(최대 몇 달)에 맞춘 상한 — 넘으면 호출 수가 크게 늘어난다 */
const MAX_DAYS = 92;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const kstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** GET /api/coupang/sales?from=2026-10-01&to=2026-10-14 → 주문일 기준 쿠팡 매출 합계 (개인정보 없이 합계만) */
export async function GET(req: Request) {
  if (!wingConfigured()) return Response.json({ configured: false } satisfies WingSalesResponse);

  const params = new URL(req.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const fail = (error: string, status = 400) => Response.json({ configured: true, error } satisfies WingSalesResponse, { status });

  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) return fail("기간 형식이 올바르지 않아요.");
  if (addDays(from, MAX_DAYS) <= to) return fail(`한 번에 ${MAX_DAYS}일까지만 불러올 수 있어요.`);
  const end = to > kstToday() ? kstToday() : to;

  try {
    const sales = await getWingSales(from, end);
    return Response.json({ configured: true, ...sales } satisfies WingSalesResponse);
  } catch (err) {
    console.error("[coupang/sales]", err);
    return fail(err instanceof WingError ? err.message : "쿠팡 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.", 502);
  }
}
