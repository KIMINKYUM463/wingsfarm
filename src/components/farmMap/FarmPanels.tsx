"use client";

import { useEffect, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { FARM_SOURCES, UNLOCATED, filterParams, regionLabel, type FarmFilter, type FarmRegionResponse, type FarmSite, type RegionStat } from "@/lib/farmMap";
import { num } from "@/lib/format";
import { errorMessage } from "@/lib/http";

const SOURCE_TONE = { gap: "good", eco: "info", apc: "warn" } as const;
const sourceShort = (id: FarmSite["source"]) => FARM_SOURCES.find((s) => s.id === id)?.short ?? id;

/** ㎡ → "1.2ha" / "3,500평" */
function area(m2: number | null) {
  if (!m2) return "";
  return m2 >= 10_000 ? `${(m2 / 10_000).toFixed(1)}ha` : `${num(m2 / 3.3058)}평`;
}

/** 선택 전: 조건에 맞는 산지가 많은 시군구 순위 */
export function RegionRanking({ regions, unlocated, onSelect }: { regions: RegionStat[]; unlocated: number; onSelect: (code: string) => void }) {
  if (regions.length === 0) return <p className="text-sm text-stone-500">조건에 맞는 산지가 없어요. 품목이나 검색어를 바꿔 보세요.</p>;
  const top = regions[0].sites;
  return (
    <ol className="space-y-1">
      {regions.slice(0, 30).map((r, i) => (
        <li key={r.code}>
          <button type="button" onClick={() => onSelect(r.code)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-stone-50">
            <span className="w-5 text-xs text-stone-400 tabular-nums">{i + 1}</span>
            <span className="w-32 shrink-0 truncate text-stone-800">{r.label}</span>
            <span className="h-1.5 flex-1 rounded-full bg-stone-100">
              <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(r.sites / top) * 100}%` }} />
            </span>
            <span className="w-14 text-right text-xs text-stone-600 tabular-nums">{num(r.sites)}곳</span>
          </button>
        </li>
      ))}
      {unlocated > 0 && (
        <li>
          <button type="button" onClick={() => onSelect(UNLOCATED)} className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-stone-500 hover:bg-stone-50">
            주소로 위치를 못 찾은 산지 {num(unlocated)}곳 보기 →
          </button>
        </li>
      )}
    </ol>
  );
}

/** 선택한 시군구의 산지 목록 */
export function RegionDetail({ code, filter, onClose }: { code: string; filter: FarmFilter; onClose: () => void }) {
  const [data, setData] = useState<FarmRegionResponse | null>(null);
  const [failed, setFailed] = useState("");
  const query = `${filterParams(filter)}&code=${encodeURIComponent(code)}`;

  useEffect(() => {
    let alive = true;
    fetch(`/api/farm-map/region?${query}`)
      .then((res) => res.json() as Promise<FarmRegionResponse>)
      .then((body) => {
        if (!alive) return;
        setData(body);
        setFailed("");
      })
      .catch((err) => {
        if (alive) setFailed(errorMessage(err, "목록을 불러오지 못했어요."));
      });
    return () => {
      alive = false;
    };
  }, [query]);

  const current = data?.code === code ? data : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-stone-900">{code === UNLOCATED ? "위치 미확인" : regionLabel(code)}</p>
          <p className="text-xs text-stone-500">{current ? `${num(current.total)}곳${current.total > current.sites.length ? ` 중 ${current.sites.length}곳 표시` : ""} · 연락처 있는 곳 먼저` : "불러오는 중…"}</p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          ← 순위로
        </Button>
      </div>
      {failed && <p className="text-sm text-rose-600">{failed}</p>}
      <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
        {current?.sites.map((site) => (
          <SiteCard key={site.id} site={site} highlight={filter.item} />
        ))}
      </ul>
    </div>
  );
}

function SiteCard({ site, highlight }: { site: FarmSite; highlight: string }) {
  const where = site.region ? regionLabel(site.region) : site.address.split(" ").slice(0, 3).join(" ");
  const search = encodeURIComponent(`${site.name} ${where}`);
  const facts = [
    site.farms > 1 && `농가 ${num(site.farms)}곳`,
    area(site.areaM2) && `재배 ${area(site.areaM2)}`,
    site.planQty && `생산계획 ${num(site.planQty)}${site.source === "gap" ? "톤" : ""}`,
    site.validUntil && `인증 ${site.validUntil}까지`,
  ].filter(Boolean);

  return (
    <li className="rounded-xl border border-stone-200 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={SOURCE_TONE[site.source]}>{sourceShort(site.source)}</Badge>
        {site.source !== "apc" && site.cert !== "GAP" && <Badge>{site.cert}</Badge>}
        {site.producerType && <Badge>{site.producerType}</Badge>}
        <span className="font-semibold text-stone-900">{site.name || "(이름 없음)"}</span>
      </div>
      <p className="mt-1 text-xs text-stone-500">
        {site.owner && site.owner !== site.name && `${site.source === "apc" ? "관리" : "대표"} ${site.owner} · `}
        {site.address}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {site.items.slice(0, 12).map((item) => (
          <span key={item} className={`rounded-md px-1.5 py-0.5 text-xs ${item === highlight ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-700"}`}>
            {item}
          </span>
        ))}
      </div>
      {facts.length > 0 && <p className="mt-1.5 text-xs text-stone-500">{facts.join(" · ")}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {site.phone ? (
          <a href={`tel:${site.phone}`} className="font-semibold text-emerald-700 hover:underline">
            ☎ {site.phone}
          </a>
        ) : (
          <span className="text-stone-400" title="품질원 공개 데이터는 개인·단체 전화번호를 가려서 줘요">
            공개 연락처 없음
          </span>
        )}
        <a href={`https://search.naver.com/search.naver?query=${search}`} target="_blank" rel="noreferrer" className="text-stone-600 hover:underline">
          네이버 검색
        </a>
        <a href={`https://map.naver.com/p/search/${search}`} target="_blank" rel="noreferrer" className="text-stone-600 hover:underline">
          지도
        </a>
      </div>
    </li>
  );
}
