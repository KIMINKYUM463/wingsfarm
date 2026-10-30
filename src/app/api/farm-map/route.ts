import { matchesFilter, parseFilter, summarizeRegions, topItems, type FarmMapResponse, type FarmPoint } from "@/lib/farmMap";
import { SOURCE_CONFIGS, getFarmMapState } from "@/lib/server/farmMap";

const guide = () => SOURCE_CONFIGS.map(({ id, label, applyUrl }) => ({ id, label, applyUrl, count: 0, error: "" }));

/** 지도 요약: 시군구별 건수·APC 위치·품목 순위 (전체 목록은 /api/farm-map/region) */
export async function GET(request: Request) {
  const filter = parseFilter(new URL(request.url).searchParams);
  const state = await getFarmMapState();
  const snapshot = state.snapshot;
  const inSources = snapshot?.sites.filter((s) => filter.sources.includes(s.source)) ?? [];
  const matched = inSources.filter((s) => matchesFilter(s, filter));
  const { regions, unlocated } = summarizeRegions(matched);
  const points: FarmPoint[] = matched
    .filter((s) => s.lat !== null && s.lng !== null)
    .map((s) => ({ id: s.id, name: s.name, lng: s.lng!, lat: s.lat!, items: s.items, phone: s.phone, region: s.region }));

  const body: FarmMapResponse = {
    phase: state.phase,
    progress: state.progress,
    error: state.error,
    updatedAt: snapshot?.updatedAt ?? "",
    sources: snapshot?.sources ?? guide(),
    regions,
    points,
    items: topItems(inSources),
    total: matched.length,
    unlocated,
  };
  return Response.json(body);
}

/** 지금 다시 받기 (보통 7일마다 자동) */
export async function POST() {
  const state = await getFarmMapState({ refresh: true });
  return Response.json({ phase: state.phase, progress: state.progress });
}
