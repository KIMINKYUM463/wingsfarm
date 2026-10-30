import { UNLOCATED, matchesFilter, parseFilter, rankSites, regionLabel, type FarmRegionResponse } from "@/lib/farmMap";
import { getFarmMapState } from "@/lib/server/farmMap";

const LIMIT = 300;

/** 한 시군구(또는 위치 미확인 묶음)의 산지 목록 — 연락처 있는 곳 먼저 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("code") ?? "";
  const filter = parseFilter(params);
  const { snapshot } = await getFarmMapState();
  const region = code === UNLOCATED ? "" : code;
  const sites = rankSites((snapshot?.sites ?? []).filter((s) => s.region === region && matchesFilter(s, filter)));
  const body: FarmRegionResponse = { code, label: code === UNLOCATED ? "위치 미확인" : regionLabel(code), total: sites.length, sites: sites.slice(0, LIMIT) };
  return Response.json(body);
}
