/**
 * 산지 지도용 시군구 경계 만들기 (한 번만 실행, 결과 파일을 저장소에 넣는다)
 *
 * 원본: 통계청 2018 센서스용 행정구역경계 (공공누리 제1유형)
 *   https://github.com/southkorea/southkorea-maps — kostat/2018/json/skorea-municipalities-2018-topo-simple.json
 * 실행: node scripts/build-korea-geo.mjs <받은 topo-simple.json 경로>
 * 결과:
 *   public/geo/korea-sigungu.json  — 지도에 그리는 GeoJSON (좌표 소수 3자리)
 *   src/lib/data/sigungu.ts        — 주소 → 시군구 매칭·중심점 표 (서버·클라이언트 공용)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const [src] = process.argv.slice(2);
if (!src) throw new Error("사용법: node scripts/build-korea-geo.mjs <topo-simple.json>");

const topo = JSON.parse(readFileSync(src, "utf8"));
const object = Object.values(topo.objects)[0];
const { scale, translate } = topo.transform;

/** 양자화·델타 인코딩된 arc를 경도·위도 배열로 푼다 */
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});

const round = (n) => Math.round(n * 1000) / 1000;

/** 반올림 후 같은 점이 이어지면 하나로 줄인다 (파일 크기 절반 이하로) */
function ring(indexes) {
  const points = [];
  for (const i of indexes) {
    const arc = i < 0 ? [...arcs[~i]].reverse() : arcs[i];
    points.push(...(points.length ? arc.slice(1) : arc));
  }
  const out = [];
  for (const [x, y] of simplify(points)) {
    const p = [round(x), round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

/** 더글라스-포이커 단순화 — 허용 오차 약 200m (전국·도 단위 지도에서는 차이가 안 보인다) */
const TOLERANCE = 0.002;
function simplify(points) {
  if (points.length < 5) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay);
    let far = -1;
    let farDist = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d = len ? Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len : Math.hypot(px - ax, py - ay);
      if (d > farDist) {
        farDist = d;
        far = i;
      }
    }
    if (far >= 0 && farDist > TOLERANCE) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** 지도 축척에서 안 보이는 작은 섬(약 3km² 미만)은 뺀다 — 시군구 본토 고리는 항상 남긴다 */
const MIN_ISLAND_AREA = 0.0003;

/** 신발끈 공식 — 면적과 무게중심 (섬 때문에 가장 큰 고리만 쓴다) */
function ringCentroid(points) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  return { area: Math.abs(area), c: area ? [cx / (6 * area), cy / (6 * area)] : points[0] };
}

const SIDO = {
  11: "서울특별시", 21: "부산광역시", 22: "대구광역시", 23: "인천광역시", 24: "광주광역시", 25: "대전광역시", 26: "울산광역시",
  29: "세종특별자치시", 31: "경기도", 32: "강원도", 33: "충청북도", 34: "충청남도", 35: "전라북도", 36: "전라남도",
  37: "경상북도", 38: "경상남도", 39: "제주특별자치도",
};

const features = [];
const table = [];
for (const geometry of object.geometries) {
  const polygons = geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs;
  const all = polygons.map((polygon) => polygon.map(ring)).filter((polygon) => polygon[0].length >= 4);
  const measured = all.map((polygon) => ({ polygon, ...ringCentroid(polygon[0]) })).sort((a, b) => b.area - a.area);
  const biggest = measured[0];
  const coordinates = measured.filter((m, i) => i === 0 || m.area >= MIN_ISLAND_AREA).map((m) => m.polygon);
  const { code, name } = geometry.properties;
  const center = biggest.c.map(round);
  features.push({ type: "Feature", properties: { code, name, sido: SIDO[code.slice(0, 2)] }, geometry: { type: "MultiPolygon", coordinates } });
  table.push([code, name, center[0], center[1]]);
}

mkdirSync("public/geo", { recursive: true });
writeFileSync("public/geo/korea-sigungu.json", JSON.stringify({ type: "FeatureCollection", features }));

const lines = table.map(([code, name, x, y]) => `  ["${code}", "${name}", ${x}, ${y}],`).join("\n");
writeFileSync(
  "src/lib/data/sigungu.ts",
  `/**
 * 시군구 표 [통계청 코드, 이름, 중심 경도, 중심 위도] — scripts/build-korea-geo.mjs가 만든 파일 (직접 고치지 말 것)
 * 출처: 통계청 2018 센서스용 행정구역경계 (공공누리 제1유형). 코드 앞 2자리는 통계청 시도 코드.
 */
export type SigunguRow = readonly [code: string, name: string, lng: number, lat: number];

export const SIGUNGU: readonly SigunguRow[] = [
${lines}
];
`,
);
console.log(`시군구 ${features.length}곳 저장`);
