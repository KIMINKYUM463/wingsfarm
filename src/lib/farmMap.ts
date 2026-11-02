/**
 * 전국 산지 지도 — 공공데이터를 산지(생산자) 목록으로 바꾸고, 시군구별로 모으는 계산 (서버·클라이언트 공용)
 *
 * 출처 (모두 공공데이터포털 · 이용허락 제한 없음)
 * - GAP: 국립농산물품질관리원 농산물우수관리 인증정보 (생산자·대표자·품목·법정동·재배면적·생산계획량)
 * - 친환경: 국립농산물품질관리원 친환경 인증정보 (유기농·무농약, 단체 전화는 대부분 *** 로 가려져 옴)
 * - APC: 전국농산물산지유통센터 표준데이터 (센터명·주소·위경도·주요품목·전화번호)
 *
 * 품질원 API의 응답 칸 영문 이름은 공개 명세에 없어서, 요청 변수 이름과 같은 규칙(CERT_NO, PRDCR_GRP_NM …)을 먼저 찾고
 * 없으면 이름 패턴으로 찾는다. 그래도 못 찾으면 받은 칸 이름을 오류 메시지에 담아 바로 고칠 수 있게 한다.
 */
import { SIGUNGU, type SigunguRow } from "./data/sigungu.ts";

export type FarmSource = "gap" | "eco" | "apc";

export const FARM_SOURCES: { id: FarmSource; label: string; short: string; color: [number, number, number] }[] = [
  { id: "gap", label: "GAP 인증 농가", short: "GAP", color: [16, 150, 105] },
  { id: "eco", label: "친환경 인증 농가", short: "친환경", color: [101, 163, 13] },
  { id: "apc", label: "산지유통센터(APC)", short: "APC", color: [217, 119, 6] },
];

export interface FarmSite {
  id: string;
  source: FarmSource;
  /** 생산자(단체)명 또는 유통센터명 */
  name: string;
  /** 대표자명 (APC는 관리기관) */
  owner: string;
  /** 개인 / 단체 / "" */
  producerType: string;
  items: string[];
  /** 통계청 시군구 코드 — 못 찾으면 "" */
  region: string;
  /** 법정동명 또는 주소 */
  address: string;
  /** 공개된 전화번호만 (가려진 번호는 "") */
  phone: string;
  /** APC만 정확한 위치가 있다 */
  lat: number | null;
  lng: number | null;
  /** 등록 농가 수 (단체 인증이면 여러 농가) */
  farms: number;
  areaM2: number | null;
  /** 생산계획량 (GAP은 톤, 친환경은 원자료 단위 그대로) */
  planQty: number | null;
  /** 예: GAP, 유기농, 무농약, APC 2014년 설립 */
  cert: string;
  /** YYYY-MM-DD, 모르면 "" */
  validUntil: string;
  certBody: string;
  certBodyPhone: string;
}

export type Row = Record<string, unknown>;

// ───────────────────────── 응답 읽기 ─────────────────────────

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

/** 공공데이터포털 응답은 { response: { header, body } } 또는 { header, body } — 깊이와 상관없이 찾는다 */
function findKey(node: unknown, key: string, depth = 0): unknown {
  if (!node || typeof node !== "object" || depth > 5) return undefined;
  const obj = node as Row;
  if (key in obj) return obj[key];
  for (const value of Object.values(obj)) {
    const found = findKey(value, key, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

export interface ParsedPage {
  rows: Row[];
  total: number | null;
  /** 정상 코드(00·0·INFO-000)가 아니면 메시지 */
  error: string | null;
}

/** 공공데이터포털 JSON 한 페이지 → 행 목록·전체 건수·오류 */
export function parsePage(json: unknown): ParsedPage {
  const code = str(findKey(json, "resultCode"));
  const message = str(findKey(json, "resultMsg"));
  if (code && !["00", "0", "000", "INFO-000"].includes(code)) {
    return { rows: [], total: null, error: code === "03" || /NODATA/i.test(message) ? null : `${message || "오류"} (코드 ${code})` };
  }
  // 표준데이터: response.body.items.item / 품질원 API: DATA.ROW
  const items = findKey(json, "items");
  const inner = (items && typeof items === "object" && !Array.isArray(items) ? (items as Row).item : items) ?? findKey(json, "ROW");
  const list = Array.isArray(inner) ? inner : inner && typeof inner === "object" ? [inner] : [];
  const total = Number(str(findKey(json, "totalCount")));
  return { rows: list.filter((r): r is Row => Boolean(r) && typeof r === "object"), total: Number.isFinite(total) && total > 0 ? total : null, error: null };
}

const CONTROL_CHARS = /[\u0000-\u001f]/g;
/** 한 줄에 `"KEY":"값",` 하나 — 값 부분만 잡는다 */
const VALUE_LINE = /^(\s*"[^"]+"\s*:\s*")(.*)("\s*,?\s*)$/;

/**
 * 품질원 응답은 값 안의 줄바꿈("이탈리안\n라이그라스")과 큰따옴표(""Peresvet" LLC")를 이스케이프하지 않고 보낼 때가 있다.
 * 제어 문자는 JSON 밖에선 공백과 같으니 공백으로 바꾸고, 그래도 안 되면 한 줄 한 속성 형식을 믿고 값 안의 따옴표를 이스케이프한다.
 */
export function parseLooseJson(text: string): unknown {
  try {
    return JSON.parse(text.replace(CONTROL_CHARS, " "));
  } catch {
    const repaired = text
      .split(/\r?\n/)
      .map((line) => line.replace(VALUE_LINE, (_, head: string, value: string, tail: string) => head + value.replace(/\\?"/g, '\\"') + tail))
      .join("\n");
    return JSON.parse(repaired.replace(CONTROL_CHARS, " "));
  }
}

/** `<name>값</name>` 또는 `<name><![CDATA[값]]></name>` 의 값 */
function xmlTag(text: string, name: string) {
  const match = new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))\\s*</${name}>`).exec(text);
  return (match?.[1] ?? match?.[2])?.trim() || undefined;
}

/** 인증키가 틀리면 type=json이어도 XML로 온다 */
export function xmlError(text: string): string | null {
  const code = xmlTag(text, "returnReasonCode") ?? xmlTag(text, "resultCode");
  const msg = xmlTag(text, "returnAuthMsg") ?? xmlTag(text, "resultMsg") ?? xmlTag(text, "errMsg");
  if (!code && !msg) return null;
  if (msg?.includes("PAGE MAX COUNT")) return `한 번에 받는 건수가 이 API의 한도를 넘었어요 (${msg.match(/PAGE MAX COUNT : \d+/)?.[0] ?? msg}).`;
  return KEY_ERRORS[code ?? ""] ?? `${msg ?? "오류"}${code ? ` (코드 ${code})` : ""}`;
}

const KEY_ERRORS: Record<string, string> = {
  "20": "이 API의 활용신청이 안 되어 있어요. 공공데이터포털에서 활용신청을 눌러 주세요.",
  "22": "오늘 호출 한도를 넘었어요. 내일 다시 받아요.",
  "30": "인증키가 등록되지 않았어요. 일반 인증키(Decoding)를 넣었는지, 발급 후 1시간쯤 지났는지 확인하세요.",
  "31": "인증키 기한이 지났어요. 공공데이터포털에서 연장하세요.",
  "32": "등록되지 않은 IP예요.",
};

/** LCTN_ROAD_NM_ADDR 와 lctnRoadNmAddr 를 같은 칸으로 본다 */
const fieldKey = (name: string) => name.replace(/_/g, "").toLowerCase();

/** 정확한 칸 이름 → 없으면 이름 패턴 (exclude에 걸리는 칸은 건너뜀) */
function field(row: Row, exact: string[], pattern?: RegExp, exclude?: RegExp): string {
  const keys = Object.keys(row);
  for (const name of exact) {
    const key = keys.find((k) => fieldKey(k) === fieldKey(name));
    if (key && str(row[key])) return str(row[key]);
  }
  if (!pattern) return "";
  const key = keys.find((k) => pattern.test(k) && !(exclude && exclude.test(k)) && str(row[k]));
  return key ? str(row[key]) : "";
}

const numberOf = (value: string) => {
  const n = Number(value.replace(/[^\d.]/g, ""));
  return value && Number.isFinite(n) ? n : null;
};

/** "20271231" · "2027-12-31" → "2027-12-31" */
export function ymd(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : "";
}

/** 가려진(***) 번호·숫자 없는 값은 버린다 */
export function publicPhone(value: string) {
  return value.includes("*") || value.replace(/\D/g, "").length < 7 ? "" : value;
}

/** "토마토+ 파프리카+ 배+등" · "블루베리, 오이" → ["토마토","파프리카","배"] */
export function splitItems(value: string) {
  const seen = new Set<string>();
  for (const part of value.split(/[,+·/、]|\s{2,}/)) {
    const item = part.replace(/\(.*?\)/g, "").trim();
    if (item && item !== "등" && item.length <= 20) seen.add(item);
  }
  return [...seen];
}

const ECO_CERT: Record<string, string> = { "1": "유기농", "2": "유기축산", "3": "무농약" };
/** GAP 생산자구분값: 1 개인, 3 단체(농협·작목반) — 품질원 미리보기 기준 */
const GAP_PRODUCER: Record<string, string> = { "1": "개인", "3": "단체", 개인: "개인", 단체: "단체" };

export function fromGapRow(row: Row): Omit<FarmSite, "region"> | null {
  const name = field(row, ["PRDCR_GRP_NM", "PRDCTN_GRP_NM"], /GRP_NM$/i);
  const address = field(row, ["GRP_STDG_CD_NM", "STDG_CD_NM", "GRP_STDG_NM"], /(STDG|LGL|LOC|ADDR).*(NM|ADDR)$/i);
  if (!name && !address) return null;
  const certNo = field(row, ["CERT_NO", "CRTFC_NO"], /CE?RT.*_NO$/i);
  return {
    id: `gap:${certNo || name}:${field(row, ["ITEM_NM", "PRDLST_NM", "CERT_ITEM_NM"], /ITEM_NM|PRDLST_NM/i)}`,
    source: "gap",
    name,
    owner: field(row, ["RPRSV_NM", "RPRSNTV_NM"], /RPRS.*NM/i),
    producerType: GAP_PRODUCER[field(row, ["PRDCR_SE_VL", "PRDCR_SE_NM", "PRDCR_SE_CD"], /PRDCR_SE/i)] ?? "",
    items: splitItems(field(row, ["ITEM_NM", "PRDLST_NM", "CERT_ITEM_NM"], /ITEM_NM|PRDLST_NM/i)),
    address,
    phone: "",
    lat: null,
    lng: null,
    farms: numberOf(field(row, ["REG_FMHS_CNT", "RGST_FMHS_CNT", "PRDCR_CNT"], /FMHS|FARM.*CNT/i)) ?? 1,
    areaM2: numberOf(field(row, ["CLTVT_AREA_VL", "CLTVTN_AREA_VL", "CTVT_AR"], /CLTVT|CTVT|AREA/i)),
    planQty: numberOf(field(row, ["PRDCTN_PLAN_QTY", "PRDCTN_PLAN_QY"], /PLAN/i)),
    cert: "GAP",
    validUntil: ymd(field(row, ["CERT_VLD_END_YMD", "CRTFC_END_DE"], /END/i)),
    certBody: field(row, ["CERT_INST_NM", "CRTFC_ENGN_NM"], /(INST|ENGN)_NM/i),
    certBodyPhone: "",
  };
}

export function fromEcoRow(row: Row): Omit<FarmSite, "region"> | null {
  const name = field(row, ["PRDCR_GRP_NM"], /GRP_NM$/i);
  const address = field(row, ["GRP_STDG_CD_NM", "STDG_CD_NM", "GRP_STDG_NM"], /(STDG|LGL|ADDR).*(NM|ADDR)$/i) || field(row, ["PLOR_NM"]);
  if (!name && !address) return null;
  const certNo = field(row, ["CERT_NO"], /CERT_NO$/i);
  const certCode = field(row, ["CERT_SE_CD"], /CERT_SE/i);
  return {
    id: `eco:${certNo || name}`,
    source: "eco",
    name,
    owner: field(row, ["RPRSV_NM"], /RPRS.*NM/i),
    producerType: field(row, ["PRDCR_SE_NM"], /PRDCR_SE/i),
    items: splitItems(field(row, ["CERT_ITEM_NM"], /ITEM_NM/i)),
    address,
    phone: publicPhone(field(row, ["GRP_TELNO"], /TELNO/i, /INST/i)),
    lat: null,
    lng: null,
    farms: numberOf(field(row, ["REG_FMHS_CNT"], /FMHS|FARM.*CNT/i)) ?? 1,
    areaM2: numberOf(field(row, ["CLTVT_AREA_VL"], /CLTVT|CTVT|AREA/i)),
    planQty: numberOf(field(row, ["PRDCTN_PLAN_QTY"], /PLAN/i)),
    cert: ECO_CERT[certCode] ?? "친환경",
    validUntil: ymd(field(row, ["CERT_VLD_END_YMD"], /VLD_END/i)),
    certBody: field(row, ["CERT_INST_NM"], /INST_NM/i),
    certBodyPhone: publicPhone(field(row, ["CERT_INST_TELNO"], /INST.*TELNO/i)),
  };
}

export function fromApcRow(row: Row): Omit<FarmSite, "region"> | null {
  const name = field(row, ["DIST_CENT_NM", "distCentNm"]);
  if (!name) return null;
  const address = field(row, ["LCTN_ROAD_NM_ADDR", "rdnmadr"]) || field(row, ["LCTN_LOTNO_ADDR", "lnmadr"]);
  const lat = numberOf(field(row, ["LAT", "latitude"]));
  const lng = numberOf(field(row, ["LOT", "longitude"]));
  const inKorea = lat !== null && lng !== null && lat > 33 && lat < 39 && lng > 124 && lng < 132;
  const year = field(row, ["FNDN_YR", "fndnYr"]);
  return {
    id: `apc:${name}:${address}`,
    source: "apc",
    name,
    owner: field(row, ["MNG_INST_NM", "institutionNm"]),
    producerType: "",
    items: splitItems(field(row, ["MAJ_ITEM_NM", "majorItemNm"])),
    address,
    phone: publicPhone(field(row, ["TELNO", "phoneNumber"])),
    lat: inKorea ? lat : null,
    lng: inKorea ? lng : null,
    farms: 0,
    areaM2: null,
    planQty: null,
    cert: year ? `${year}년 설립` : "산지유통센터",
    validUntil: "",
    certBody: "",
    certBodyPhone: "",
  };
}

/** 대부분의 행에서 이름·주소를 못 읽으면 응답 형식이 바뀐 것 — 받은 칸 이름을 알려준다 */
export function describeUnknownShape(rows: Row[], parsed: number) {
  if (rows.length === 0 || parsed >= rows.length / 2) return null;
  return `응답 형식이 예상과 달라요. 받은 칸: ${Object.keys(rows[0]).slice(0, 25).join(", ")}`;
}

// ───────────────────────── 주소 → 시군구 ─────────────────────────

/** 시도 이름 조각 → 통계청 시도 코드 (2026 전남광주통합특별시처럼 두 곳을 품은 이름도 처리) */
const SIDO_HINTS: [RegExp, string][] = [
  [/서울/, "11"], [/부산/, "21"], [/대구/, "22"], [/인천/, "23"], [/광주/, "24"], [/대전/, "25"], [/울산/, "26"], [/세종/, "29"],
  [/경기/, "31"], [/강원/, "32"], [/충북|충청북/, "33"], [/충남|충청남/, "34"], [/전북|전라북/, "35"], [/전남|전라남/, "36"],
  [/경북|경상북/, "37"], [/경남|경상남/, "38"], [/제주/, "39"],
];

/** 2018 경계 이후 이름이 바뀌거나 새로 생긴 구 → 2018 경계의 구 (인천 남구→미추홀구 2018.7, 인천 행정체제 개편 2026.7) */
const RENAMED: Record<string, string> = { 미추홀구: "남구", 제물포구: "중구", 영종구: "중구", 검단구: "서구" };

function sidoCodes(first: string) {
  if (!/(특별시|광역시|특별자치시|특별자치도|도)$/.test(first)) return [];
  return SIDO_HINTS.filter(([re]) => re.test(first)).map(([, code]) => code);
}

/**
 * "전남광주통합특별시 광주 해남군 옥천면" · "경기도 경기 수원시 장안구 …" · "전북특별자치도 무주군 무풍면 …" → 시군구 코드
 * 2018 경계 기준이라, 그 뒤에 생긴 구(예: 화성시 동탄구)는 같은 시의 첫 구역으로, 시도가 바뀐 군(군위군)은 이름이 하나뿐이면 그대로 찾는다.
 */
export function matchRegion(text: string, rows: readonly SigunguRow[] = SIGUNGU): string {
  const tokens = text
    .replace(/[(),]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => RENAMED[token] ?? token);
  if (tokens.length === 0) return "";
  const sidos = sidoCodes(tokens[0]);
  const inSido = sidos.length ? rows.filter(([code]) => sidos.includes(code.slice(0, 2))) : rows;
  if (sidos.length === 1 && inSido.length === 1) return inSido[0][0];

  const pick = (pool: readonly SigunguRow[]) => {
    for (let i = sidos.length ? 1 : 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!/[시군구]$/.test(token)) continue;
      const next = tokens[i + 1];
      const compound = next && pool.find(([, name]) => name === token + next);
      if (compound) return compound[0];
      const exact = pool.filter(([, name]) => name === token);
      if (exact.length === 1) return exact[0][0];
      if (token.endsWith("시")) {
        const part = pool.find(([, name]) => name.startsWith(token));
        if (part) return part[0];
      }
    }
    return "";
  };
  return pick(inSido) || (sidos.length ? pick(rows) : "");
}

export const REGION_BY_CODE = new Map(SIGUNGU.map((row) => [row[0], row]));

const SIDO_NAMES: Record<string, string> = {
  "11": "서울", "21": "부산", "22": "대구", "23": "인천", "24": "광주", "25": "대전", "26": "울산", "29": "세종", "31": "경기",
  "32": "강원", "33": "충북", "34": "충남", "35": "전북", "36": "전남", "37": "경북", "38": "경남", "39": "제주",
};

/** "37380" → "경북 성주군", 세종은 "세종" */
export function regionLabel(code: string) {
  const row = REGION_BY_CODE.get(code);
  if (!row) return "위치 미확인";
  const sido = SIDO_NAMES[code.slice(0, 2)] ?? "";
  return code.startsWith("29") ? "세종" : `${sido} ${row[1].replace(/^(.+?시)(.+구)$/, "$1 $2")}`;
}

// ───────────────────────── 걸러내기·모으기 ─────────────────────────

export interface FarmFilter {
  sources: FarmSource[];
  /** 품목 칩 — 품목명이 정확히 같아야 (배 ≠ 배추) */
  item: string;
  /** 자유 검색 — 이름·대표자·품목·주소 포함 */
  query: string;
}

export function matchesFilter(site: FarmSite, filter: FarmFilter) {
  if (!filter.sources.includes(site.source)) return false;
  if (filter.item && !site.items.includes(filter.item)) return false;
  const q = filter.query.replace(/\s/g, "");
  if (!q) return true;
  return [site.name, site.owner, site.address, ...site.items].some((text) => text.replace(/\s/g, "").includes(q));
}

export interface RegionStat {
  code: string;
  label: string;
  lng: number;
  lat: number;
  /** 인증·센터 건수 */
  sites: number;
  /** 등록 농가 수 합 (APC 제외) */
  farms: number;
  bySource: Record<FarmSource, number>;
  /** 이 시군구에서 많이 나오는 품목 */
  items: ItemCount[];
}

export interface ItemCount {
  name: string;
  count: number;
}

/** 지도 툴팁·순위에 보여 줄 시군구별 주요 품목 수 */
export const REGION_TOP_ITEMS = 5;

export function summarizeRegions(sites: FarmSite[]) {
  const map = new Map<string, { stat: RegionStat; sites: FarmSite[] }>();
  let unlocated = 0;
  for (const site of sites) {
    const row = REGION_BY_CODE.get(site.region);
    if (!row) {
      unlocated++;
      continue;
    }
    let entry = map.get(site.region);
    if (!entry) {
      entry = { stat: { code: row[0], label: regionLabel(row[0]), lng: row[2], lat: row[3], sites: 0, farms: 0, bySource: { gap: 0, eco: 0, apc: 0 }, items: [] }, sites: [] };
      map.set(site.region, entry);
    }
    entry.stat.sites++;
    entry.stat.farms += site.farms;
    entry.stat.bySource[site.source]++;
    entry.sites.push(site);
  }
  const regions = [...map.values()].map(({ stat, sites: inRegion }) => ({ ...stat, items: topItems(inRegion, REGION_TOP_ITEMS) }));
  return { regions: regions.sort((a, b) => b.sites - a.sites), unlocated };
}

/** "벼 120 · 감자 30 · 딸기 12" */
export const itemSummary = (items: ItemCount[], limit = REGION_TOP_ITEMS) =>
  items
    .slice(0, limit)
    .map((i) => `${i.name} ${i.count.toLocaleString("ko-KR")}`)
    .join(" · ");

/** 많이 나오는 품목 순위 (칩으로 보여 줌) */
export function topItems(sites: FarmSite[], limit = 40): ItemCount[] {
  const count = new Map<string, number>();
  for (const site of sites) for (const item of site.items) count.set(item, (count.get(item) ?? 0) + 1);
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, n]) => ({ name, count: n }));
}

/** 시군구 안 목록 정렬: 연락처 있는 곳 → 농가 수 → 생산계획량 */
export function rankSites(sites: FarmSite[]) {
  return [...sites].sort((a, b) => Number(Boolean(b.phone)) - Number(Boolean(a.phone)) || b.farms - a.farms || (b.planQty ?? 0) - (a.planQty ?? 0));
}

/** 유효기간이 지난 인증은 소싱 대상에서 뺀다 (날짜를 모르면 남김) */
export const isCurrent = (site: Pick<FarmSite, "validUntil">, today: string) => !site.validUntil || site.validUntil >= today;

/** ?sources=gap,apc&item=사과&q=성주 → 필터 (sources가 없으면 전부) */
export function parseFilter(params: URLSearchParams): FarmFilter {
  const ids = FARM_SOURCES.map((s) => s.id);
  const sources = (params.get("sources") ?? "").split(",").filter((s): s is FarmSource => ids.includes(s as FarmSource));
  return { sources: params.has("sources") ? sources : ids, item: params.get("item")?.trim() ?? "", query: params.get("q")?.trim().slice(0, 40) ?? "" };
}

export function filterParams(filter: FarmFilter) {
  const params = new URLSearchParams({ sources: filter.sources.join(",") });
  if (filter.item) params.set("item", filter.item);
  if (filter.query) params.set("q", filter.query);
  return params;
}

// ───────────────────────── API 응답 ─────────────────────────

export interface SourceStatus {
  id: FarmSource;
  label: string;
  applyUrl: string;
  count: number;
  error: string;
}

export interface FarmPoint {
  id: string;
  name: string;
  lng: number;
  lat: number;
  items: string[];
  phone: string;
  region: string;
}

export interface FarmMapResponse {
  phase: "missingKey" | "loading" | "ready" | "error";
  progress: string;
  error: string;
  updatedAt: string;
  sources: SourceStatus[];
  regions: RegionStat[];
  /** 정확한 위치가 있는 산지(APC) */
  points: FarmPoint[];
  /** 고른 출처 안에서 많이 나오는 품목 */
  items: ItemCount[];
  total: number;
  unlocated: number;
}

export interface FarmRegionResponse {
  code: string;
  label: string;
  total: number;
  /** 목록을 자르기 전 전체 산지 기준 품목 순위 */
  items: ItemCount[];
  sites: FarmSite[];
}

/** 시군구 목록 대신 "위치 미확인" 묶음을 고를 때 쓰는 코드 */
export const UNLOCATED = "unlocated";
