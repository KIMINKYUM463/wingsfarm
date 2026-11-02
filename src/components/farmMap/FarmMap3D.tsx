"use client";

import { FlyToInterpolator, type MapViewState, type PickingInfo } from "@deck.gl/core";
import { ColumnLayer, GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import { useState, type ReactNode } from "react";
import { num } from "@/lib/format";
import { itemSummary, type FarmPoint, type RegionStat } from "@/lib/farmMap";

/** public/geo/korea-sigungu.json 의 feature.properties */
type RegionProps = { code: string; name: string; sido: string };
type RegionFeature = { properties: RegionProps };
type Rgb = [number, number, number];

export type HeightMetric = "sites" | "farms";

const HOME: MapViewState = { longitude: 127.9, latitude: 35.3, zoom: 5.75, pitch: 45, bearing: -10 };
const MAX_COLUMN_M = 90_000;

const LOW: Rgb = [110, 231, 183];
const HIGH: Rgb = [4, 120, 87];
const SELECTED: Rgb = [251, 191, 36];
const APC: Rgb = [251, 146, 60];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;

/**
 * 전국 3D 산지 지도 (deck.gl, 배경 지도 타일 없이 통계청 시군구 경계만 그린다 → 외부 지도 키·요금 없음)
 * - 시군구 기둥: 높이 = 산지 수(또는 등록 농가 수), 제곱근 비율이라 작은 산지도 보인다
 * - 주황 점: 산지유통센터(APC) 실제 위치
 */
export default function FarmMap3D({
  regions,
  points,
  metric,
  selected,
  focus,
  onSelect,
}: {
  regions: RegionStat[];
  points: FarmPoint[];
  metric: HeightMetric;
  selected: string;
  /** 바뀔 때마다 그 시군구로 날아간다 (목록에서 고를 때) */
  focus: { code: string; at: number } | null;
  onSelect: (code: string) => void;
}) {
  const [view, setView] = useState<MapViewState>(HOME);
  const [lastFocus, setLastFocus] = useState(focus);

  if (focus !== lastFocus) {
    setLastFocus(focus);
    const target = focus && regions.find((r) => r.code === focus.code);
    if (target) {
      setView({ ...view, longitude: target.lng, latitude: target.lat, zoom: 8.6, pitch: 55, transitionDuration: 900, transitionInterpolator: new FlyToInterpolator() });
    }
  }

  const value = (r: RegionStat) => (metric === "farms" ? r.farms || r.sites : r.sites);
  const max = Math.max(1, ...regions.map(value));
  const ratio = (r: RegionStat) => Math.sqrt(value(r) / max);
  const byCode = new Map(regions.map((r) => [r.code, r]));

  const layers = [
    new GeoJsonLayer<RegionProps>({
      id: "sigungu",
      data: "/geo/korea-sigungu.json",
      filled: true,
      stroked: true,
      pickable: true,
      getFillColor: (f) => {
        const code = (f as RegionFeature).properties.code;
        if (code === selected) return [...SELECTED, 90];
        const r = byCode.get(code);
        return r ? [...mix([30, 64, 60], [6, 95, 70], ratio(r)), 255] : [30, 41, 59, 255];
      },
      getLineColor: [71, 85, 105, 255],
      lineWidthMinPixels: 0.6,
      onClick: (info) => onSelect((info.object as RegionFeature).properties.code),
      updateTriggers: { getFillColor: [selected, regions, metric] },
    }),
    new ColumnLayer<RegionStat>({
      id: "columns",
      data: regions,
      diskResolution: 14,
      radius: 3200,
      extruded: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 80],
      getPosition: (r) => [r.lng, r.lat],
      getElevation: (r) => Math.max(1500, ratio(r) * MAX_COLUMN_M),
      getFillColor: (r) => (r.code === selected ? SELECTED : mix(LOW, HIGH, ratio(r))),
      onClick: (info) => onSelect((info.object as RegionStat).code),
      updateTriggers: { getElevation: [metric, max], getFillColor: [selected, metric, max] },
      transitions: { getElevation: 600 },
    }),
    new ScatterplotLayer<FarmPoint>({
      id: "apc",
      data: points,
      pickable: true,
      stroked: true,
      getPosition: (p) => [p.lng, p.lat, 300],
      getRadius: 1500,
      radiusMinPixels: 3,
      radiusMaxPixels: 9,
      getFillColor: APC,
      getLineColor: [255, 255, 255],
      lineWidthMinPixels: 1,
      onClick: (info) => onSelect((info.object as FarmPoint).region),
    }),
  ];

  const itemsLine = (r: RegionStat) => (r.items.length ? `\n주요 품목: ${itemSummary(r.items)}` : "");
  const tooltip = ({ object, layer }: PickingInfo) => {
    if (!object || !layer) return null;
    if (layer.id === "columns") {
      const r = object as RegionStat;
      return { text: `${r.label}\n산지 ${num(r.sites)}곳${r.farms ? ` · 등록 농가 ${num(r.farms)}` : ""}${itemsLine(r)}\n클릭하면 목록` };
    }
    if (layer.id === "apc") {
      const p = object as FarmPoint;
      return { text: `${p.name}\n${p.items.slice(0, 5).join(", ")}${p.phone ? `\n☎ ${p.phone}` : ""}` };
    }
    const f = object as RegionFeature;
    const r = byCode.get(f.properties.code);
    return { text: `${f.properties.sido} ${f.properties.name}${r ? `\n산지 ${num(r.sites)}곳${itemsLine(r)}` : "\n조건에 맞는 산지 없음"}` };
  };

  return (
    <div className="relative h-[68vh] min-h-[420px] overflow-hidden rounded-2xl bg-slate-950">
      <DeckGL
        viewState={view}
        onViewStateChange={({ viewState }) => setView(viewState as MapViewState)}
        controller={{ dragRotate: true, touchRotate: true }}
        layers={layers}
        getTooltip={tooltip}
        getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
      />
      <div className="absolute top-3 right-3 flex gap-1.5">
        <MapButton onClick={() => setView({ ...view, pitch: view.pitch ? 0 : 48, bearing: view.pitch ? 0 : -12, transitionDuration: 500 })}>
          {view.pitch ? "위에서 보기" : "3D로 보기"}
        </MapButton>
        <MapButton onClick={() => setView({ ...HOME, transitionDuration: 800, transitionInterpolator: new FlyToInterpolator() })}>전국 보기</MapButton>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-slate-900/80 px-3 py-2 text-xs leading-5 text-slate-200">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-1.5 rounded-sm bg-emerald-400" /> 기둥 높이 = {metric === "farms" ? "등록 농가 수" : "산지 수"}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full border border-white bg-orange-400" /> 산지유통센터(APC) 실제 위치
        </div>
        <div className="text-slate-400">드래그 이동 · 오른쪽 드래그(또는 Ctrl) 회전 · 휠 확대</div>
      </div>
      <p className="pointer-events-none absolute right-3 bottom-2 text-[10px] text-slate-500">경계: 통계청(2018, 공공누리 1유형)</p>
    </div>
  );
}

function MapButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-100 ring-1 ring-slate-700 hover:bg-slate-700">
      {children}
    </button>
  );
}
